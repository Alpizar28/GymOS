# GymOS

Personal training operating system built for a high-frequency lifter workflow.

GymOS combines training plan generation, deterministic progression, session logging,
history analytics, routines management, and profile-level health context in one
mobile-first experience.

---

## Why GymOS

Most fitness tools split your workflow across multiple apps:
- one for routines,
- one for workout logging,
- one for body metrics,
- one for nutrition.

GymOS is designed to unify that lifecycle with a clear UX and a robust backend.

---

## Product Highlights

- **Today-first UX**: root route redirects to `/today` for immediate training flow.
- **Step-based training UI**: choose -> train, with draft persistence and focus mode.
- **Routines module**: folders, routine cards, detailed set structures (W/A/E), start/share/duplicate.
- **Routine progression flow**: analyze anchors per saved routine (last 5 sessions) and apply weight/reps/set updates without regenerating plans.
- **Unified Historial**: calendar + streaks + selected-day drill-down in one view.
- **Perfil hub**: personal data, exercise library, protections, and expanded stats.
- **Weight unit system (lb/kg)**: global preference, onboarding selection, per-exercise override in active session, and plate calculator toggle.
- **Local-day workout persistence**: today logs are stored using the client local date to avoid UTC/day-shift errors.
- **PWA-ready frontend**: installable app shell with offline fallback.
- **Coolify-friendly proxying**: resilient API proxy with timeout handling.

### Weight Units (Canonical Data Rule)

- UI supports both `lb` and `kg`.
- Backend and persisted workout/routine weights remain canonical in **pounds (`*_lbs`)**.
- Conversions happen in the frontend before submit and after fetch.
- This avoids mixed-unit records and keeps progression logic deterministic.

---

## Tech Stack

### Backend
- Python 3.11+
- FastAPI
- SQLAlchemy async
- PostgreSQL (Supabase-ready, `asyncpg`)

### Frontend
- Next.js 16 (App Router)
- React 19
- Tailwind CSS

### Intelligence
- OpenAI-based planning (generation layer)
- deterministic progression engine (execution/rule layer)

---

## Repository Structure

```text
GymOS/
├── src/                  # FastAPI backend
├── web/                  # Next.js frontend
├── tests/                # pytest suite
├── scripts/              # seed + offline data pipeline
├── data/                 # athlete source/generated data
├── mejoras/              # product/UX roadmap docs
├── docker-compose.yaml
├── Dockerfile.backend
├── Dockerfile.frontend
├── AGENTS.md
└── CLAUDE.md
```

---

## Quick Start

## 1) Backend

```bash
pip install -e ".[dev]"
python -m src.main
```

Backend runs at `http://localhost:8000`.

## 2) Frontend

```bash
cd web
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`.

## 3) Full stack with Docker

```bash
docker-compose up --build
```

---

## Useful Commands

### Backend

```bash
pytest tests/ -v
ruff check src/
ruff format src/
python scripts/seed_db.py
```

### Frontend

```bash
cd web
npm run build
npm run lint
```

---

## Main App Routes

- `/today` — main training flow
- `/routines` — routine folders/cards
- `/routines/[id]` — routine detail/editor + progression preview/apply
- `/settings` — unified history (summary/detail)
- `/profile` — personal profile and training utilities
- `/workouts` — workout records
- `/` — redirects to `/today`

---

## Roadmap Docs

Planning is organized by horizon in `mejoras/`:

- `mejoras/01_posibles_mejoras_proximas.md`
- `mejoras/02_mejoras_mediano_plazo.md`
- `mejoras/03_mejoras_largo_plazo.md`

Includes near-term UX improvements, medium-term body metrics integration
(Megafit/Cubitt manual-first), and long-term nutrition module goals.

---

## Deployment Notes

- Frontend API traffic is proxied through `web/app/api/[...path]/route.ts`.
- Proxy timeout is configurable via `PROXY_TIMEOUT_MS` (default 45s).
- Long-running endpoints (`generate-day`, `generate-today`, `today/log`, `manual-workouts/*`) use an extended timeout via `PROXY_TIMEOUT_LONG_MS` (default 120s).
- Designed for container deployment (Coolify-compatible).

## Date/Timezone Safety

- `POST /today/log` now receives an explicit `date` (`YYYY-MM-DD`) from the frontend.
- Backend persists the workout using that provided local date instead of server `date.today()`.
- This prevents sessions from being saved as the next calendar day when server timezone differs from user timezone.

## Supabase Migration Notes

- Auth is now Supabase JWT-based (backend expects `Authorization: Bearer <token>` when `AUTH_ENABLED=true`).
- Login supports email/password and Google OAuth (`/login`).
- Profile photo upload now targets Supabase Storage bucket `profile-photos`.
- SQL policy templates are included in `supabase/rls.sql` and `supabase/storage.sql`.
- Post-deploy hardening script (unique indexes + RLS verification) is in `supabase/post_deploy_hardening.sql`.

---

## Database Hygiene

- Startup maintenance runs through `src/services/db_maintenance.py`.
- It creates/ensures key indexes for frequent reads and writes.
- It removes duplicated cached plan rows (`plan_days`) and clears orphan `plans`.
- Workout log and session feedback writes are idempotent to reduce repeated records over time.

---

## Current Design Direction

- Dark theme, red accent system
- Mobile-first interactions
- Minimal UI by default, deeper analytics on-demand
- Functional consistency over visual novelty

---

## Contributing (Internal)

Before opening PR/merge:

1. `npm run build` passes in `web/`
2. Backend compiles/tests for touched modules
3. No accidental UX regressions on mobile
4. Keep `AGENTS.md` and roadmap docs aligned when architecture/product direction changes
