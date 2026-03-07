# GymOS — Backlog Operativo por Epicas y Sprints

## Objetivo
Este documento traduce el roadmap en backlog ejecutable con epicas, tickets, dependencias, criterios de aceptacion y orden de entrega.

## Horizonte
- Duracion: 8 semanas (4 sprints de 2 semanas)
- Capacidad sugerida: 20 a 28 puntos por sprint
- Convenciones de tickets:
  - `HIS-*` = Historial accionable
  - `UX-*` = Consistencia UX y hardening
  - `BM-*` = Body metrics manual-first
  - `AN-*` = Analitica cruzada

## Estado actual (Mar 2026)
- Completado:
  - HIS-01, HIS-02, HIS-03, HIS-04, HIS-05, HIS-06, HIS-07, HIS-08
  - UX-03 (hardening de hooks/cargas en `settings`, `calendar`, `progress`, `routines/[id]`)
- Implementado adicional (fuera del scope original de E1):
  - Seleccion y edicion rapida de `training_type` en rutinas
  - Backfill historico (`POST /api/history/backfill-training-type`)
  - Stats de clasificacion (`GET /api/history/training-type-stats`)
  - Teclado numerico custom en Today y Routines para `weight/reps/rir`
  - Plate calculator mobile-first con barra visual y short-bar configurable
  - Finish de sesion con resumen y racha de dias
  - Selector de tipo de set en Today (`+W`, `+A`, `+E`, `+D`)
  - Limitador de warmups automaticos en generacion de planes
- Pendiente para cierre formal:
  - HIS-09 QA manual documentado con evidencia final

## Definicion de Done (aplica a todos los tickets)
- Frontend: `npm run lint` y `npm run build` en `web/`
- Backend: `ruff check src tests` y `pytest tests -v`
- Sin regresiones mobile-first (sin overflow horizontal, tap targets correctos)
- Manejo de estados `loading`, `empty`, `error`
- Errores API claros con `HTTPException(status_code=..., detail=...)`

---

## Epica E1 — Historial Accionable (Sprint 3)
Objetivo: que el usuario entienda progreso semanal y mensual en menos de 20 segundos.

### HIS-01 — Clasificacion de sesiones (Push/Pull/Legs/Custom)
- Estado: COMPLETADO
- Tipo: Backend
- Estimacion: 3 pts
- Dependencias: ninguna
- Criterios de aceptacion:
  - Funcion central de clasificacion basada en `template_day_name`
  - Casos ambiguos o no reconocidos caen en `custom`
  - La clasificacion se reutiliza en endpoints de historial

### HIS-02 — Filtro por tipo en `/api/calendar`
- Estado: COMPLETADO
- Tipo: Backend
- Estimacion: 5 pts
- Dependencias: HIS-01
- Criterios de aceptacion:
  - `GET /api/calendar` acepta `training_type` opcional (`all|push|pull|legs|custom`)
  - Filtro invalido retorna 400
  - Compatible con clientes actuales (sin romper consumo existente)

### HIS-03 — Endpoint de comparacion semanal
- Estado: COMPLETADO
- Tipo: Backend
- Estimacion: 5 pts
- Dependencias: HIS-01
- Criterios de aceptacion:
  - Nuevo endpoint: `GET /api/history/weekly-compare`
  - Responde para semana actual y semana previa: `sessions`, `sets`, `volume`
  - Incluye `delta` absoluto y `delta_pct`
  - Maneja division por cero en `delta_pct`

### HIS-04 — Tipos y cliente API en frontend
- Estado: COMPLETADO
- Tipo: Frontend
- Estimacion: 2 pts
- Dependencias: HIS-02, HIS-03
- Criterios de aceptacion:
  - `web/lib/api.ts` con interfaces y metodos tipados
  - Sin `any` agregado
  - Manejo de errores consistente en llamadas nuevas

### HIS-05 — Filtros de historial (chips)
- Estado: COMPLETADO
- Tipo: Frontend
- Estimacion: 5 pts
- Dependencias: HIS-04
- Criterios de aceptacion:
  - Chips: `Todos`, `Push`, `Pull`, `Legs`, `Custom`
  - Filtran calendario, lista del dia y timeline
  - Estado visual claro del filtro activo
  - No hay overflow horizontal en mobile

