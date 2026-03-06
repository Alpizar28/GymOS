# Supabase — Operacion y Verificacion (post-cutover)

## Estado
- Cutover completado a Supabase/Postgres.
- Auth Google + email funcionando.
- RLS y storage habilitados.

## Comandos de verificacion local
```bash
python3 -m pip install -e ".[dev]"
python3 -m compileall src scripts
cd web && npm install && npm run lint && npm run build
```

## SQL recomendado en Supabase
- `supabase/rls.sql`
- `supabase/storage.sql`
- `supabase/post_deploy_hardening.sql`

## Health checks
```bash
curl -k "https://<backend-domain>/api/health"
curl -k "https://<frontend-domain>/api/health"
```

## Checklist rapido de produccion
1. Login email y Google en `/login`.
2. Crear carpeta/rutina en `/routines`.
3. Registrar sesion en `/today`.
4. Subir foto en `/profile`.
5. Validar aislamiento entre 2 usuarios.

## Troubleshooting comun
- `Invalid token`: revisar `SUPABASE_URL`, `SUPABASE_JWT_AUDIENCE`, despliegue backend.
- `Missing bearer token`: revisar headers en proxy frontend (`/api/[...path]`).
- `DuplicatePreparedStatementError`: mantener `DATABASE_STATEMENT_CACHE_SIZE=0` con pooler.
