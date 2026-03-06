# AGENTS.md - GymOS

Operational guide for coding agents in this repository.
Read this first, then `README.md`, then `CLAUDE.md`.

## Snapshot
- Product: gym training OS.
- Backend: FastAPI + async SQLAlchemy + PostgreSQL (`asyncpg`), Python 3.11+.
- Frontend: Next.js 16 App Router + React 19 + TypeScript + Tailwind v4.
- AI boundary: LLM for plan generation only; progression logic is deterministic.

## Cursor/Copilot rules
- Checked: `.cursorrules`, `.cursor/rules/`, `.github/copilot-instructions.md`.
- Current status: none exist.
- If added later, treat them as authoritative and merge guidance here.

## Setup
Backend from repo root:
```bash
pip install -e ".[dev]"
python -m src.main
```

Frontend from `web/`:
```bash
npm install
npm run dev
npm run build
npm run start
```

Full stack (repo root):
```bash
docker-compose up --build
docker-compose logs -f backend
docker-compose logs -f frontend
```

## Lint/format/test
Backend:
```bash
ruff check src tests
ruff format src tests
pytest tests -v
```

Frontend:
```bash
npm run lint
npm run build
```

## Single test commands
```bash
pytest tests/test_progression_engine.py -v
pytest tests/test_progression_engine.py::TestEvaluateAnchor -v
pytest tests/test_progression_engine.py::TestEvaluateAnchor::test_rir_2_plus_increases_weight -v
pytest tests/test_api_input_validation.py -v
pytest tests/test_history_backfill.py -v
pytest tests -k "deload and progression" -v
```

## Data/migrations
```bash
python scripts/seed_db.py
python scripts/backfill_training_type.py
python scripts/migrate_sqlite_to_postgres.py
```

## Required checks before finishing
- Backend-only: `ruff check src tests` + targeted `pytest`.
- Frontend-only: `npm run lint` + `npm run build`.
- Cross-cutting: run both backend and frontend checks.

## Python conventions
- Ruff settings from `pyproject.toml` (`line-length=100`, `py311`).
- Keep imports sorted/grouped (Ruff `I`).
- Use explicit type hints on public functions/handlers.
- Prefer `X | None` over `Optional[X]`.
- Naming: `snake_case` vars/functions, `PascalCase` classes, `UPPER_CASE` constants.
- Keep route handlers thin; move domain logic into `src/services/`.
- Use `logger = logging.getLogger(__name__)`.
- Avoid broad `except Exception` unless required.

## FastAPI/SQLAlchemy conventions
- Validate and normalize at route boundaries.
- Use strict Pydantic request models (`extra="forbid"` where relevant).
- Raise `HTTPException(status_code=..., detail=...)` with actionable details.
- Use async sessions consistently (`async with async_session() as session`).
- Prefer deterministic queries (`select(...)` + explicit `order_by(...)`).
- Commit once per logical mutation block.
- Preserve soft-delete behavior where already used.

## TypeScript/React conventions
- TS `strict` is enabled; avoid `any`.
- Prefer `@/*` alias for local imports.
- Keep API contracts centralized in `web/lib/api.ts`.
- Keep backend-compatible field names (`snake_case` in API interfaces is acceptable).
- Naming: `PascalCase` for components/types, `camelCase` for vars/functions.
- Keep mobile-first layouts and avoid horizontal overflow.

## Contracts and product invariants
- Do not break route paths/payload shapes unless requested.
- If backend payload changes, update `web/lib/api.ts` in same change.
- Root route redirects to `/today`.
- History UX is under `/settings`.
- Progression decisions remain deterministic.
- Keep proxy compatibility in `web/app/api/[...path]/route.ts`.

## Supabase notes
- Auth via Supabase JWT when `AUTH_ENABLED=true`.
- RLS SQL templates: `supabase/rls.sql`.
- Storage SQL templates: `supabase/storage.sql`.
- Profile photos use Supabase Storage bucket `profile-photos`.