### HIS-06 — Bloque “Esta semana vs Semana pasada”
- Estado: COMPLETADO
- Tipo: Frontend
- Estimacion: 5 pts
- Dependencias: HIS-04
- Criterios de aceptacion:
  - Muestra sesiones, sets y volumen de ambas semanas
  - Muestra deltas absolutos y porcentuales
  - Usa convencion visual positiva/negativa
  - Tiene `loading` y fallback de error

### HIS-07 — Leyenda de intensidad en calendario
- Estado: COMPLETADO
- Tipo: Frontend
- Estimacion: 3 pts
- Dependencias: HIS-05
- Criterios de aceptacion:
  - Leyenda visible en modo detalle: baja, media, alta
  - Umbrales alineados con volumen relativo del mes
  - Estilo consistente con tema actual

### HIS-08 — Persistencia de preferencias de historial
- Estado: COMPLETADO
- Tipo: Frontend
- Estimacion: 3 pts
- Dependencias: HIS-05
- Criterios de aceptacion:
  - Persistir `mode`, `training_type`, `selectedDate`
  - Restaurar estado al volver a `/settings`
  - Fallback seguro cuando `localStorage` no esta disponible

### HIS-09 — QA funcional del flujo historial
- Estado: EN PROGRESO
- Tipo: QA
- Estimacion: 3 pts
- Dependencias: HIS-05, HIS-06, HIS-07, HIS-08
- Criterios de aceptacion:
  - Smoke: Today -> Save -> Settings -> filtros -> detalle
  - Validado en mobile y desktop
  - Sin degradacion evidente de rendimiento

---

## Epica E2 — Consistencia UX y Hardening (Sprint 4)
Objetivo: bajar deuda tecnica de interfaz y unificar feedback visual.

### UX-01 — Sistema unificado de toasts
- Tipo: Frontend
- Estimacion: 3 pts
- Dependencias: ninguna
- Criterios de aceptacion:
  - Posicion, duracion y variantes unificadas
  - Integrado en Today, Settings, Routines y Profile

### UX-02 — Jerarquia de botones consistente
- Tipo: Frontend
- Estimacion: 3 pts
- Dependencias: ninguna
- Criterios de aceptacion:
  - Primario, secundario y destructivo definidos y aplicados
  - Estados `disabled/loading/active` homogeneos

### UX-03 — Hardening de `settings/page.tsx`
- Estado: COMPLETADO
- Tipo: Frontend
- Estimacion: 5 pts
- Dependencias: ninguna
- Criterios de aceptacion:
  - Resolver errores de hooks y `set-state-in-effect`
  - Evitar dependencias inestables en `useEffect`
  - Lint sin errores en archivo tocado

### UX-04 — Simplificacion de copy
- Tipo: Frontend
- Estimacion: 2 pts
- Dependencias: UX-01, UX-02
- Criterios de aceptacion:
  - Textos mas cortos y accionables
  - Sin perdida de claridad funcional

### UX-05 — Verificacion de accesibilidad operativa
- Tipo: QA
- Estimacion: 3 pts
- Dependencias: UX-02
- Criterios de aceptacion:
  - Tap targets >= 44px en vistas clave mobile
  - Contraste util en componentes modificados

---

## Epica E3 — Body Metrics Manual-First (Sprint 5)
Objetivo: incorporar composicion corporal sin depender de API externa desde el dia 1.

### BM-01 — Modelo y migracion `body_metrics`
- Tipo: Backend
- Estimacion: 5 pts
- Dependencias: ninguna
- Criterios de aceptacion:
  - Tabla con campos de peso, grasa, musculo, etc.
  - Indices por fecha y fuente
  - Compatible con stack actual

### BM-02 — Servicio de validacion y dedupe
- Tipo: Backend
- Estimacion: 5 pts
- Dependencias: BM-01
- Criterios de aceptacion:
  - Validaciones de rango por metrica
  - Dedupe por `source + measured_at`
  - Reporte de registros importados/duplicados

### BM-03 — Import manual CSV/JSON
- Tipo: Backend
- Estimacion: 5 pts
- Dependencias: BM-02
- Criterios de aceptacion:
  - Endpoint `POST /api/body-metrics/import`
  - Manejo de errores por fila
  - Persistencia de payload original para trazabilidad

### BM-04 — Endpoints de consulta
- Tipo: Backend
- Estimacion: 3 pts
- Dependencias: BM-01
- Criterios de aceptacion:
  - `GET /api/body-metrics`
  - `GET /api/body-metrics/latest`
  - `GET /api/body-metrics/summary`

