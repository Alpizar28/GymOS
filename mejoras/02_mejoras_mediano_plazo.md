# GymOS — Mejoras de Mediano Plazo (6 semanas a 6 meses)

## Objetivo
Incorporar capacidades de salud corporal y analitica intermedia sin comprometer estabilidad, claridad de UX ni mantenibilidad del sistema.

## Eje principal de esta fase
Integracion de mediciones corporales (Megafit/Cubitt) con importacion manual y visualizacion util para entrenamiento.

---

## 1. Integracion Megafit/Cubitt (manual-first)

## 1.1 Contexto
Se desea consumir metricas de bascula inteligente (peso, grasa corporal y otras) desde Megafit/Cubitt.
Como no hay confirmacion de API publica estable, la estrategia debe empezar por importacion manual robusta.

## 1.2 Estrategia recomendada
### Fase M1 — Ingestion manual (prioridad)
- Soportar importacion de archivos exportados (JSON/CSV).
- Parsear y normalizar datos a una tabla interna.
- Evitar dependencia inmediata de proveedores externos.

### Fase M2 — Adaptador de API (opcional)
- Si se confirma API de Megafit, crear cliente desacoplado.
- Mantener pipeline manual como fallback.

## 1.3 Modelo de datos sugerido
Tabla: `body_metrics`
- `id` (PK)
- `measured_at` (datetime)
- `source` (megafit, cubitt, manual)
- `weight_lbs` (float)
- `body_fat_pct` (float)
- `muscle_mass_lbs` (float)
- `water_pct` (float)
- `visceral_fat` (float)
- `bmi` (float)
- `bmr` (float)
- `bone_mass_lbs` (float)
- `metabolic_age` (int)
- `raw_payload_json` (text/json)
- `created_at` (datetime)

Indices sugeridos:
- (`measured_at` DESC)
- (`source`, `measured_at`)

Regla de deduplicacion:
- Unicidad logica por (`source`, `measured_at`) con tolerancia de redondeo cuando aplique.

## 1.4 Endpoints backend sugeridos
- `POST /api/body-metrics/import`
  - carga manual de payload/archivo parseado
- `GET /api/body-metrics?from=&to=`
- `GET /api/body-metrics/latest`
- `GET /api/body-metrics/summary?range=30d|90d|180d`

## 1.5 UX en frontend
### Perfil
- Tarjeta "Composicion corporal actual"
  - peso
  - grasa
  - musculo
  - fecha de ultima medicion

### Historial
- Toggle opcional para superponer peso/grasa sobre periodos.
- Micro-tendencia (7d, 30d).

### Import manual
- Pantalla simple:
  - seleccionar archivo
  - previsualizar registros detectados
  - confirmar importacion
  - mostrar duplicados ignorados y registros validos importados

## 1.6 Calidad de datos
- Validaciones de rango (ej. grasa 2%-70%).
- Campos opcionales cuando proveedor no entregue metricas.
- Guardar payload original para trazabilidad y debugging.

---

## 2. Analitica de adherencia y recuperacion

## 2.1 Objetivo
Conectar entrenamiento y composicion corporal para mejores decisiones.

## 2.2 KPIs sugeridos
- Peso promedio 7d vs 30d.
- Tendencia de grasa 30d.
- Sesiones completadas por semana.
- Volumen semanal promedio.
- Correlacion simple entre adherencia y cambios corporales.

## 2.3 Visualizacion
- Panel compacto en Historial Detalle:
  - "Peso vs Volumen"
  - "Grasa vs Frecuencia"

---

## 3. Product UX consolidado en mediano plazo

## 3.1 Persistencia de preferencias visuales
- Guardar modo preferido por seccion:
  - Historial (Resumen/Detalle)
  - Filtros activos
  - Orden de rutinas

## 3.2 Mejora de flujos de edicion
- Routines: acciones mas rapidas sin entrar en vistas profundas.
- Today: menos taps para completar sesion.

## 3.3 Accesibilidad operativa
- Contraste minimo garantizado.
- Tap targets >= 44px en mobile.
- Navegacion clara y predecible.

---

## 4. Riesgos y mitigaciones

### Riesgo 1: Formato de export de Megafit cambia
Mitigacion:
- Parser versionado
- pruebas unitarias de parsing por fixture

### Riesgo 2: Datos incompletos o ruidosos
Mitigacion:
- validacion fuerte
- storing raw payload
- reportes de calidad post-import

### Riesgo 3: Sobrecarga de UI
Mitigacion:
- default en modo simple
- detalle solo bajo demanda

---

## 5. Plan de ejecucion sugerido
1. Crear tabla `body_metrics` y endpoints base.
2. Implementar import manual con validacion y dedupe.
3. Agregar tarjeta de composicion en Perfil.
4. Agregar visualizacion de tendencia simple en Historial.
5. Incorporar KPIs de correlacion entrenamiento/composicion.
6. Evaluar API oficial Megafit y crear adaptador si aplica.

---

## 6. Criterios de exito
- Import manual confiable (>95% registros validos en primer intento).
- Tiempo de importacion bajo (UX fluida).
- Usuarios entienden tendencia corporal sin salir de GymOS.
- Aumento de consultas semanales de Perfil/Historial.
