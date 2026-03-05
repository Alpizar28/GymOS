# GymOS AGENTS Guide

Operational guide for agentic coding in this repo.
Pair with `CLAUDE.md` for domain context.

## Scope and stack

- Product: single-tenant gym training system (one athlete model).
- Backend: FastAPI + async SQLAlchemy + SQLite (aiosqlite), Python 3.11+.
- Frontend: Next.js 16 App Router + React 19 + TypeScript + Tailwind.
- Planning: OpenAI-assisted plan generation, deterministic progression logic.

## Repository map (short)

```text
GymOS/
├── src/                 # backend app
│   ├── api/routes.py    # REST endpoints
│   ├── services/        # business logic
│   ├── models/          # SQLAlchemy models
│   ├── database.py      # engine/session/init
│   └── main.py          # app entrypoint
├── tests/               # pytest suite
├── scripts/             # seeding and data scripts
├── web/                 # Next.js app
│   ├── app/             # routes/pages
│   ├── lib/api.ts       # typed frontend API client
│   ├── eslint.config.mjs
│   └── tsconfig.json
├── pyproject.toml
└── docker-compose.yaml
```

## Build, lint, and test commands

Run backend commands from repo root (`GymOS/`).

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

Docker (from repo root):

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

# single test function
pytest tests/test_progression_engine.py::TestEvaluateAnchor::test_rir_2_plus_increases_weight -v

# pattern-based subset
pytest tests -k "deload and progression" -v
```

Frontend test runner is not configured in `web/package.json`.
If you add frontend tests, document exact single-test commands here.

## Required checks before finishing

- Backend-only changes: `ruff check src tests` and targeted `pytest`.
- Frontend changes: `npm run lint` and `npm run build` in `web/`.
- Cross-cutting changes: run both backend and frontend checks above.

## Python style and conventions

- Follow Ruff settings in `pyproject.toml` (`line-length = 100`, py311).
- Imports: stdlib, third-party, local; use Ruff `I` rules (sorted, grouped).
- Type hints: explicit for public functions and return types.
- Union style: `X | None` instead of `Optional[X]`.
- Naming: `snake_case` for functions/vars, `PascalCase` for classes.
- Constants: UPPER_SNAKE_CASE at module scope.
- Logging: `logger = logging.getLogger(__name__)` per module.
- Errors: avoid broad `except Exception` unless adding context and re-raising.
- Keep route handlers thin; put logic in `src/services/`.
- Input handling: validate/normalize at route boundaries.
- Async DB: use `async with async_session()` consistently.
- Idempotency: preserve where endpoints are retried (today logging, completes).

## FastAPI / SQLAlchemy practices

- Define Pydantic request/response models near endpoint usage.
- Return typed payloads where feasible (`-> dict`, `-> list[Model]`).
- Use `select(...)` queries and explicit ordering for deterministic responses.
- Prefer a single commit per logical mutation block.
- Maintain single-tenant assumptions (`AthleteState` id=1).
- For API errors, raise `HTTPException(status_code=..., detail=...)`.

## TypeScript / React conventions

- TypeScript strict mode is enabled; avoid `any`.
- Prefer `unknown` + narrowing over `any` for dynamic data.
- Imports: use `@/*` alias for app-local modules when practical.
- Keep API contracts centralized in `web/lib/api.ts`.
- Match backend field names in API payloads (snake_case allowed in TS interfaces).
- Naming: `PascalCase` for components/types, `camelCase` for vars/functions.
- Prefer functional components and hooks; avoid class components.
- Handle async errors with user-visible fallbacks (toasts/messages) when needed.
- Keep UI mobile-first; prevent horizontal overflow regressions.

## Error handling and resilience

- Use 4xx for client input issues, 5xx for server failures.
- Provide actionable `detail` messages in API exceptions.
- Guard date parsing and JSON parsing paths.
- Preserve fallback behavior for LLM plan generation.

## Naming and API contract rules

- Preserve existing public API routes and payload shapes unless requested.
- If you change a backend contract, update `web/lib/api.ts` in the same change.
- Use domain-specific names (anchor, routine, set, fatigue).

## Product constraints to preserve

- Progression logic stays deterministic (no LLM decisions).
- LLM can suggest plans, but persistence flows through backend services/routes.
- Maintain proxy compatibility in `web/app/api/[...path]/route.ts`.

## Cursor/Copilot rule files

Checked locations:
- `.cursorrules`
- `.cursor/rules/`
- `.github/copilot-instructions.md`

Current status: none of these files exist in this repository.
If any are added later, treat them as authoritative and merge their guidance here.