### BM-05 — Tipos y cliente API frontend
- Tipo: Frontend
- Estimacion: 2 pts
- Dependencias: BM-03, BM-04
- Criterios de aceptacion:
  - Interfaces TS y metodos de API agregados
  - Manejo de errores de import y consulta

### BM-06 — UI de import con preview
- Tipo: Frontend
- Estimacion: 5 pts
- Dependencias: BM-05
- Criterios de aceptacion:
  - Seleccion de archivo
  - Previsualizacion de registros detectados
  - Confirmacion de import y resumen final

### BM-07 — Tarjeta de composicion en perfil
- Tipo: Frontend
- Estimacion: 3 pts
- Dependencias: BM-05
- Criterios de aceptacion:
  - Mostrar medicion mas reciente y fecha
  - Microtendencia 7d/30d

### BM-08 — QA de parsing y calidad de datos
- Tipo: QA
- Estimacion: 3 pts
- Dependencias: BM-03, BM-06
- Criterios de aceptacion:
  - Fixtures de formatos reales
  - Import confiable en primer intento (>95% esperado)

---

## Epica E4 — Analitica Cruzada Basica (Sprint 6)
Objetivo: cruzar training + body metrics con recomendaciones simples y accionables.

### AN-01 — Servicio de KPIs cruzados
- Tipo: Backend
- Estimacion: 5 pts
- Dependencias: BM-04
- Criterios de aceptacion:
  - KPIs: 7d vs 30d, sesiones/semana, volumen/semana
  - Endpoint unico de resumen analitico

### AN-02 — Reglas deterministas de alertas
- Tipo: Backend
- Estimacion: 3 pts
- Dependencias: AN-01
- Criterios de aceptacion:
  - Reglas explicables y auditables
  - Sin mutaciones automaticas criticas de DB

### AN-03 — Panel analitico en historial detalle
- Tipo: Frontend
- Estimacion: 5 pts
- Dependencias: AN-01
- Criterios de aceptacion:
  - Panel compacto y legible
  - Estados `loading`, `empty`, `error`

### AN-04 — Mensajeria de recomendaciones
- Tipo: Frontend
- Estimacion: 3 pts
- Dependencias: AN-02, AN-03
- Criterios de aceptacion:
  - Recomendaciones cortas y accionables
  - Sin sobrecargar la UI principal

### AN-05 — QA de impacto funcional
- Tipo: QA/Product
- Estimacion: 2 pts
- Dependencias: AN-03, AN-04
- Criterios de aceptacion:
  - Validacion en escenarios reales
  - Sin regresion de rendimiento en `/settings`

---

## Priorizacion (MoSCoW)
- Must:
  - HIS-01..HIS-08
  - UX-03
  - BM-01..BM-04
  - SP-01..SP-06
  - CO-01..CO-05
- Should:
  - UX-01, UX-02
  - BM-06, BM-07
  - AN-01, AN-03
  - CO-06..CO-08
- Could:
  - AN-04 y mejoras visuales no criticas
  - SP-07 (hardening Postgres)
- Won't (por ahora):
  - Integraciones API externas automaticas (Megafit/Cubitt)

## Orden de merge recomendado
1. PR1: HIS-01 + HIS-02
2. PR2: HIS-03 + tipos API
3. PR3: HIS-05 + HIS-06
4. PR4: HIS-07 + HIS-08 + QA
5. PR5: UX-03
6. PR6: BM-01 + BM-02
7. PR7: BM-03 + BM-04
8. PR8: BM-05 + BM-06 + BM-07
9. PR9: AN-01 + AN-03
10. PR10: AN-02 + AN-04 + QA final
11. PR11: SP-01 + SP-02
12. PR12: SP-03 + SP-04
13. PR13: SP-05 + SP-06
14. PR14: CO-01 + CO-02
15. PR15: CO-03 + CO-04
16. PR16: CO-05 + CO-06
17. PR17: CO-07 + CO-08

## Siguiente bloque recomendado
1. Cerrar HIS-09 con checklist manual final (mobile + desktop) y evidencia.
2. Iniciar E3 (BM-01 y BM-02) para desbloquear body metrics.
3. Ejecutar seguimiento post-cutover (retencion, costos y monitoreo).

## Checklist tecnico detallado (HIS-09 + BM-01..BM-04)

