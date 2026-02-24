# Upload Scraper — Implementation Plan

## Overview

A new "Uploads" page in Chirp that lets users paste a URL, trigger a scrape + face-processing job, and monitor progress in real time. Today the scrape→process pipeline only runs as a CLI script (`backend/scripts/scrape_faces.py`). This plan promotes it to a first-class backend feature with job persistence, background execution, and a polling-based frontend.

---

## 1. Data Model (Supabase / PostgreSQL)

### New table: `portfolio.scrape_job`

Top-level record per submitted URL. Tracks overall status and aggregate progress.

| Column            | Type                                    | Notes                                                          |
| ----------------- | --------------------------------------- | -------------------------------------------------------------- |
| `id`              | `uuid` PK (default `gen_random_uuid()`) |                                                                |
| `url`             | `text NOT NULL`                         | The page URL submitted by the user                             |
| `status`          | `text NOT NULL DEFAULT 'pending'`       | `pending` → `scraping` → `processing` → `completed` / `failed` |
| `total_images`    | `int`                                   | Set after scrape step discovers image URLs                     |
| `processed_count` | `int DEFAULT 0`                         | Incremented as each image finishes successfully                |
| `failed_count`    | `int DEFAULT 0`                         | Incremented on per-image failure                               |
| `error`           | `text`                                  | Top-level error message if the whole job fails                 |
| `created_at`      | `timestamptz DEFAULT now()`             |                                                                |
| `updated_at`      | `timestamptz DEFAULT now()`             |                                                                |

### Lightweight tracking: `portfolio.scrape_job_item`

Thin join table — only tracks the URL, its processing status, and a FK to the resulting `image` row. All rich data (face_count, dimensions, source_url, etc.) lives in the existing `image` + `detected_face` tables and is queried through them.

| Column       | Type                                        | Notes                                                        |
| ------------ | ------------------------------------------- | ------------------------------------------------------------ |
| `id`         | `uuid` PK (default `gen_random_uuid()`)     |                                                              |
| `job_id`     | `uuid FK → scrape_job.id ON DELETE CASCADE` |                                                              |
| `source_url` | `text NOT NULL`                             | The discovered image URL                                     |
| `status`     | `text NOT NULL DEFAULT 'queued'`            | `queued` → `processing` → `completed` / `skipped` / `failed` |
| `image_id`   | `uuid FK → image.id`                        | Set on success — links to the canonical image record         |
| `error`      | `text`                                      | Per-item error message (null on success)                     |

### Design rationale

- **No duplication of image data.** Face count, dimensions, filename all live in the existing `image` table. The item row just points to it via `image_id`.
- **`skipped` status** handles images that already exist — the worker checks `get_image_by_source_url()` (already implemented in `database.py`). If found, the item is marked `skipped` with `image_id` set to the existing record.
- **Counts on the job row** (`processed_count`, `failed_count`) are incremented atomically by the worker so the list endpoint can return progress without joining/counting item rows.
- **Derived counts**: `queued = total_images - processed_count - failed_count - skipped_count`. We can either add a `skipped_count` column or derive it from `total_images - processed_count - failed_count - (SELECT count(*) FROM item WHERE status='skipped')`. Adding `skipped_count` to the job row is simpler.

**Addition to `scrape_job`:**

| Column          | Type            | Notes                       |
| --------------- | --------------- | --------------------------- |
| `skipped_count` | `int DEFAULT 0` | Images that already existed |

---

## 2. Backend — New Endpoints

All endpoints require auth (`Depends(require_auth)`).

### `POST /scrape-jobs` — Create a new job

**Request:** `{ "url": "https://example.com/gallery" }`

**Flow:**

1. Validate URL (SSRF check via existing `validate_url`)
2. Insert a `scrape_job` row with `status = 'pending'`
3. Kick off the background task (see §3)
4. Return the job record immediately (**202 Accepted**)

**Response:**

```json
{ "id": "uuid", "url": "...", "status": "pending", "created_at": "..." }
```

### `GET /scrape-jobs` — List all jobs

Returns all scrape jobs ordered by `created_at DESC`. Progress counts come directly from the job row (no joins needed).

