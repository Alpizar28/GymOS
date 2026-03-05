# Migracion Supabase — Comandos

## Prerrequisitos
- `.env` actualizado con `DATABASE_URL` correcto.
- Acceso al servidor donde corre la app.

## Ejecutar migracion
```bash
python3 -m pip install -e ".[dev]"
alembic revision --autogenerate -m "init"
alembic upgrade head
python3 scripts/migrate_sqlite_to_postgres.py
```

## Si algo falla
- Verificar que `python3` y `pip` estan instalados.
- Verificar credenciales en `.env`.
- Compartir el error exacto para depuracion.
