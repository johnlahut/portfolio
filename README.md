# Portfolio

Personal portfolio app with two main features:

- **Navo** (`/transformer`) -- Code transformer tool using a TipTap editor and web-tree-sitter for syntax parsing
- **Chirp** (`/chirp`) -- Face recognition image browser for identifying people in daycare photos, backed by a Python API with DeepFace

## Tech Stack

### Frontend

- React 19 + TypeScript + Vite 7
- TanStack Router (file-based routing) + TanStack Query
- Tailwind CSS v4 + shadcn/ui
- Framer Motion (motion/react)

### Backend

- FastAPI + Uvicorn
- Supabase (PostgreSQL)
- DeepFace / face_recognition for face detection and encoding
- Deployed on Google Cloud Run

## Getting Started

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
cd backend && uvicorn main:app --reload
```

The backend requires a `.env` file in `backend/` with `SUPABASE_URL`, `SUPABASE_KEY`, and `JWT_SECRET`.

## Scripts

| Command                  | Description                           |
| ------------------------ | ------------------------------------- |
| `npm run dev`            | Start frontend dev server (port 5173) |
| `npm run build`          | Type-check + production build         |
| `npm run lint`           | ESLint                                |
| `npm run format`         | Prettier auto-format                  |
| `npm run backend:lint`   | Ruff lint check                       |
| `npm run backend:format` | Ruff auto-format                      |

Pre-commit hooks (Husky + lint-staged) run ESLint/Prettier on `*.{ts,tsx}` and Ruff on `*.py` automatically.