**Response:**

```json
{
  "jobs": [
    {
      "id": "...",
      "url": "...",
      "status": "processing",
      "total_images": 32,
      "processed_count": 14,
      "skipped_count": 3,
      "failed_count": 1,
      "created_at": "..."
    }
  ]
}
```

### `GET /scrape-jobs/{job_id}` — Single job with item details

Returns the job plus its `scrape_job_item` rows. For completed/skipped items, the `image_id` FK lets the frontend link to the image detail page or show a thumbnail via the existing `source_url` on the `image` table.

**Response:**

```json
{
  "id": "...",
  "url": "...",
  "status": "processing",
  "total_images": 32,
  "processed_count": 14,
  "skipped_count": 3,
  "failed_count": 1,
  "items": [
    {
      "id": "...",
      "source_url": "example.com/img1.jpg",
      "status": "completed",
      "image_id": "uuid-of-image-record"
    },
    {
      "id": "...",
      "source_url": "example.com/img2.jpg",
      "status": "processing",
      "image_id": null
    }
  ]
}
```

The frontend can look up face count and thumbnail from the `image_id` via the existing images cache (already loaded by `useImages`).

### `POST /scrape-jobs/{job_id}/retry` — Retry failed items

Resets all `failed` item rows back to `queued`, resets the job's `failed_count` to 0, sets job status to `processing`, and re-triggers the background worker for the remaining queued items.

### `DELETE /scrape-jobs/{job_id}` — Delete a job

Deletes the job and cascades to its items. Does **not** delete the images that were successfully processed (they remain in the gallery).

---

## 3. Background Processing — Approach

### FastAPI `BackgroundTasks` (v1)

FastAPI's built-in `BackgroundTasks` runs work in a thread pool within the same process. Zero new infrastructure.

**Concurrency model:**

- **1 job processes at a time.** A simple in-memory lock (`asyncio.Lock` or `threading.Lock`) gates the worker — when a job finishes, it checks for the next `pending` job and starts it.
- **2 image workers per job.** Within a running job, a `ThreadPoolExecutor(max_workers=2)` processes images in parallel.
- New submissions while a job is running create a `pending` row. The worker loop picks them up in FIFO order.

**`run_scrape_job(job_id)` flow:**

1. Acquire the job lock (if another job is running, this one stays `pending` and gets picked up when the lock is released)
2. Update job status → `scraping`
3. Call `scrape_images(url)` to discover image URLs
4. Bulk insert `scrape_job_item` rows (one per URL, status = `queued`)
5. Update job: `total_images = len(items)`, status → `processing`
6. Process items with `ThreadPoolExecutor(max_workers=2)`:
   - Update item status → `processing`
   - Check if image already exists via `get_image_by_source_url(source_url)`
     - **If exists:** set item `image_id`, status → `skipped`, increment job `skipped_count`
     - **If new:** call `detect_and_save_face()`, set item `image_id`, status → `completed`, increment job `processed_count`
     - **On error:** set item error + status → `failed`, increment job `failed_count`
7. After all items: update job status → `completed` (or `failed` if zero succeeded)
8. Release the lock, check for next `pending` job, and start it if found

**Trade-offs:**

- (+) Zero new dependencies or infrastructure
- (+) Works within the existing Cloud Run container
- (+) 2-worker parallelism balances throughput vs. memory (DeepFace is heavy)
- (-) Jobs lost if container restarts mid-processing (Cloud Run can scale to zero)
- (-) ML workload on same instance as API

**Restart resilience:** On app startup, query for jobs stuck in `scraping` or `processing` and mark them `failed` with error "Server restarted — use Retry to resume". The retry button lets users pick back up.

### Future upgrade path: Cloud Run Jobs

For production-grade durability, extract the processing loop into a separate Cloud Run Job triggered via Cloud Tasks or Pub/Sub. Not needed for v1.

---

## 4. Frontend Polling Strategy

The frontend polls `GET /scrape-jobs/{job_id}` to track progress. No WebSockets.

### Polling behavior

