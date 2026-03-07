# AGENTS.md - GymOS

Operational guide for coding agents working in this repository.
Read in this order: `AGENTS.md` -> `README.md` -> `CLAUDE.md`.

## 1) Repository Snapshot
- Product: GymOS (training plans, progression, workout logging, analytics, profile context).
- Backend: FastAPI + SQLAlchemy async + PostgreSQL (`asyncpg`) on Python 3.11+.
- Frontend: Next.js 16 (App Router) + React 19 + TypeScript (`strict`) + Tailwind v4.
- Auth: Supabase JWT validation with per-user data isolation (`user_id`).
- LLM boundary: LLM is used for plan generation; progression remains deterministic.

## 2) Cursor/Copilot Rules
- Checked for `.cursorrules`, `.cursor/rules/`, and `.github/copilot-instructions.md`.
- Current status: none are present in this repository.
- If any appear later, treat them as authoritative and merge their instructions here.

## 3) Setup And Run Commands
Run from repo root unless noted.

Backend:
```bash
pip install -e ".[dev]"
python -m src.main
```

Frontend (run inside `web/`):
```bash
npm install
npm run dev
npm run build
npm run start
```

Docker (full stack):
```bash
docker-compose up --build
docker-compose logs -f backend
docker-compose logs -f frontend
```

## 4) Build, Lint, Format, Test
Backend checks:
```bash
ruff check src tests
ruff format src tests
pytest tests -v
```

Frontend checks (inside `web/`):
```bash
npm run lint
npm run build
```

Notes:
- There is no dedicated frontend unit-test script in `web/package.json`.
- Frontend verification is lint + build unless a test framework is added later.

## 5) Fast Single-Test Commands
Prefer targeted commands first, then broaden.

Backend single-file / single-test examples:
```bash
pytest tests/test_progression_engine.py -v
pytest tests/test_progression_engine.py::TestEvaluateAnchor -v
pytest tests/test_progression_engine.py::TestEvaluateAnchor::test_rir_2_plus_increases_weight -v
pytest tests/test_api_input_validation.py::test_day_option_rejects_unknown_fields -v
pytest tests/test_history_backfill.py::test_classify_training_type_supports_push_pull_legs_and_custom -v
pytest tests -k "deload and progression" -v
```

Frontend targeted check examples (inside `web/`):
```bash
npm run lint -- app/today/page.tsx
npx eslint app/routines/page.tsx
```

## 6) Common Utility Scripts
```bash
python scripts/seed_db.py
python scripts/seed_body_metrics.py
python scripts/backfill_training_type.py
```

## 7) Definition Of Done
- Backend-only change: run `ruff check src tests` and relevant `pytest` nodes.
- Frontend-only change: run `npm run lint` and `npm run build` in `web/`.
- API contract or cross-stack change: run both backend and frontend checks.
- Keep generated files and lockfiles updated only when related to your change.

## 8) Python Style Baseline
From `pyproject.toml`:
- Ruff enabled rules: `E,F,I,N,W,UP`.
- Max line length: 100.
- Target version: Python 3.11.
- Pytest: `asyncio_mode = auto`, tests under `tests/`.

Python conventions:
- Imports: grouped/sorted (stdlib, third-party, local) and kept minimal.
- Types: annotate public functions, services, and route handlers.
- Optionals: prefer `X | None` syntax.
- Naming: `snake_case` (functions/variables/modules), `PascalCase` (classes), `UPPER_CASE` (constants).
- Keep routes thin; move business logic to `src/services/`.
- Use small, clear helper functions instead of deeply nested route logic.

## 9) FastAPI, Pydantic, SQLAlchemy Conventions
- Request bodies inherit strict model behavior (`extra="forbid"`, stripped strings).
- Use `Field(...)` constraints for bounds, regex patterns, and payload size limits.
- Return explicit `HTTPException(status_code=..., detail=...)` for user-facing API errors.
- Preserve exception context when translating errors (`raise ... from exc`).
- Use async session context consistently: `async with async_session() as session`.
- Prefer explicit SQLAlchemy `select(...)` queries, joins, and ordering.
- Scope all reads/writes by authenticated `user_id`.
- Keep writes idempotent where existing endpoints already guarantee idempotency.

## 10) Error Handling And Logging
- Use module loggers (`logger = logging.getLogger(__name__)`).
- Never silently swallow exceptions.
- Avoid broad `except Exception` unless you immediately translate to precise API/domain errors.
- Keep client-visible error messages actionable and stable.
- Validate and normalize user input at API boundaries before DB writes.

## 11) TypeScript / Next.js Style Baseline
From `web/tsconfig.json` and ESLint config:
- TypeScript `strict: true`, `noEmit: true`, path alias `@/*`.
- ESLint extends Next.js core-web-vitals + TypeScript rules.
- No Prettier config is defined; keep formatting consistent with surrounding code.

Frontend conventions:
- Keep API contracts centralized in `web/lib/api.ts`.
- If backend payloads change, update `web/lib/api.ts` in the same PR.
- Prefer typed interfaces/unions over `any`.
- Component/type names use `PascalCase`; variables/functions/hooks use `camelCase`.
- Use `"use client"` only where browser APIs or client hooks are required.
- Prefer alias imports (`@/...`) over deep relative imports.

## 12) Imports, Formatting, And Naming Hygiene
- Remove unused imports/variables quickly (Ruff/ESLint should stay clean).
- Keep import side effects explicit and rare.
- Favor descriptive names over abbreviations in API/services code.
- Keep functions focused; split when logic grows beyond a single responsibility.

## 13) Domain Invariants To Preserve
- Do not change API paths or payload shapes unless explicitly requested.
- Root web route behavior should continue redirecting to `/today`.
- Keep progression deterministic; do not introduce LLM decisions in progression logic.
- Preserve compatibility with proxy handler at `web/app/api/[...path]/route.ts`.
- Maintain auth-aware, per-user isolation semantics in all mutable entities.

## 14) Auth And Supabase Guardrails
- Respect `AUTH_ENABLED` behavior and bearer token flow.
- Keep `user_id` filtering mandatory on all user data queries.
- Profile photo storage target remains Supabase bucket `profile-photos`.
- SQL references to keep aligned:
  - `supabase/rls.sql`
  - `supabase/storage.sql`
  - `supabase/post_deploy_hardening.sql`

## 15) Agent Workflow Recommendations
- Start with smallest safe change; avoid wide refactors unless requested.
- Validate with the narrowest relevant test first (single node id or `-k`).
- Expand to broader checks once targeted checks pass.
- For cross-stack changes, verify backend and frontend before handoff.
- Update this file when tooling, test commands, or coding conventions change.