### HIS-09 — QA funcional del flujo historial

**Objetivo**
- Validar flujo end-to-end sin regresiones y con evidencia minima (capturas o notas).

**Alcance**
- Today -> Save -> Settings -> filtros -> detalle, en mobile y desktop.

**Checklist de ejecucion (orden sugerido)**
1. Preparacion
   - Base limpia o con datos representativos (semanas con sesiones variadas).
   - Confirmar build/lint pasados o usar branch estable.
2. Smoke de flujo principal
   - Today: registrar entrenamiento con `training_type`.
   - Save: confirmar persistencia y refresco de UI.
   - Settings -> Historial: abrir sin errores.
3. Filtros de historial
   - Chips: Todos/Push/Pull/Legs/Custom.
   - Verificar que calendario + lista dia + timeline cambian en sincronia.
   - Filtro invalido: no debe romper ni quedar en estado incoherente.
4. Weekly compare
   - Verificar sesiones/sets/volumen de semana actual vs pasada.
   - Deltas (absoluto y %): validar division por cero.
5. Leyenda de intensidad
   - Aparece en detalle del calendario.
   - Umbrales coherentes con volumen relativo del mes.
6. Persistencia de preferencias
   - Cambiar `mode`, `training_type`, `selectedDate`.
   - Recargar ruta `/settings` y confirmar restauracion.
   - Probar sin `localStorage` (modo privado o bloqueo simulado).
7. Estados UI
   - `loading`, `empty`, `error` visiblemente manejados.
8. Mobile-first
   - Sin overflow horizontal.
   - Tap targets y spacing consistentes.
9. Evidencia
   - 6-10 capturas o notas de validacion por seccion.
   - Registrar cualquier divergencia o edge case.

**Salida esperada**
- Resultado por punto del checklist (OK/Fail + observacion).
- Evidencia adjunta (capturas o notas).

### BM-01 — Modelo y migracion `body_metrics`

**Checklist tecnico**
- Definir modelo SQLAlchemy con campos minimos:
  - `id`, `measured_at` (datetime), `source` (str), `weight_kg` (float),
    `body_fat_pct` (float), `muscle_mass_kg` (float), `notes` (str, opcional),
    `payload_raw` (json/text opcional), `created_at`.
- Indices:
  - `measured_at` (consultas por periodo)
  - `(source, measured_at)` (dedupe)
- Validar constraints suaves (no negativos, % en rango 0..100).
- Migracion con Alembic si ya se esta usando; si no, documentar plan.

**Casos limite a probar**
- `measured_at` en futuro (definir si se rechaza o permite).
- `measured_at` faltante (debe error).
- `source` vacio (debe error).

### BM-02 — Servicio de validacion y dedupe

**Checklist tecnico**
- Validaciones:
  - `weight_kg`: 20..300 (ajustable)
  - `body_fat_pct`: 2..70
  - `muscle_mass_kg`: 10..120
  - `measured_at`: datetime valido
- Dedupe por `(source, measured_at)`:
  - Si existe, marcar como duplicado y no insertar.
- Respuesta de servicio:
  - `inserted`: int
  - `duplicates`: int
  - `errors`: lista por fila con razon

**Casos limite**
- Dos filas con mismo `measured_at` y distinto payload: debe dedupe.
- Valores limite exactos (2%, 70%, etc.).
- Payload con campos extra: ignorar o guardar en `payload_raw`.

### BM-03 — Import manual CSV/JSON

**Endpoint sugerido**
- `POST /api/body-metrics/import`

**Payload JSON (ejemplo)**
```json
{
  "source": "manual",
  "records": [
    {
      "measured_at": "2026-03-01",
      "weight_kg": 78.4,
      "body_fat_pct": 18.2,
      "muscle_mass_kg": 34.1,
      "notes": "Ayunas"
    },
    {
      "measured_at": "2026-03-05",
      "weight_kg": 78.0,
      "body_fat_pct": 17.9
    }
  ]
}
```

**CSV (si soportas import)**
- Columnas minimas: `measured_at,weight_kg`
- Opcionales: `body_fat_pct,muscle_mass_kg,notes`

**Checklist tecnico**
- Parsear `measured_at` con formato ISO y fallback `YYYY-MM-DD`.
- Reporte por fila:
  - `row_index`
  - `status`: `inserted|duplicate|error`
  - `error`: mensaje si aplica
