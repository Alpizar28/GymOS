# GymOS — Mejoras de Largo Plazo (6 a 18+ meses)

## Vision
Evolucionar GymOS de entrenador inteligente de fuerza a plataforma integral de rendimiento personal, combinando entrenamiento, composicion corporal y nutricion con experiencia mobile-first.

---

## 1. Modulo de alimentacion (estilo MyFitnessPal)

## 1.1 Objetivo
Registrar y analizar alimentacion por comida y por alimento para conectar resultados de entrenamiento con adherencia nutricional.

## 1.2 Alcance funcional
### V1 — Registro por comida y alimento
- Comidas por dia:
  - desayuno
  - almuerzo
  - cena
  - snack
- Cada comida contiene alimentos con macros y calorias.
- Totales diarios automaticos.

### V1.5 — Libreria de alimentos y recientes
- Alimentos frecuentes.
- Duplicar comidas de dias anteriores.
- Buscador rapido de alimentos.

### V2 — Integraciones externas y automatizacion
- Import desde plataformas externas (si API disponible).
- OCR de etiquetas (opcional avanzado).

## 1.3 Modelo de datos sugerido

Tabla `nutrition_targets`
- `id`
- `date`
- `calories_target`
- `protein_target_g`
- `carbs_target_g`
- `fat_target_g`
- `fiber_target_g` (opcional)

Tabla `meals`
- `id`
- `date`
- `name` (breakfast/lunch/dinner/snack/custom)
- `notes`
- `created_at`

Tabla `meal_items`
- `id`
- `meal_id`
- `food_name`
- `serving_qty`
- `serving_unit`
- `calories`
- `protein_g`
- `carbs_g`
- `fat_g`
- `fiber_g`
- `sugar_g`
- `sodium_mg`

Tabla `food_library` (opcional)
- `id`
- `name`
- `brand`
- `serving_reference`
- macros por porcion

## 1.4 Endpoints sugeridos
- `GET /api/nutrition/day?date=`
- `POST /api/nutrition/meals`
- `PATCH /api/nutrition/meals/{id}`
- `DELETE /api/nutrition/meals/{id}`
- `POST /api/nutrition/meals/{id}/items`
- `PATCH /api/nutrition/items/{id}`
- `DELETE /api/nutrition/items/{id}`
- `GET /api/nutrition/summary?from=&to=`
- `GET/POST/PATCH /api/nutrition/targets`

## 1.5 UX objetivo
### Vista diaria
- Resumen superior:
  - calorias consumidas vs objetivo
  - protein/carbs/fat con barras de progreso
- Bloques por comida con accion rapida "Agregar alimento"
- Totales actualizados en tiempo real

### Vista semanal
- tendencia de adherencia
- promedio de calorias
- distribucion de macros

### Interaccion
- duplicar comida de ayer
- agregar alimento reciente en 1 tap

---

## 2. Inteligencia de recomendaciones cruzadas (training + body + nutrition)

## 2.1 Objetivo
Generar recomendaciones simples y accionables usando datos combinados.

## 2.2 Ejemplos de recomendaciones futuras
- "Volumen alto + calorias bajas por 5 dias consecutivos: considerar aumento de 200-300 kcal."
- "Peso estable y rendimiento al alza: mantener objetivo actual."
- "Fatiga alta + sueno bajo + deficit agresivo: reducir intensidad 1-2 sesiones."

## 2.3 Reglas iniciales
- Comenzar con reglas deterministicas (sin IA generativa para decisiones criticas).
- IA solo para explicaciones de contexto, no para mutaciones directas de DB.

---

## 3. Planificacion avanzada

## 3.1 Periodizacion visual
- Bloques de 4-6 semanas.
- Objetivo del bloque (fuerza, hipertrofia, mantenimiento).
- Seguimiento de cumplimiento por bloque.

## 3.2 Escenarios
- Semana de descarga sugerida automaticamente.
- Ajuste de volumen segun datos de fatiga + adherencia nutricional.

---

## 4. Plataforma y arquitectura

## 4.1 Escalabilidad de datos
- Indices y archivado historico para queries largas.
- Estrategia de backup y restore automatizada.

## 4.2 Observabilidad
- metricas de API
- tiempos por endpoint
- errores de integracion externa

## 4.3 Seguridad y privacidad
- controles de acceso por seccion sensible
- politica de retencion de datos
- trazabilidad de cambios en datos personales y de salud

---

## 5. Experiencia mobile pro

## 5.1 Microinteracciones funcionales
- feedback visual y tactil para acciones clave.

## 5.2 UX offline progresiva
- cache de vistas criticas
- cola de acciones para sincronizar al volver conexion

## 5.3 Instalable PWA avanzada
- mejoras de splash/iconografia por marca final
- mejoras de rendimiento en primera carga

---

## 6. Roadmap sugerido por releases

## R-L1 (Largo plazo inicial)
- Nutricion V1 (registro por comida/alimento)
- objetivos diarios
- resumen diario/semanal

## R-L2
- food library + recientes + duplicar comidas
- mejoras de rapidez de logging

## R-L3
- recomendaciones cruzadas basadas en reglas
- comparativas training/body/nutrition

## R-L4
- integraciones externas de nutricion (si viable)
- automatizacion avanzada

---

## 7. Criterios de exito a largo plazo
- Adherencia nutricional semanal medible y creciente.
- Mejor correlacion entre alimentacion y rendimiento.
- Menor abandono del registro diario.
- Mayor confianza del usuario en recomendaciones de GymOS.

---

## 8. Notas de producto
- Mantener siempre modo simple por defecto y modo detalle opcional.
- Evitar saturar pantalla con datos tecnicos; revelar bajo demanda.
- Toda mejora debe conservar el principio mobile-first.
