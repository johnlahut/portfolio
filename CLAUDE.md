# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (React/Vite)

- `npm run dev` — Start dev server (port 5173)
- `npm run build` — Type-check with `tsc -b` then build with Vite
- `npm run lint` — ESLint
- `npm run format` — Prettier auto-format

### Backend (FastAPI/Python)

- `cd backend && uvicorn main:app --reload` — Start API server
- `pip install -r backend/requirements.txt` — Install Python deps
- `npm run backend:lint` — Ruff lint check
- `npm run backend:format` — Ruff auto-format
- Backend uses a `.env` file with `SUPABASE_URL`, `SUPABASE_KEY`, and `JWT_SECRET`

### shadcn/ui

- `npx shadcn add <component>` — Add a shadcn component

## Architecture

### Frontend

- **React 19 + Vite 7 + TypeScript** SPA
- **TanStack Router** for file-based routing (`src/routes/`). Route tree is auto-generated in `src/routeTree.gen.ts` — don't edit manually. The router plugin runs via `@tanstack/router-plugin/vite`.
- **TanStack Query** for server state, configured with `staleTime: Infinity` (no auto-refetch).
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin (no `tailwind.config` — uses CSS-based config in `src/index.css`).
- **shadcn/ui** components live in `@/components/ui/`. Uses `radix-mira` style, Lucide icons. The `@/` path alias maps to the top-level `@/` directory (not `src/`).
- **Path aliases**: `~/*` resolves to `src/*` (e.g., `import { foo } from '~/chirp/api'`), `@/*` resolves to `./@/*`. Configured in `tsconfig.app.json` and resolved at build time by `vite-tsconfig-paths`.
- **Prettier** with `singleQuote`, `trailingComma: 'all'`, and `@trivago/prettier-plugin-sort-imports` for auto-sorting imports.

### Routes / Features

- `/` — Index/home
- `/transformer` — "Navo" — code transformer tool using TipTap editor and web-tree-sitter for syntax parsing
- `/chirp` — Face recognition image browser backed by the Python API
- `/chirp/login` — Auth gate (uses `chirp_.login.tsx` pathless layout pattern)
- `/chirp/image/$imageId` — Single image detail with face bounding boxes

### Backend

- **FastAPI** app in `backend/main.py` with service layer in `services.py` and DB layer in `database.py`.
- **Supabase** (PostgreSQL) as the database, accessed via `supabase-py`. Uses a custom `portfolio` schema.
- **DeepFace** / `face_recognition` for face detection and encoding.
- Vite dev server proxies `/reddit-api` to `reddit.com` for scraping.

### Key Directories

- `src/chirp/` — Chirp feature module (API client, components, hooks, types)
- `src/transformer/` — Navo transformer feature module
- `@/components/ui/` — shadcn/ui primitives
- `lib/api.ts` — shared axios client (auth interceptor, token management)
- `lib/utils.ts` — shared utilities (cn helper etc.)
- `backend/sql/` — SQL scripts (RPCs, migrations)
- `backend/scripts/` — One-off Python scripts

## Linting & Formatting

Pre-commit hooks run automatically via **Husky + lint-staged** on every commit:

- `*.{ts,tsx}` — ESLint `--fix` then Prettier `--write`
- `*.py` — Ruff `check --fix` then Ruff `format`

Backend linting uses **Ruff** configured in `backend/ruff.toml` (line-length 88, Python 3.12, rules: E/F/I).

## Deployment

### Frontend

- **Cloudflare Pages** — auto-deploys from git. Set `VITE_API_URL` env var to the backend service URL.

### Backend (Google Cloud Run)

- **Docker image** built from `backend/Dockerfile`.
- `gcloud run deploy chirp-api --source=. --region=us-central1 --memory=2Gi --min-instances=0 --max-instances=2 --port=8080` (run from `backend/`)
- Required env vars: `SUPABASE_URL`, `SUPABASE_KEY`, `JWT_SECRET` (set via `--set-env-vars` or Cloud Run console).
