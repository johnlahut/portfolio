# Security Audit Report — Chirp Portfolio Application

**Date:** 2026-02-22
**Scope:** Full-stack audit — FastAPI backend, React/TypeScript frontend, SQL/database schema, Docker/infrastructure
**Methodology:** Manual static analysis of all source files
**Note:** All Supabase tables have RLS enabled and appropriate role permissions configured (not reflected in exported DDL).

---

## Executive Summary

The application demonstrates strong foundational security practices: bcrypt password hashing, JWT secret length enforcement, SSRF protection on URL inputs, PIL decompression bomb limits, Row-Level Security on all tables, proper `.gitignore` hygiene, and no use of `dangerouslySetInnerHTML` or `eval()`. The audit identified **3 high-severity** and **12 medium-severity** findings, with the most critical risks centered on a **DNS rebinding gap in SSRF protection**, a **dynamic-column SQL function running as SECURITY DEFINER**, and **unbounded download sizes on outbound fetches**.

### Finding Distribution

| Severity | Count           |
| -------- | --------------- |
| HIGH     | 3               |
| MEDIUM   | 12              |
| LOW      | 10              |
| INFO     | 12 (8 positive) |

---

## Table of Contents

1. [HIGH Findings](#high-findings)
2. [MEDIUM Findings](#medium-findings)
3. [LOW Findings](#low-findings)
4. [INFO & Positive Findings](#info--positive-findings)
5. [Prioritized Remediation Plan](#prioritized-remediation-plan)

---

## HIGH Findings

### H1. TOCTOU Race Condition in SSRF Protection (DNS Rebinding)

**Severity:** HIGH
**File:** `backend/services.py:64-89`

**Description:** `validate_url()` resolves the hostname via `socket.getaddrinfo()` and checks if any resolved IP is private/loopback/reserved. However, the actual HTTP request (`requests.get()`) performs its own DNS resolution separately. Between the check and the fetch, the DNS record could change (DNS rebinding attack). Additionally, `requests.get()` follows redirects by default — a validated public URL can 302-redirect to an internal address.

**Exploitation scenario:**

1. Attacker controls `evil.example.com` with a short TTL DNS record.
2. First resolution: `1.2.3.4` (public) — passes `validate_url`.
3. DNS record switches to `169.254.169.254`.
4. `requests.get("http://evil.example.com/...")` hits the GCP metadata service.
5. Leaks Cloud Run service account tokens via `http://metadata.google.internal/`.

**Recommended fix:**

- Pin the resolved IP for the actual HTTP connection using a custom `requests` transport adapter.
- Disable automatic redirects (`allow_redirects=False`) and re-validate each redirect hop.
- Block `metadata.google.internal` and `169.254.169.254` explicitly by hostname.
- Block additional IP classes (`is_multicast`, `is_unspecified`) and normalize IDN/IPv6 handling.

---

### H2. Dynamic Column in `SECURITY DEFINER` Function Without Allowlist or `search_path`

**Severity:** HIGH
**Files:** `backend/sql/create_scrape_tables.sql:50-68`, `backend/database.py:429`

**Description:** The `portfolio.increment_scrape_job` function accepts a `p_column text` parameter and uses it in dynamic SQL via `EXECUTE format(... %I ...)`. While `%I` quotes the identifier (preventing arbitrary SQL execution), two compounding issues make this dangerous:

1. **No column allowlist** — the function will accept any valid column name on the `scrape_job` table (e.g. `status`, `error`, `url`), not just the intended counters.
2. **`SECURITY DEFINER` without `SET search_path`** — the function runs with the definer's privileges (bypassing RLS) and is vulnerable to search-path hijacking if an attacker can create objects in a schema that appears earlier in the path.

Even with RLS enabled, `SECURITY DEFINER` functions bypass RLS by design. If this RPC is callable via Supabase's PostgREST (depending on GRANT configuration), it could be invoked with arbitrary column names.

**Mitigating factor:** Python callers currently hardcode column names.

**Recommended fix:**

```sql
-- Add allowlist inside the function body:
IF p_column NOT IN ('processed_count', 'skipped_count', 'failed_count', 'total_faces') THEN
    RAISE EXCEPTION 'Invalid column: %', p_column;
END IF;

-- Add search_path to the function definition:
CREATE OR REPLACE FUNCTION portfolio.increment_scrape_job(...)
RETURNS void LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = portfolio
AS $$ ...
```

Also add a Python-side allowlist in `database.py`:

```python
_ALLOWED_INCREMENT_COLUMNS = {"processed_count", "skipped_count", "failed_count", "total_faces"}
def increment_scrape_job(job_id: str, column: str, amount: int = 1) -> None:
    if column not in _ALLOWED_INCREMENT_COLUMNS:
        raise ValueError(f"Invalid column: {column}")
```

---

### H3. Unrestricted Image Download Size (DoS)

**Severity:** HIGH
**File:** `backend/services.py:175,197,270-271`

**Description:** `requests.get()` calls set a `timeout=10` but do not limit response body size. The response is fully buffered into memory via `response.content`. An attacker could point to a URL serving an extremely large file (10 GB+), causing the Cloud Run instance to exhaust all available memory and crash. This affects `scrape_images()`, `load_image_from_url()`, and `_download_image()`.

While `Image.MAX_IMAGE_PIXELS = 25_000_000` protects against decompression bombs during image parsing, the raw HTTP download has no size limit and completes before PIL is invoked.

**Exploitation scenario:** An authenticated user submits a scrape job pointing to a URL that streams gigabytes of data. The worker thread downloads it all into memory, crashing the Cloud Run instance (2 GB memory limit).

**Recommended fix:**

```python
MAX_DOWNLOAD_SIZE = 50 * 1024 * 1024  # 50 MB
response = requests.get(url, timeout=10, stream=True)
response.raise_for_status()
content_length = int(response.headers.get('content-length', 0))
if content_length > MAX_DOWNLOAD_SIZE:
    raise ValueError("Image too large")
downloaded = 0
chunks = []
for chunk in response.iter_content(8192):
    downloaded += len(chunk)
    if downloaded > MAX_DOWNLOAD_SIZE:
        raise ValueError("Image too large")
    chunks.append(chunk)
data = b''.join(chunks)
```

---

## MEDIUM Findings

### M1. JWT Token Stored in localStorage

**Severity:** MEDIUM
**File:** `@/lib/api.ts:3,10,17-18`

**Description:** The JWT is stored in `localStorage`, accessible to any JavaScript running on the page. If any XSS vector exists (including via a compromised npm dependency), an attacker can steal the token with `localStorage.getItem('chirp-jwt')` and impersonate the user from any location until the token expires.

**Mitigating factors:** The token has a 1-day expiry. The password-version (`ver`) claim allows coarse revocation. React's JSX escaping provides baseline XSS protection. No `dangerouslySetInnerHTML` usage found.

**Recommended fix:** Migrate to `httpOnly`, `Secure`, `SameSite=Strict` cookies set by the backend. If localStorage must be used, implement short token lifetimes with refresh token rotation, and deploy a strict Content Security Policy to reduce XSS surface area.

---

### M2. FastAPI Docs Exposed in Production

**Severity:** MEDIUM
**File:** `backend/main.py:45`

**Description:** The FastAPI app is created with `FastAPI(lifespan=lifespan)` without disabling docs. By default, interactive API documentation is exposed at `/docs` (Swagger UI), `/redoc` (ReDoc), and `/openapi.json`. These enumerate every endpoint, all request/response schemas, and parameters to anyone who discovers the Cloud Run URL.

**Recommended fix:**

```python
import os
app = FastAPI(
    lifespan=lifespan,
    docs_url="/docs" if os.getenv("ENV") == "dev" else None,
    redoc_url="/redoc" if os.getenv("ENV") == "dev" else None,
    openapi_url="/openapi.json" if os.getenv("ENV") == "dev" else None,
)
```

---

### M3. No `limit` Parameter Bounds Checking

**Severity:** MEDIUM
**File:** `backend/main.py:124-135`

**Description:** The `limit` query parameter on `GET /images` defaults to 40 but has no upper bound validation. A client can pass `?limit=999999`, causing the RPC to attempt returning an enormous result set, leading to high memory usage and slow responses.

**Recommended fix:**

```python
from fastapi import Query
def get_images(limit: int = Query(default=40, ge=1, le=100), ...):
```

---

### M4. Docker Container Runs as Root

**Severity:** MEDIUM
**File:** `backend/Dockerfile`

**Description:** The Dockerfile does not create or switch to a non-root user. The application runs as `root` inside the container. If an attacker achieves code execution (e.g., through a dependency vulnerability or the SSRF issue), they have full root access within the container.

**Recommended fix:**

```dockerfile
# After pip install and model download:
RUN addgroup --system app && adduser --system --ingroup app app
USER app
```

---

### M5. ILIKE Search Wildcard Injection

**Severity:** MEDIUM
**File:** `backend/sql/get_image_with_person_matches.sql:189-192`

**Description:** The `p_search` parameter is used directly in an `ILIKE` pattern:

```sql
OR i.source_url ILIKE '%' || p_search || '%'
OR i.filename  ILIKE '%' || p_search || '%'
```

While this is not SQL injection (the parameter is properly bound), users can inject LIKE metacharacters (`%`, `_`) to craft unexpected search patterns. Passing `%` matches all rows; `___` matches any 3-character filename.

**Recommended fix:**

```sql
ILIKE '%' || replace(replace(replace(p_search, '\', '\\'), '%', '\%'), '_', '\_') || '%'
```

---

### M6. No Rate Limiting on Authenticated Endpoints

**Severity:** MEDIUM
**File:** `backend/main.py`

**Description:** Only `/auth/verify` has rate limiting (5/minute via `slowapi`). All other endpoints — including resource-intensive `/scrape`, `/process-image`, `/scrape-jobs` (POST), and `GET /images` — have no rate limits. An authenticated client can trigger unlimited CPU/network workloads.

**Recommended fix:**

```python
@app.post("/scrape-jobs", ...)
@limiter.limit("10/hour")
def create_scrape_job(...):

@app.post("/process-image", ...)
@limiter.limit("30/hour")
def process_image(...):
```

---

### M7. Scraping Feature Has No Domain Allowlist

**Severity:** MEDIUM
**File:** `backend/services.py:64-89,171-189`

**Description:** While `validate_url` blocks private/internal IPs, any public URL on the internet can be scraped. The server can be used to fetch content from any website — generating abusive traffic from your server's IP, amplifying attacks against third-party sites, or scraping websites that would otherwise block direct access.

**Recommended fix:** Add a domain allowlist if scraping is only intended for specific sites. At minimum, add per-user rate limits on scrape endpoints and a maximum number of images per job.

---

### M8. CORS `allow_origin_regex` Could Be Tighter

**Severity:** MEDIUM
**File:** `backend/main.py:56`

**Description:** The regex `r"https://.*\.portfolio-2ed\.pages\.dev"` matches any Cloudflare Pages preview subdomain. Every PR/commit preview deployment gets CORS access to the production API with credentials. Additionally, `allow_credentials=True` is unnecessary if auth is purely Bearer-header-based (browsers don't auto-attach `Authorization` headers).

**Recommended fix:**

```python
allow_origin_regex=r"https://[a-z0-9-]+\.portfolio-2ed\.pages\.dev"
# Remove allow_credentials=True if not using cookie auth
```

---

### M9. JWT Missing `iat`, `jti`, `sub` Claims

**Severity:** MEDIUM
**File:** `backend/services.py:392-399`

**Description:** The JWT payload only contains `exp` and `ver`. Missing claims:

- **`jti`** (JWT ID): Cannot revoke individual tokens before expiry.
- **`iat`** (Issued At): No audit trail for token age.
- **`sub`** (Subject): No user identity if the system ever supports multiple users.

The `ver` (password version) mechanism provides coarse revocation by invalidating all tokens on password change, but individual token revocation is not possible.

**Recommended fix:**

```python
import uuid
return jwt.encode({
    "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS),
    "iat": datetime.now(timezone.utc),
    "jti": str(uuid.uuid4()),
    "ver": version,
}, JWT_SECRET, algorithm=JWT_ALGORITHM)
```

---

### M10. Error Messages Leak Internal Details

**Severity:** MEDIUM
**File:** `backend/main.py:82-83,102-103,115-118`, `backend/services.py:87`

**Description:** Exception handlers pass `str(e)` directly to `HTTPException(detail=...)`. The SSRF check at `services.py:87` includes `f"Blocked address: {ip}"`, leaking resolved internal IP addresses to the client. Error tracebacks stored in scrape job items (`str(e)[:500]` in `jobs.py:70`) may also contain sensitive file paths or internal hostnames.

**Recommended fix:** Return generic error messages to clients. Log detailed errors server-side only:

```python
# Instead of: raise HTTPException(status_code=400, detail=str(e))
logger.warning("SSRF blocked: %s", e)
raise HTTPException(status_code=400, detail="URL not allowed")
```

---

### M11. User-Controlled URLs in `<img src>` and `<a href>`

**Severity:** MEDIUM
**Files:** `src/chirp/components/FaceOverlayImage.tsx:65`, `src/routes/chirp/gallery.$imageId.tsx:98-102`, `src/chirp/components/ScrapeJobTable.tsx:74-76`

**Description:** `source_url` and `preview_url` from user-submitted scrape jobs are used directly as `<img src>` and `<a href>` attributes. An attacker could submit a scrape job targeting a page with images hosted on an attacker-controlled server, enabling IP logging and browser fingerprinting of anyone who views the gallery. If a `javascript:` URI were stored in the database, clicking the "Source" link could execute JavaScript (though React and modern browsers mitigate this to varying degrees).

The `<a href>` in `gallery.$imageId.tsx` properly uses `rel="noopener noreferrer"`, which is good.

**Recommended fix:** Validate all stored URLs use `https?://` protocol on both backend (before storage) and frontend (before rendering). Consider proxying images through the backend to avoid direct browser-to-external-server requests.

---

### M12. Pillow Version May Be Outdated

**Severity:** MEDIUM
**File:** `backend/requirements.txt:63`

**Description:** `pillow==10.4.0` is pinned. Pillow has a history of security vulnerabilities related to image parsing (buffer overflows, heap overflows in various format parsers). The application processes untrusted images from arbitrary URLs, making this a meaningful attack surface.

**Mitigating factor:** `Image.MAX_IMAGE_PIXELS = 25_000_000` is set to prevent decompression bombs.

**Recommended fix:** Update Pillow to the latest version. Run `pip install --upgrade pillow` and regenerate `requirements.txt`. Consider running `pip audit` regularly.

---

## LOW Findings

### L1. Login Form Navigation Race Condition

**File:** `src/routes/chirp/login.tsx:25-29`

**Description:** `onSuccess: void navigate(...)` calls `navigate()` immediately when the form is submitted, not when the mutation succeeds. The `void` operator evaluates the expression eagerly and returns `undefined`, so `onSuccess` is effectively `undefined`. Navigation happens regardless of mutation result.

This is a bug rather than a direct vulnerability, but it means auth checking relies entirely on the route guard. If the route guard had a bug, the user would reach the gallery without authenticating.

**Fix:**

```typescript
verify.mutate(password, {
  onSuccess: () => navigate({ to: '/chirp/gallery', from: '/chirp/login' }),
});
```

---

### L2. No Content-Type Validation on Fetched URLs

**File:** `backend/services.py:270-278`

**Description:** Downloaded responses are never checked for `Content-Type: image/*` before being passed to PIL/DeepFace. Non-image content (HTML, executables) could trigger unexpected behavior in image parsing libraries.

**Fix:** Check `response.headers.get('content-type', '').startswith('image/')` before processing.

---

### L3. Background Threads — Resource Exhaustion & Inconsistent State

**Files:** `backend/main.py:202,238`, `backend/jobs.py`

**Description:** Scrape jobs use `daemon=True` threads killed abruptly on Cloud Run shutdown. `ThreadPoolExecutor(max_workers=2)` processes images in parallel with no upper bound on per-job image count. Error tracebacks stored as `str(e)[:500]` may contain sensitive internal details.

**Fix:** Consider a proper task queue (Cloud Tasks, Celery). Add a maximum image count per job. Sanitize error messages before storage.

---

### L4. `print()` Used for Logging — No Structured Format

**Files:** `backend/services.py:61`, `backend/database.py:37`, `backend/jobs.py:21`

**Description:** All modules use `print()` for output — no log levels for filtering, no structured JSON format for Cloud Run log aggregation, no ability to filter sensitive data from logs.

**Fix:** Use Python `logging` module or `structlog`.

---

### L5. No Input Length Validation on Text Fields

**File:** `backend/models.py:70-71,140-141`

**Description:** Models like `PersonInsert(name: str)` have no `max_length` constraint. Megabyte-long strings could be stored in the database and returned in every subsequent query.

**Fix:** `name: str = Field(max_length=200)`

---

### L6. `status` Columns Use Free-Form TEXT

**Files:** `backend/sql/create_scrape_tables.sql:8,36`

**Description:** No `CHECK` constraint or ENUM on status columns. Invalid status values can be written if any code path or direct DB access sets an unexpected value.

**Fix:**

```sql
CONSTRAINT valid_job_status CHECK (status IN ('pending', 'scraping', 'processing', 'completed', 'failed'))
```

---

### L7. Search Input Schema Has No Length Limit

**File:** `src/routes/chirp/gallery.tsx:36-39`

**Description:** `search: z.string().optional()` has no maximum length. Extremely long values can be serialized into the URL query string and sent to the backend.

**Fix:** `search: z.string().max(200).optional()`

---

### L8. SQL Functions Missing Explicit `SECURITY INVOKER` Declaration

**File:** `backend/sql/get_image_with_person_matches.sql:5,92`

**Description:** The two large RPC functions (`get_image_with_person_matches` and `get_all_images_with_person_matches`) do not specify `SECURITY DEFINER` or `SECURITY INVOKER`. PostgreSQL defaults to `SECURITY INVOKER` (the safer option), but leaving it implicit risks accidental changes.

**Fix:** Explicitly declare `SECURITY INVOKER` for clarity.

---

### L9. `.dockerignore` Does Not Exclude SQL Scripts

**File:** `backend/.dockerignore`

**Description:** The `sql/` directory is included in the Docker image despite not being needed at runtime, exposing full schema definitions and RPC logic to anyone with access to the container image.

**Fix:** Add `sql/` to `.dockerignore`.

---

### L10. Stale IVFFlat Index Definition in Source

**File:** `backend/sql/detected_face.sql:17`

**Description:** The old IVFFlat index (wrong operator class — uses default `vector_l2_ops` but queries use cosine `<=>`) still exists in the SQL file and could be re-applied accidentally, creating a useless index.

**Fix:** Remove or update the old definition; add a comment referencing the replacement in `create_performance_indexes.sql`.

---

## INFO & Positive Findings

### Positive Security Controls

| #   | Finding                                                                        | Location                    |
| --- | ------------------------------------------------------------------------------ | --------------------------- |
| P1  | Row-Level Security enabled on all Supabase tables                              | Database config             |
| P2  | No `dangerouslySetInnerHTML` anywhere in codebase                              | All `.tsx` files            |
| P3  | No `eval()` or `new Function()` patterns                                       | All source files            |
| P4  | `rel="noopener noreferrer"` on all `target="_blank"` links                     | `gallery.$imageId.tsx:100`  |
| P5  | Route-level auth guards on all protected routes (`beforeLoad`)                 | `gallery.tsx`, `upload.tsx` |
| P6  | 401 interceptor clears token and redirects to login                            | `src/main.tsx`              |
| P7  | JWT secret minimum length (32 chars) enforced at startup                       | `services.py:46-49`         |
| P8  | bcrypt used for password hashing with version-based token invalidation         | `services.py:379-399`       |
| P9  | PIL decompression bomb protection (`MAX_IMAGE_PIXELS = 25M`)                   | `services.py:44`            |
| P10 | Pydantic `HttpUrl` validation on all URL request fields                        | `models.py` (various)       |
| P11 | `.gitignore` properly excludes `.env*`, credentials, keys, PEM files           | `.gitignore`                |
| P12 | TanStack Router DevTools gated behind `import.meta.env.DEV`                    | `src/routes/__root.tsx`     |
| P13 | SSRF protection checks private/loopback/link-local/reserved IPs                | `services.py:64-89`         |
| P14 | CSRF implicitly mitigated by Bearer token auth (not auto-attached by browsers) | `@/lib/api.ts`              |
| P15 | JWT 1-day expiry is reasonable for single-user system                          | `services.py:52`            |

### Informational Notes

| #   | Finding                                                                | Recommendation                                                               |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| I1  | No Content Security Policy (CSP) headers configured                    | Add via Cloudflare `_headers` file to reduce XSS blast radius                |
| I2  | Vite dev proxy to Reddit (`/reddit-api`) appears unused in codebase    | Consider removing from `vite.config.ts`                                      |
| I3  | `/auth/check` has minor timing oracle (JWT decode vs decode+DB lookup) | Negligible risk with HS256; no action needed                                 |
| I4  | Backend error messages from jobs rendered in frontend DOM              | Safe (React escapes JSX text), but ensure backend sanitizes before returning |

---

## Prioritized Remediation Plan

### Phase 0 — Immediate (same day)

| #   | Action                                                                                            | Effort | Findings |
| --- | ------------------------------------------------------------------------------------------------- | ------ | -------- |
| 1   | Add column allowlist + `SET search_path` to `increment_scrape_job` RPC; add Python-side allowlist | 30 min | H2       |
| 2   | Disable FastAPI docs/OpenAPI in production                                                        | 5 min  | M2       |
| 3   | Fix login form `onSuccess` navigation bug                                                         | 5 min  | L1       |
| 4   | Add `Query(ge=1, le=100)` bounds on `limit` param                                                 | 5 min  | M3       |

### Phase 1 — Short-term (1-3 days)

| #   | Action                                                                                               | Effort  | Findings |
| --- | ---------------------------------------------------------------------------------------------------- | ------- | -------- |
| 5   | Patch SSRF: disable auto-redirects, re-validate each hop, pin resolved IPs, block metadata hostnames | 2-3 hrs | H1       |
| 6   | Add download size limits + Content-Type checks to all `requests.get()` calls                         | 1 hr    | H3, L2   |
| 7   | Rate-limit scrape and process-image endpoints                                                        | 30 min  | M6       |
| 8   | Sanitize error messages returned to clients (generic messages, log details server-side)              | 1 hr    | M10      |
| 9   | Add non-root user to Dockerfile                                                                      | 15 min  | M4       |
| 10  | Escape ILIKE metacharacters in search RPC                                                            | 30 min  | M5       |
| 11  | Add `max_length` constraints to Pydantic models                                                      | 30 min  | L5       |
| 12  | Add CHECK constraints on status columns                                                              | 15 min  | L6       |
| 13  | Update Pillow to latest version                                                                      | 15 min  | M12      |

### Phase 2 — Medium-term (1-2 weeks)

| #   | Action                                                        | Effort  | Findings |
| --- | ------------------------------------------------------------- | ------- | -------- |
| 14  | Evaluate migrating JWT from localStorage to httpOnly cookies  | 4-6 hrs | M1       |
| 15  | Add CSP headers via Cloudflare `_headers` file                | 1-2 hrs | I1       |
| 16  | Add `iat`, `jti` claims to JWT                                | 30 min  | M9       |
| 17  | Tighten CORS regex; evaluate removing `allow_credentials`     | 30 min  | M8       |
| 18  | Validate protocol on stored URLs before rendering in frontend | 1 hr    | M11      |
| 19  | Add domain allowlist or tighter controls to scraping feature  | 1-2 hrs | M7       |

### Phase 3 — Longer-term (backlog)

| #   | Action                                                        | Effort   | Findings |
| --- | ------------------------------------------------------------- | -------- | -------- |
| 20  | Migrate background jobs from threads to Cloud Tasks or Celery | 1-2 days | L3       |
| 21  | Switch from `print()` to structured logging                   | 1-2 hrs  | L4       |
| 22  | Add `sql/` to `.dockerignore`                                 | 5 min    | L9       |
| 23  | Remove stale IVFFlat index from `detected_face.sql`           | 5 min    | L10      |
| 24  | Add CI security gates: npm/pip audit, SAST, secret scanning   | 2-4 hrs  | —        |
| 25  | Remove unused Vite dev proxy to Reddit                        | 5 min    | I2       |
| 26  | Add explicit `SECURITY INVOKER` to RPC functions              | 15 min   | L8       |
| 27  | Add `z.string().max(200)` to frontend search schema           | 5 min    | L7       |

---

_Generated by Claude Code — 2026-02-22_
