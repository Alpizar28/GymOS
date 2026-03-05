# GymOS AGENTS Guide

This file is the operational guide for coding agents in this repo.
Use it together with `README.md` and `CLAUDE.md` for deeper product context.

## Scope and stack

- Product: single-tenant gym training system (one athlete model).
- Backend: FastAPI + async SQLAlchemy + SQLite (`aiosqlite`), Python 3.11+.
- Frontend: Next.js 16 App Router + React 19 + TypeScript + Tailwind.
- Planning: OpenAI-assisted plan generation, deterministic progression logic.

## Repository map

```text
GymOS/
├── src/                  # backend app
│   ├── api/routes.py     # REST endpoints
│   ├── services/         # business logic
│   ├── models/           # SQLAlchemy models
│   ├── database.py       # engine/session/init
│   └── main.py           # app entrypoint
├── tests/                # pytest suite
├── scripts/              # seeding and data scripts
├── web/                  # Next.js app
│   ├── app/              # routes/pages
│   ├── lib/api.ts        # typed frontend API client
│   ├── eslint.config.mjs
│   └── tsconfig.json
├── pyproject.toml
└── docker-compose.yaml
```

## Build, lint, and test commands

Run backend commands from repository root (`GymOS/`).

```bash
pip install -e ".[dev]"
python -m src.main
ruff check src tests
ruff format src tests
pytest tests -v
python scripts/seed_db.py
python scripts/backfill_training_type.py
rm -f gym.db && python scripts/seed_db.py
```

Run frontend commands from `web/`.

```bash
npm install
npm run dev
npm run build
npm run start
npm run lint
```

Run full stack with Docker from repository root.

```bash
docker-compose up --build
docker-compose logs -f backend
docker-compose logs -f frontend
```

## Running a single test (important)

Backend tests use `pytest`.

```bash
# single file
pytest tests/test_progression_engine.py -v

# validation / security focused tests
pytest tests/test_api_input_validation.py -v
pytest tests/test_history_backfill.py -v

# single test function
pytest tests/test_progression_engine.py::TestEvaluateAnchor::test_rir_2_plus_increases_weight -v

# pattern-based subset
pytest tests -k "deload and progression" -v
```

Frontend test runner is not currently configured in `web/package.json`.
If you add frontend tests, document exact single-test commands here.

## Required checks before finishing

- Backend-only changes: `ruff check src tests` and targeted `pytest`.
- Frontend changes: `npm run lint` and `npm run build` in `web/`.
- Cross-cutting changes: run both backend and frontend checks above.

## Python style guidelines

- Follow Ruff settings in `pyproject.toml` (`line-length = 100`, py311).
- Keep imports sorted/grouped (Ruff `I` rules are enabled).
- Prefer explicit type hints for public functions and return types.
- Use `X | None` style unions (not `Optional[X]`).
- Keep route handlers thin; move domain logic into `src/services/`.
- Use async DB flows (`async with async_session()`) consistently.
- For API errors, raise `HTTPException(status_code=..., detail=...)`.
- Validate/normalize user input at route boundaries.
- Use small helper functions for repeated normalization/transforms.
- Prefer clear names: `snake_case` for functions/vars, `PascalCase` for classes.
- Keep constants uppercase (e.g., `HIDDEN_SYSTEM_TEMPLATE_NAMES`).
- Use module logger pattern: `logger = logging.getLogger(__name__)`.
- Avoid broad `except Exception` unless re-raising with context is required.
- Keep writes idempotent where endpoints are expected to be retried.

## FastAPI and SQLAlchemy conventions

- Define request/response payloads with Pydantic models close to endpoint usage.
- Return typed payloads from handlers where feasible (`-> dict`, `-> list[Model]`).
- Use `select(...)` queries and explicit ordering for deterministic responses.
- Prefer soft-delete flags where already established (`is_deleted`) over hard deletes.
- Commit once per logical mutation block; avoid partial commits.
- Preserve single-tenant assumptions (`AthleteState` singleton behavior).

## TypeScript/React style guidelines

- TypeScript strict mode is enabled; do not bypass with `any` without strong reason.
- Use `@/*` import alias for app-local imports when practical.
- Keep shared API contracts and client calls centralized in `web/lib/api.ts`.
- Match backend field naming for API payloads (`snake_case` allowed in TS interfaces).
- Use `PascalCase` for components/types and `camelCase` for variables/functions.
- Prefer functional components and hooks.
- Keep state transitions explicit; avoid hidden mutable state.
- Handle async errors with user-visible fallbacks (toasts/messages) where needed.
- Keep UI mobile-first; avoid horizontal overflow regressions.
- Reuse established design tokens (dark zinc surfaces + red accents).

## Naming and API contract rules

- Preserve existing public API routes and payload shapes unless requested.
- If you change a backend contract, update `web/lib/api.ts` in the same change.
- Use descriptive names reflecting gym domain concepts (anchor, routine, set, fatigue).
- Keep normalization helpers near their usage when scope is local.

## Error handling and resilience

- Favor explicit 4xx errors for client input issues and 5xx for server failures.
- Include actionable `detail` messages in API exceptions.
- Guard date parsing and JSON parsing paths.
- Keep fallback behavior intact where present (e.g., plan generation fallback paths).

## Product constraints to preserve

- Root route redirects to `/today`.
- History experience is centered under `/settings`.
- Progression logic remains deterministic (no LLM decisions there).
- LLM can suggest plans, but persistence must flow through backend services/routes.
- Keep proxy compatibility in `web/app/api/[...path]/route.ts`.

## Current feature notes (Mar 2026)

- Routines support explicit `training_type` (`push|pull|legs|custom`) on create/update.
- Today logging can persist `training_type` into workouts.
- History supports:
  - type filters,
  - weekly compare,
  - intensity legend,
  - local preference persistence.
- Backfill tools are available for historical classification:
  - API: `POST /api/history/backfill-training-type`
  - API stats: `GET /api/history/training-type-stats`
  - CLI: `python scripts/backfill_training_type.py`

## Cursor/Copilot rule files

Checked locations:
- `.cursorrules`
- `.cursor/rules/`
- `.github/copilot-instructions.md`

Current status: none of these files exist in this repository.
If any are added later, treat them as authoritative and merge their guidance here.
