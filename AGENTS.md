# AGENTS.md - GymOS

Operational guide for coding agents working in this repository.
Read in this order: `AGENTS.md` -> `README.md` -> `CLAUDE.md`.

## 1) Repo snapshot
- Product: GymOS (training plans, deterministic progression, logging, analytics).
- Backend: FastAPI + async SQLAlchemy + PostgreSQL (`asyncpg`) on Python 3.11+.
- Frontend: Next.js 16 App Router + React 19 + TypeScript (`strict`) + Tailwind v4.
- Auth/storage: Supabase JWT auth + Supabase Storage bucket `profile-photos`.
- AI boundary: LLM generates plans; progression logic is deterministic and rule-based.

## 2) Cursor/Copilot rules status
- Checked for `.cursorrules`, `.cursor/rules/`, `.github/copilot-instructions.md`.
- Current status: none exist in this repo.
- If any are added later, treat them as authoritative and merge their guidance here.

## 3) Setup and run commands
Run commands from repo root unless noted.

Backend setup/run:
```bash
pip install -e ".[dev]"
python -m src.main
```

Frontend setup/run (from `web/`):
```bash
npm install
npm run dev
npm run build
npm run start
```

Full stack (Docker, from repo root):
```bash
docker-compose up --build
docker-compose logs -f backend
docker-compose logs -f frontend
```

## 4) Build, lint, format, and test
Backend quality checks:
```bash
ruff check src tests
ruff format src tests
pytest tests -v
```

Frontend quality checks (from `web/`):
```bash
npm run lint
npm run build
```

Notes:
- There is no dedicated frontend unit test script configured in `web/package.json`.
- For frontend validation, rely on `npm run lint` and `npm run build`.

## 5) Single-test and targeted-check commands
Use these for fast feedback during edits.

Backend (pytest node IDs):
```bash
pytest tests/test_progression_engine.py -v
pytest tests/test_progression_engine.py::TestEvaluateAnchor -v
pytest tests/test_progression_engine.py::TestEvaluateAnchor::test_rir_2_plus_increases_weight -v
pytest tests/test_api_input_validation.py::test_day_option_rejects_unknown_fields -v
pytest tests/test_history_backfill.py -v
pytest tests -k "deload and progression" -v
```

Frontend (single file lint, from `web/`):
```bash
npm run lint -- app/today/page.tsx
npx eslint app/routines/page.tsx
```

## 6) Data/bootstrap utilities
Common maintenance scripts:
```bash
python scripts/seed_db.py
python scripts/backfill_training_type.py
```

## 7) Required checks before finishing work
- Backend-only changes: run `ruff check src tests` and targeted `pytest` for touched logic.
- Frontend-only changes: run `npm run lint` and `npm run build` in `web/`.
- Cross-stack/API contract changes: run both backend and frontend checks.

## 8) Python style guidelines
Lint/format baseline comes from `pyproject.toml`:
- `ruff` enabled with rules `E,F,I,N,W,UP`.
- line length is 100; target version is Python 3.11.

Code style:
- Keep imports grouped and sorted (stdlib, third-party, local) per Ruff `I`.
- Use type hints for public functions, service functions, and route handlers.
- Prefer `X | None` over `Optional[X]`.
- Naming: `snake_case` for vars/functions/modules, `PascalCase` for classes, `UPPER_CASE` for constants.
- Use concise docstrings for non-trivial modules/functions.
- Keep route modules declarative; move domain logic into `src/services/`.

## 9) FastAPI/Pydantic/SQLAlchemy conventions
- Use strict request models with `extra="forbid"` via shared base models.
- Validate shape and bounds at API edges with `Field(...)` constraints and regex patterns.
- Normalize user input before persistence (`strip()`, casing, canonical names).
- Raise `HTTPException(status_code=..., detail=...)` with clear actionable detail.
- Use async DB sessions consistently: `async with async_session() as session`.
- Prefer explicit SQLAlchemy queries (`select`, clear joins, explicit `order_by`).
- Scope all user data by `user_id` from auth context.
- Commit once per logical mutation block; use `flush()` only when IDs are needed.

## 10) Error handling and logging
- Use `logger = logging.getLogger(__name__)` per module.
- Do not swallow exceptions silently; either handle meaningfully or re-raise.
- Avoid broad `except Exception`; when unavoidable, convert to typed API errors.
- Preserve exception chaining (`raise ... from exc`) for parsing/validation failures.
- Return deterministic, stable error responses for invalid inputs.

## 11) TypeScript/React/Next.js style guidelines
TypeScript baseline (`web/tsconfig.json`):
- `strict: true`, `noEmit: true`, path alias `@/*`.
- Prefer explicit interfaces/types for API payloads and responses.
- Avoid `any`; use unions, discriminated unions, or `Record<string, unknown>` when needed.

Frontend conventions:
- Keep API contracts centralized in `web/lib/api.ts`.
- If backend payloads change, update `web/lib/api.ts` in the same change.
- Naming: `PascalCase` for components/types, `camelCase` for variables/functions.
- Keep server/client boundaries explicit (`"use client"` only where required).
- Favor small composable UI helpers over deeply nested inline logic.
- Preserve mobile-first behavior and avoid horizontal overflow regressions.

## 12) Import and module hygiene
- Prefer absolute alias imports (`@/...`) in frontend over deep relative paths.
- In backend, keep imports explicit from `src.*`; avoid wildcard imports.
- Remove dead imports and unused locals quickly (Ruff/ESLint should stay clean).

## 13) API and domain invariants
- Do not change route paths or payload shapes unless explicitly requested.
- Root route behavior should continue redirecting to `/today`.
- Progression decisions must remain deterministic (no LLM in progression path).
- Keep compatibility with proxy handler at `web/app/api/[...path]/route.ts`.
- Preserve idempotent behavior where already implemented (workout logging/session writes).

## 14) Auth and Supabase guardrails
- Respect `AUTH_ENABLED` behavior and JWT-based user context.
- Keep `user_id` isolation for reads/writes across all mutable entities.
- SQL templates reference:
  - `supabase/rls.sql`
  - `supabase/storage.sql`
  - `supabase/post_deploy_hardening.sql`
- Profile photos are expected in Supabase Storage bucket `profile-photos`.

## 15) Practical workflow for agents
- Start with narrow, targeted edits; avoid broad refactors unless requested.
- Keep changes contract-safe; update tests close to changed behavior.
- Prefer smallest useful test slice first (single test or `-k`), then expand.
- When touching both API and UI, verify compile/lint on both sides before handoff.
