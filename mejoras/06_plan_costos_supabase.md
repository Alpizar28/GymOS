# GymOS — Plan de costos Supabase (estimado)

## Objetivo
Documentar el costo esperado de Supabase para GymOS con multiusuario, incluyendo supuestos de uso, limites del plan Pro y escenarios de retencion.

## Fuentes de precios (Supabase)
- Plan Pro: $25/mes (incluye $10 en compute credits).
- Compute (instancias):
  - Micro: ~$10/mes
  - Small: ~$15/mes
  - Medium: ~$60/mes
- Disk: 8 GB incluidos por proyecto, luego $0.125/GB.
- Egress: 250 GB incluidos, luego $0.09/GB.
- MAU: 100,000 incluidos, luego $0.00325/MAU.

Fuentes oficiales:
- https://supabase.com/pricing
- https://supabase.com/docs/guides/platform/compute-and-disk
- https://supabase.com/docs/guides/platform/billing-on-supabase

## Supuestos de uso (actuales)
- Usuarios activos: 500–1000.
- Entrenamiento: 6 dias/semana por usuario.
- Por sesion: 25 sets y 6 ejercicios.
- Historial consultado: 3 veces/semana.
- Regenerar rutinas: 1 vez/semana.
- Retencion: 3 meses (datos anteriores se borran o se resumen).

## Volumen estimado (3 meses)
Por usuario (13 semanas aprox):
- Workouts: 6 * 13 = 78
- Workout exercises: 6 * 78 = 468
- Sets: 25 * 78 = 1,950
- Body metrics: 3–12 entradas

Para 1000 usuarios:
- Workouts: ~78,000
- Workout exercises: ~468,000
- Sets: ~1,950,000
- Body metrics: ~3,000–12,000

## Tamano estimado de BD
- Con indices y metadata: ~1–4 GB para 3 meses.
- Esto cae dentro de los 8 GB incluidos en Pro.

## Costos estimados (plan Pro)
Costos fijos:
- Plan Pro: $25/mes

Compute (segun carga):
- Micro: ~$10/mes (cubierto por los $10 de credito) => $0 extra
- Small: ~$15/mes (credito $10) => $5 extra

Disk (BD):
- 8 GB incluidos => $0 extra en escenario 3 meses

Egress:
- 250 GB incluidos => $0 extra esperado con consultas resumidas

MAU:
- 100,000 incluidos => $0 extra

## Total mensual esperado
- Con Micro: ~$25/mes total
- Con Small: ~$30/mes total

Nota: si la carga o analitica crece, Small o Medium podrian ser necesarios.

## Escenario sin borrado (12 meses de retencion)
- Tamano BD estimado: ~4–16 GB
- Disk extra: 0–8 GB * $0.125 = $0–$1/mes
- Compute: posible paso a Small o Medium si las consultas son intensas

## Recomendacion operativa
- Mantener retencion de 3 meses para costos predecibles.
- Para historial largo, generar resumen mensual y borrar detalle antiguo.
- Empezar con Micro y escalar si hay latencia.

## Checklist de control de costos
- Consultas de historial siempre paginadas y por rango.
- Endpoints de resumen (no full scans).
- Indices por fecha y usuario en tablas pesadas.
- Job de purga o resumen mensual.
