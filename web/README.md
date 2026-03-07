# GymOS Web

Frontend dashboard for GymOS built with Next.js 16 App Router.

## Stack
- Next.js 16
- React 19
- TypeScript (strict)
- Tailwind CSS
- Supabase JS client (auth + storage)

## UX highlights

- Theme toggle with persisted preference (dark/light).
- Weight units: global preference (`lb`/`kg`) with per-exercise override in active workout/routine editing.
- Onboarding includes measurement system selection (`US (lb)` or `LATAM / Metrico (kg)`).
- Plate calculator supports `lb`/`kg` display toggle while keeping saved values canonical in pounds.
- Today logging sends explicit local date so workout persistence matches user local calendar day.

## Local development

From `web/`:

```bash
npm install
npm run dev
```

App runs at `http://localhost:3000`.

## Required env vars

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional/proxy related:

- `BACKEND_URL` (server-side proxy target)
- `NEXT_PUBLIC_BACKEND_URL`
- `PROXY_TIMEOUT_MS`
- `PROXY_TIMEOUT_LONG_MS`
- `NEXT_PUBLIC_AUTH_BYPASS` (`true` to skip frontend auth guard in local dev)

Proxy timeout defaults:

- Base API timeout: `45s`
- Long-running API timeout: `120s` for `generate-day`, `generate-today`, `today/log`, and `manual-workouts/*`

## Build and checks

```bash
npm run lint
npm run build
npm run start
```

## Auth and API flow

- Session is managed with Supabase Auth.
- App sends bearer token to backend via `web/lib/api.ts`.
- API calls are proxied through `web/app/api/[...path]/route.ts`.