- Persistir `payload_raw` (si se requiere trazabilidad).

**Casos limite**
- CSV con separador `;` vs `,`.
- Valores con coma decimal (`78,5`): decidir si soportar.
- Registros incompletos (solo `measured_at` sin peso).
- Batch muy grande (limite recomendado).

### BM-04 — Endpoints de consulta

**Endpoints**
- `GET /api/body-metrics`
  - Filtros: `from`, `to`, `source` opcionales.
  - Orden: por `measured_at` desc.
- `GET /api/body-metrics/latest`
  - Devuelve ultimo registro valido.
- `GET /api/body-metrics/summary`
  - KPIs simples: ultimo peso, delta 7d/30d si hay datos.

**Checklist tecnico**
- Manejo de vacio:
  - `latest` devuelve 404 o payload vacio consistente.
  - `summary` devuelve nulls o 0 con bandera `has_data`.
- Fechas invalidas -> 400 con `detail` claro.
- Orden determinista.

**Casos limite**
- Solo 1 registro: `summary` sin delta.
- Muchos registros mismo dia: decidir si tomar ultimo por `created_at`.

## Riesgos y mitigaciones
- Riesgo: mapeo ambiguo de `template_day_name`
  - Mitigacion: clasificador central en backend y tests de casos frontera
- Riesgo: sobrecarga visual en historial
  - Mitigacion: modo simple por defecto, detalle bajo demanda
- Riesgo: calidad variable de archivos de import
  - Mitigacion: parser versionado, validacion fuerte, reporte de errores

---

## Epica E5 — Migracion a Supabase (corto plazo, prioridad alta)
Objetivo: mover a Postgres administrado con Auth Google sin romper el flujo actual.

### SP-01 — Provisionar proyecto Supabase
- Tipo: Infra
- Estado: COMPLETADO
- Estimacion: 3 pts
- Dependencias: ninguna
- Criterios de aceptacion:
  - Proyecto Pro creado
  - Region definida
  - Backups diarios habilitados (7 dias)
  - Limites/alertas configurados
 - Subtareas:
   - Crear organizacion/proyecto en Supabase
   - Configurar region y nombre de proyecto
   - Activar backups diarios (7 dias)
   - Configurar alertas de disk/egress/compute

### SP-02 — Configurar Auth Google en Supabase
- Tipo: Infra/Auth
- Estado: COMPLETADO
- Estimacion: 3 pts
- Dependencias: SP-01
- Criterios de aceptacion:
  - OAuth client creado en Google Cloud
  - Redirect URIs de prod + staging + local
  - Provider habilitado en Supabase
  - Login Google probado en entorno local
 - Subtareas:
   - Crear OAuth Client (Web) en Google Cloud
   - Registrar URIs de callback (prod/staging/local)
   - Activar Google provider en Supabase Auth
   - Probar flujo login/logout en local

### SP-03 — Preparar backend para Postgres + Auth JWT
- Tipo: Backend
- Estado: COMPLETADO
- Estimacion: 5 pts
- Dependencias: SP-01
- Criterios de aceptacion:
  - `DATABASE_URL` soporta `postgresql+asyncpg`
  - Configuracion de pool y compatibilidad con pooler definida
 - Subtareas:
   - Agregar soporte `asyncpg` en settings
   - Definir compatibilidad de pooler para prod

### SP-04 — Migracion de datos SQLite -> Postgres
- Tipo: Backend/Data
- Estado: COMPLETADO
- Estimacion: 8 pts
- Dependencias: SP-03
- Criterios de aceptacion:
  - Export/import ordenado por FK
  - Conteo de filas por tabla validado
  - Validacion de queries criticas
 - Subtareas:
   - Script de export SQLite (por tabla)
   - Script de import Postgres (orden por FK)
   - Validar conteos por tabla
   - Validar queries criticas (today, history, routines)

### SP-05 — Cutover en Coolify
- Tipo: Infra/Deploy
- Estado: COMPLETADO
- Estimacion: 5 pts
- Dependencias: SP-04
- Criterios de aceptacion:
  - Variables env actualizadas
  - Downtime documentado
  - Rollback plan definido
  - Monitoring 24-48h post cutover
 - Subtareas:
   - Actualizar `DATABASE_URL` y keys Supabase en Coolify
   - Definir ventana de mantenimiento
   - Checklist de rollback de servicio
   - Monitoreo intensivo 24-48h

