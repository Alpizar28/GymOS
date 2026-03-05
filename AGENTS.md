# GymOS — Agent Context

This file is the primary reference for coding agents working in this repository.
For deeper architecture rationale, also read `CLAUDE.md`.

---

## Project Snapshot

GymOS is a single-tenant training system for one athlete.

Core stack:
- Backend: FastAPI + SQLAlchemy async (Python 3.11+)
- Frontend: Next.js 16 App Router + React 19 + Tailwind
- Database: SQLite (`aiosqlite`)
- Plan generation: OpenAI (planner), deterministic progression engine for rules

Current product direction:
- Mobile-first UX
- Dark theme with red accents
- Root route redirects to `/today` (no standalone Home/Dashboard screen)
- History is unified under `/settings` (calendar + streak + daily drill-down)

---

## Repository Layout

```text
GymOS/
├── src/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── api/routes.py
│   ├── llm/
│   ├── models/
│   └── services/
├── web/
│   ├── app/
│   ├── lib/api.ts
│   ├── package.json
│   └── tsconfig.json
├── tests/
├── scripts/
├── data/
├── mejoras/
├── docker-compose.yaml
├── Dockerfile.backend
├── Dockerfile.frontend
└── CLAUDE.md
```

Notes:
- `mejoras/` contains roadmap docs by horizon (`proximas`, `mediano`, `largo`).
- `web/README.md` is frontend-scaffold level; root `README.md` is product/project level.

---

## Key Routes (Frontend)

- `/today` — main training flow (step-based, focus mode, draft persistence)
- `/routines` — routine folders and cards
- `/routines/[id]` — routine detail/edit/start/share + anchor progression preview/apply
- `/settings` — unified history (summary/detail calendar + streak + selected-day session drill-down)
- `/profile` — personal data + stats + library + protections
- `/workouts` — workout records list
- `/progress` — legacy standalone streak page (not primary nav)
- `/` — redirects to `/today`

---

## Commands

### Backend

```bash
pip install -e ".[dev]"
python -m src.main

pytest tests/ -v
ruff check src/
ruff format src/

python scripts/seed_db.py
rm -f gym.db && python scripts/seed_db.py
```

### Frontend

Run from `web/`:

```bash
npm install
npm run dev
npm run build
npm run start
npm run lint
```

### Docker

```bash
docker-compose up --build
docker-compose logs -f backend
```

---

## Coding Standards

## Python
- Async-first for routes/services/DB interactions.
- Use full type hints (`int | None`, `str | None`).
- Raise `HTTPException` in routes with explicit status/detail.
- Keep business logic in `services/`, not inline in route handlers.
- Use module loggers (`logging.getLogger(__name__)`).

## TypeScript / React
- Put shared interfaces and API methods in `web/lib/api.ts`.
- Use strict typing; avoid `any`.
- Keep page-local UI helpers in same file when scope is local.
- Prefer predictable state with hooks; avoid adding external state libs unless justified.

---

## Visual System (Current)

- Theme: dark-only
- Base surfaces: `zinc-950 / 900 / 800`
- Primary accent: `red-600 / red-500`
- Borders: `zinc-700/800`
- Typography: Inter (+ JetBrains Mono for numeric values)
- Interaction: mobile-first, touch-friendly controls, minimal noise, high readability

Avoid introducing new color families unless there is a strong UX reason.

---

## Product Constraints

- Single-tenant athlete model (no multi-user auth architecture currently).
- Progression logic must remain deterministic.
- Routine progression preview/apply is deterministic and history-based (no LLM call in that flow).
- LLM proposes plans; DB mutations happen through backend services/routes only.
- Keep backward-safe behavior in API proxy (`web/app/api/[...path]/route.ts`) for Coolify.

---

## Data Hygiene

- DB startup runs lightweight hygiene (`src/services/db_maintenance.py`):
  - checks/creates performance indexes,
  - dedupes cached `plan_days` by `(date, template_day_name)` keeping the newest row,
  - removes orphan `plans` rows without `plan_days`.
- Keep idempotent write paths in routes (`/today/log`, `/today/complete`) to avoid duplicate logical records.

---

## Testing and Safety

- Always run `npm run build` for frontend changes.
- Run targeted Python compile/tests for backend route/model changes.
- Prefer additive migrations/changes over destructive rewrites.
- Keep mobile behavior stable (no horizontal overflow, no accidental zoom regressions).
