# Input Security Review — API

## Objetivo
Reducir riesgo de abuso de inputs (payload flooding, invalid values, mass-assignment accidental y consultas excesivas) en endpoints API.

## Cambios aplicados

### 1) Modelo base estricto para requests
- Se agrego `StrictRequestModel` en `src/api/routes.py` con:
  - `extra="forbid"` para rechazar campos no esperados.
  - `str_strip_whitespace=True` para normalizacion basica.
- Se migro la mayoria de modelos de request a este base model.

### 2) Limites y validaciones por campo
Se agregaron constraints con `Field(...)` en requests criticos:
- Longitudes maximas para strings (`name`, `notes`, `goal`, `photo_url`, etc.).
- Rangos numericos para valores fisiologicos y de sets (`weight`, `reps`, `rir`, `fatigue`, `severity`).
- Rangos para IDs y orden (`folder_id`, `exercise_id`, `sort_order`, `workout_id`).
- Tamano maximo de listas (`exercises`, `sets`) para limitar payloads excesivos.

### 3) Endpoints GET con query constraints
- `GET /api/workouts`: `limit` acotado (`1..200`).
- `GET /api/exercises/{exercise_name}/alternatives`: `limit` acotado (`1..20`).

### 4) Normalizacion y validacion defensiva en path/query
- `exercise_name` en alternatives:
  - `strip()`
  - no vacio
  - maximo 120 chars
- `calendar`:
  - fechas con parse defensivo (`Invalid date format`)
  - validacion de rango y `training_type` permitido.

## Riesgo mitigado
- Menor probabilidad de payloads maliciosos o gigantes.
- Menor superficie de bugs por inputs fuera de rango.
- Menor riesgo de aceptar campos no contemplados por error.
- Menor riesgo de consultas costosas por `limit` arbitrario.

## Validacion tecnica ejecutada
- `python3 -m py_compile src/api/routes.py` -> OK
- `python3 -m compileall -q src` -> OK
- Tests negativos agregados: `tests/test_api_input_validation.py`

## Pendientes recomendados (siguiente iteracion)
1. Rate limiting por IP o token para endpoints de escritura.
2. Limite global de body size en reverse proxy/API server.
3. Tests de validacion negativa por endpoint (422/400 esperados).
4. Sanitizacion y allow-list adicional para campos que luego se renderizan en UI.
