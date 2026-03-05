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
- Tipo: Backend
- Estimacion: 3 pts
- Dependencias: ninguna
- Criterios de aceptacion:
  - Funcion central de clasificacion basada en `template_day_name`
  - Casos ambiguos o no reconocidos caen en `custom`
  - La clasificacion se reutiliza en endpoints de historial

### HIS-02 — Filtro por tipo en `/api/calendar`
- Tipo: Backend
- Estimacion: 5 pts
- Dependencias: HIS-01
- Criterios de aceptacion:
  - `GET /api/calendar` acepta `training_type` opcional (`all|push|pull|legs|custom`)
  - Filtro invalido retorna 400
  - Compatible con clientes actuales (sin romper consumo existente)

### HIS-03 — Endpoint de comparacion semanal
- Tipo: Backend
- Estimacion: 5 pts
- Dependencias: HIS-01
- Criterios de aceptacion:
  - Nuevo endpoint: `GET /api/history/weekly-compare`
  - Responde para semana actual y semana previa: `sessions`, `sets`, `volume`
  - Incluye `delta` absoluto y `delta_pct`
  - Maneja division por cero en `delta_pct`

### HIS-04 — Tipos y cliente API en frontend
- Tipo: Frontend
- Estimacion: 2 pts
- Dependencias: HIS-02, HIS-03
- Criterios de aceptacion:
  - `web/lib/api.ts` con interfaces y metodos tipados
  - Sin `any` agregado
  - Manejo de errores consistente en llamadas nuevas

### HIS-05 — Filtros de historial (chips)
- Tipo: Frontend
- Estimacion: 5 pts
- Dependencias: HIS-04
- Criterios de aceptacion:
  - Chips: `Todos`, `Push`, `Pull`, `Legs`, `Custom`
  - Filtran calendario, lista del dia y timeline
  - Estado visual claro del filtro activo
  - No hay overflow horizontal en mobile

### HIS-06 — Bloque “Esta semana vs Semana pasada”
- Tipo: Frontend
- Estimacion: 5 pts
- Dependencias: HIS-04
- Criterios de aceptacion:
  - Muestra sesiones, sets y volumen de ambas semanas
  - Muestra deltas absolutos y porcentuales
  - Usa convencion visual positiva/negativa
  - Tiene `loading` y fallback de error

### HIS-07 — Leyenda de intensidad en calendario
- Tipo: Frontend
- Estimacion: 3 pts
- Dependencias: HIS-05
- Criterios de aceptacion:
  - Leyenda visible en modo detalle: baja, media, alta
  - Umbrales alineados con volumen relativo del mes
  - Estilo consistente con tema actual

### HIS-08 — Persistencia de preferencias de historial
- Tipo: Frontend
- Estimacion: 3 pts
- Dependencias: HIS-05
- Criterios de aceptacion:
  - Persistir `mode`, `training_type`, `selectedDate`
  - Restaurar estado al volver a `/settings`
  - Fallback seguro cuando `localStorage` no esta disponible

### HIS-09 — QA funcional del flujo historial
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
- Should:
  - UX-01, UX-02
  - BM-06, BM-07
  - AN-01, AN-03
- Could:
  - AN-04 y mejoras visuales no criticas
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

## Riesgos y mitigaciones
- Riesgo: mapeo ambiguo de `template_day_name`
  - Mitigacion: clasificador central en backend y tests de casos frontera
- Riesgo: sobrecarga visual en historial
  - Mitigacion: modo simple por defecto, detalle bajo demanda
- Riesgo: calidad variable de archivos de import
  - Mitigacion: parser versionado, validacion fuerte, reporte de errores