### SP-06 — Retencion 3 meses + resumen mensual
- Tipo: Backend/Data
- Estado: PENDIENTE
- Estimacion: 5 pts
- Dependencias: SP-05
- Criterios de aceptacion:
  - Job de purge por fecha
  - Tabla de resumen mensual
  - Documentacion de politica de retencion
 - Subtareas:
   - Definir tabla de resumen mensual
   - Crear job de purge (cron)
   - Documentar politica de retencion

### SP-07 — Hardening Postgres
- Tipo: Backend/Infra
- Estado: COMPLETADO
- Estimacion: 5 pts
- Dependencias: SP-05
- Criterios de aceptacion:
  - Indices revisados
  - Queries pesadas optimizadas
  - Pooling y timeouts ajustados
 - Subtareas:
   - Revisar indices en tablas grandes
   - Optimizar queries de historial
   - Ajustar pool y timeouts

---

## Epica E6 — Monetizacion Publico + Coaches (mediano plazo)
Objetivo: implementar los planes definidos en `mejoras/Vision.md`.

### CO-01 — Modelo de suscripciones y entitlements
- Tipo: Backend
- Estado: PENDIENTE
- Estimacion: 5 pts
- Dependencias: SP-05
- Criterios de aceptacion:
  - Tabla `subscriptions`
  - Tabla `entitlements`
  - Estados de plan (publico free/pro, coach free/pro/full)
 - Subtareas:
   - Definir esquema `subscriptions`
   - Definir esquema `entitlements`
   - Migraciones y modelos

### CO-02 — Modelo Coach + Clientes
- Tipo: Backend
- Estado: PENDIENTE
- Estimacion: 5 pts
- Dependencias: CO-01
- Criterios de aceptacion:
  - Tabla `coach_profiles`
  - Tabla `coach_clients`
  - Codigo de acceso funcional
 - Subtareas:
   - Definir esquema `coach_profiles`
   - Definir esquema `coach_clients`
   - Generar codigo de acceso y validacion

### CO-03 — Limites por plan
- Tipo: Backend
- Estado: PENDIENTE
- Estimacion: 3 pts
- Dependencias: CO-02
- Criterios de aceptacion:
  - Limites de clientes por plan
  - Limites de IA por plan
  - Errors claros en exceso
 - Subtareas:
   - Middleware de limites por plan
   - Respuestas 429/403 con detalle claro

### CO-04 — Panel de gestion de coach
- Tipo: Frontend
- Estado: PENDIENTE
- Estimacion: 5 pts
- Dependencias: CO-02
- Criterios de aceptacion:
  - Lista de clientes
  - Accesos rapidos
  - Estados de actividad basicos
 - Subtareas:
   - Vista lista de clientes
   - Accesos rapidos a perfiles
   - Indicador de actividad reciente

### CO-05 — Stats basicos por cliente
- Tipo: Backend/Frontend
- Estado: PENDIENTE
- Estimacion: 5 pts
- Dependencias: CO-04
- Criterios de aceptacion:
  - Sesiones/semana
  - Volumen semanal
  - Adherencia
 - Subtareas:
   - Endpoint de stats por cliente
   - UI de stats compacta

### CO-06 — Branding completo coach
- Tipo: Frontend
- Estado: PENDIENTE
- Estimacion: 3 pts
- Dependencias: CO-04
- Criterios de aceptacion:
  - Logo + colores aplicados
  - Visible en vistas cliente
 - Subtareas:
   - Guardar branding en perfil coach
   - Aplicar tema en vistas cliente

### CO-07 — Publico Pro entitlements
- Tipo: Backend/Frontend
- Estado: PENDIENTE
- Estimacion: 3 pts
- Dependencias: CO-01
- Criterios de aceptacion:
  - Historial completo
  - Analitica avanzada
  - IA ampliada
 - Subtareas:
   - Gate de historial extendido
   - Gate de analitica avanzada
   - Limites IA por plan publico

### CO-08 — Facturacion y upgrades
- Tipo: Backend/Frontend
- Estado: PENDIENTE
- Estimacion: 5 pts
- Dependencias: CO-01
- Criterios de aceptacion:
  - Flujo upgrade/downgrade
  - Estado reflejado en UI
  - Eventos de pago auditables
 - Subtareas:
   - UI de upgrade/downgrade
   - Webhook de pagos
   - Auditoria de eventos
