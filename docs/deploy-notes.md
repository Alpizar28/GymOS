# Deploy Notes - 2026-03-06 Incident

## Incident Summary

- Symptom: frontend returned `504 Gateway Timeout` after successful image build/deploy.
- Scope: production deploys in Coolify (`main`) after branding and onboarding updates.
- User impact: app loaded inconsistently; protected API calls timed out from frontend proxy.

## Timeline (high level)

- Branding/logo changes were deployed (UI + icons + metadata).
- Multiple frontend image build failures appeared in Coolify (`RUN npm run build`), while local build passed.
- A real frontend code mismatch was identified: onboarding page used API methods that were not committed in `web/lib/api.ts`.
- Build became stable after committing the missing API client methods.
- Runtime still showed intermittent gateway timeouts on protected routes.
- Root runtime issue was reduced by bounding JWT JWKS fetch time in backend auth.

## Root Causes

1. **Commit mismatch during rapid fixes**
   - `web/app/onboarding/page.tsx` called onboarding API client methods not yet present in committed `web/lib/api.ts`.
   - Result: remote TypeScript build failed even when local workspace seemed fine.

2. **Auth/JWKS network sensitivity at runtime**
   - Protected requests require JWT verification and JWKS retrieval/caching.
   - Slow/unreachable JWKS fetch could delay request processing and trip frontend proxy timeout.

## Fixes Applied

- Restored `Dockerfile.frontend` to known-good build flow from prior stable commit.
- Committed missing onboarding API methods in `web/lib/api.ts`.
- Added fallback handling in `web/lib/supabase.ts` for empty env values (`||` instead of `??`).
- Added onboarding status flow in backend and auth guard alignment.
- Added bounded timeout for JWKS client initialization in `src/auth.py`:
  - `PyJWKClient(..., timeout=3)` with compatibility fallback.

## Current Stable State

- Frontend build: passes.
- Deploy: successful.
- App: loads and responds after deploy.
- Remaining untracked artifacts are non-blocking (`logo/`, some scripts/supabase docs).

## Post-Incident Product Updates (after stabilization)

- Added branded icon/wordmark assets across app shell and auth flows.
- Added profile sign-out in header area.
- Added custom numeric keypad for `weight`, `reps`, and `rir` (mobile-first).
- Added gym-style plate calculator with short-bar profile setting.
- Added finish-session summary + streak feedback on completion.
- Added set-type picker in Today (`warmup`, `approach`, `effective`, `drop`).
- Limited automatic warmups in generated plans to avoid warmups on every exercise by default.

## Follow-up Checklist

1. Verify `/today` logging flow on mobile after deploy:
   - weight/reps/rir keypad
   - plate calculator
   - finish summary and streak
2. Verify generated plans do not over-assign warmups on accessory exercises.
3. Verify set types added in Today persist to workout details/history.

## Operational Checklist (for next deploys)

1. Ensure frontend contract changes and API client updates are committed together:
   - `web/app/**` + `web/lib/api.ts`.
2. Verify env vars in Coolify are set and non-empty where required:
   - backend: `SUPABASE_URL`, `SUPABASE_JWT_AUDIENCE`, `AUTH_ENABLED`.
   - frontend: `BACKEND_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Run before push:
   - `npm run build` in `web/`
   - backend lint/tests as needed.
4. After deploy, smoke test:
   - `/api/health`
   - login -> `/today`
   - `/api/profile/personal` through frontend proxy.

## Preventive Actions

- Keep deploy fixes in small focused commits.
- Avoid mixing infra (Dockerfile) and feature changes in same commit when incident response is active.
- Add a CI step (future) to build frontend in clean container before merge to `main`.
- Add a short deploy runbook section in `README.md` referencing this file.