| Job status             | Poll interval | Stop condition                              |
| ---------------------- | ------------- | ------------------------------------------- |
| `pending`, `scraping`  | 2s            | Job transitions to `processing` or terminal |
| `processing`           | 3s            | Job reaches `completed` or `failed`         |
| `completed` / `failed` | Stop polling  | —                                           |

### TanStack Query implementation

```ts
useQuery({
  queryKey: ['scrape-job', jobId],
  queryFn: () => getScrapeJob(jobId),
  refetchInterval: (query) => {
    const status = query.state.data?.status;
    if (status === 'completed' || status === 'failed') return false;
    if (status === 'processing') return 3000;
    return 2000;
  },
});
```

On job completion → invalidate the `images` query so the gallery reflects new photos.

---

## 5. Frontend — New Route & Components

### Route: `/chirpv2/uploads`

Child route of `/chirpv2` (nested under sidebar layout), accessible via "Uploads" sidebar nav item.

### Page layout (from Pencil mockup)

```
┌─────────────────────────────────────────────────────────────┐
│  Header: "Website Photo Scraper"     [+ Add Person] [Manage]│
│  subtitle text                                              │
├─────────────────────────────────────────────────────────────┤
│  [🔗 URL input ................................] [Scrape ▶] │
│  [Queued: 24] [Processing: 8] [Completed: 192]   hint text │
├─────────────────────────────────────────────────────────────┤
│  Preview | Source URL          | Faces | Status   | Actions │
│  --------|---------------------|-------|----------|---------|
│  [thumb] | example.com/summer  | 14    | ✅ Done  | Review  │
│  [thumb] | schoolblog.org/...  | 9     | ⏳ 42%  | Open    │
│  [thumb] | kidsjournal.net/... | 0     | 🔘 Queue | Cancel  │
│  [thumb] | legacysite.com/...  | -     | ❌ Fail  | Retry   │
└─────────────────────────────────────────────────────────────┘
```

### Components to create

| Component           | File                                        | Description                                                       |
| ------------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| `UploadScraperPage` | `src/routes/chirpv2/uploads.tsx`            | Route component — URL input, summary chips, results table         |
| `ScrapeJobTable`    | `src/chirp/components/ScrapeJobTable.tsx`   | Table of item rows for a single job                               |
| `ScrapeStatusChip`  | `src/chirp/components/ScrapeStatusChip.tsx` | Reusable status pill (queued/processing/completed/failed/skipped) |

### Status chip styles — mapped to existing theme tokens

The mockup chips map closely to our existing theme colors and Tailwind palette. No new CSS tokens needed.

| Status         | Classes                                                        |
| -------------- | -------------------------------------------------------------- |
| **Queued**     | `bg-chirp-surface border-chirp-border/30 text-chirp-text-body` |
| **Processing** | `bg-[#382916] border-amber-400/36 text-amber-300`              |
| **Completed**  | `bg-[#173229] border-emerald-400/33 text-emerald-400`          |
| **Skipped**    | `bg-chirp-surface border-chirp-border/30 text-chirp-text-dim`  |
| **Failed**     | `bg-[#351E23] border-rose-400/36 text-rose-300`                |

> Note: `bg-[#382916]`, `bg-[#173229]`, and `bg-[#351E23]` are the same values already used in `FaceStateChip`. These are tinted dark backgrounds that don't correspond to a named token — they're status-specific and used inline in both components. If we want to consolidate, we could add `--chirp-status-*` tokens, but given they're only used in chip variants it's fine as arbitrary values.

### Table row styles

| Element       | Classes                                                     |
| ------------- | ----------------------------------------------------------- |
| Header row bg | `bg-chirp-panel` (existing `#18161A`)                       |
| Header text   | `text-chirp-text-muted`                                     |
| Row bg        | `bg-chirp-grid` (existing `#131116`)                        |
| Row border    | `border-chirp-border/20`                                    |
| URL text      | `text-chirp-text`                                           |
| Faces count   | `text-chirp-text-body`                                      |
| Action links  | `text-chirp-text` on hover, `text-chirp-text-body` default  |
| Thumbnail     | `bg-chirp-surface border border-chirp-border/30 rounded-lg` |

### Sidebar update

Add "Uploads" nav item to `GallerySidebar.tsx` with the `Upload` lucide icon. Links to `/chirpv2/uploads`. Highlights when the current route matches.

---

## 6. File Changes Summary

### SQL (new)

| File                                   | Purpose                                                     |
| -------------------------------------- | ----------------------------------------------------------- |
| `backend/sql/create_scrape_tables.sql` | Migration: create `scrape_job` and `scrape_job_item` tables |

### Backend (new)

| File              | Purpose                                         |
| ----------------- | ----------------------------------------------- |
| `backend/jobs.py` | Background job runner: `run_scrape_job(job_id)` |

### Backend (modified)

| File                  | Changes                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| `backend/main.py`     | Add 4 new endpoints (`POST/GET /scrape-jobs`, `GET /scrape-jobs/{id}`, `POST .../retry`, `DELETE`) |
| `backend/services.py` | Add `create_scrape_job`, `get_scrape_jobs`, `get_scrape_job`, `retry_scrape_job`                   |
| `backend/database.py` | Add CRUD for `scrape_job` + `scrape_job_item`                                                      |
| `backend/models.py`   | Add Pydantic models: `ScrapeJob`, `ScrapeJobItem`, `ScrapeJobDetail`, `CreateScrapeJobRequest`     |

### Frontend (new)

| File                                        | Purpose            |
| ------------------------------------------- | ------------------ |
| `src/routes/chirpv2/uploads.tsx`            | Uploads route page |
| `src/chirp/components/ScrapeJobTable.tsx`   | Results table      |
| `src/chirp/components/ScrapeStatusChip.tsx` | Status pill        |

### Frontend (modified)

| File                                      | Changes                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| `src/chirp/api.ts`                        | Add scrape-job endpoints                                                       |
| `src/chirp/hooks.ts`                      | Add `useScrapeJobs`, `useScrapeJob`, `useCreateScrapeJob`, `useRetryScrapeJob` |
| `src/chirp/types.ts`                      | Add `ScrapeJob`, `ScrapeJobItem` types                                         |
| `src/chirp/components/GallerySidebar.tsx` | Add "Uploads" nav link                                                         |

---

## 7. Implementation Order

1. **SQL migration** — Create `scrape_job` + `scrape_job_item` tables in Supabase
2. **Backend models** — Add Pydantic schemas for job + item
3. **Backend database layer** — CRUD for both tables
4. **Backend jobs** — `run_scrape_job` background worker
5. **Backend endpoints** — Wire up the 4 new routes in `main.py`
6. **Frontend types + API** — TypeScript types and API client functions
7. **Frontend hooks** — TanStack Query hooks with polling
8. **Frontend components** — ScrapeStatusChip, ScrapeJobTable
9. **Frontend route** — `/chirpv2/uploads` page (UploadScraperPage)
10. **Sidebar update** — Add "Uploads" nav item to GallerySidebar
11. **Testing** — End-to-end: submit URL → watch progress → verify images appear in gallery

---

## 8. Decisions (resolved)

- [x] **Job history retention**: Auto-cleanup completed/failed jobs older than **7 days**. A DB-level cron (pg_cron or app-startup sweep) deletes `scrape_job` rows where `created_at < now() - interval '7 days'` and status is terminal. Cascade deletes the items.
- [x] **Concurrent job limit**: **1 job actively processing at a time**, but multiple can be queued. When a new job is submitted while another is running, it enters `pending` and the worker picks it up after the current one finishes. Image processing within a job uses a **`ThreadPoolExecutor(max_workers=2)`** for parallelism.
- [x] **Duplicate URL handling**: Allow re-scrape, but show a **warning** in the UI if the same page URL has been submitted before ("This URL was scraped N days ago — most images may be skipped"). The backend does not block it. Existing images get `skipped` status; new images on the page get processed normally.
- [x] **Image preview thumbnails**: Use the **`source_url` directly** (served from the original host). No image hosting on our side for v1. Accept the performance trade-off.
- [x] **Mobile layout**: **Desktop only for v1**. Mobile mockup will be designed in Pencil after the feature is working.
