# Performance Improvements Roadmap

Este documento define mejoras de rendimiento priorizadas para GymOS.
Enfoca latencia percibida, estabilidad bajo carga y costo operativo.

## Objetivos

- Reducir tiempo de carga inicial en frontend.
- Reducir latencia de endpoints clave (`/api/today`, `/api/dashboard`, `/api/routines`).
- Evitar timeouts intermitentes por dependencias externas.
- Mejorar capacidad de diagnóstico en producción.

## Estado actual (Mar 2026)

- `COMPLETADO`: timeout acotado para JWKS/auth en backend para reducir bloqueos y 504.
- `COMPLETADO`: hardening de build frontend para evitar fallos por desalineacion de contratos.
- `COMPLETADO`: flujo de `Finish` con autosave previo para reducir inconsistencias de cierre.
- `EN PROGRESO`: UX mobile-first de entrada numerica (keypad custom + calculadora).

## KPIs objetivo

- Frontend TTFB p95: < 600ms.
- API p95 (rutas críticas): < 400ms.
- Error rate 5xx: < 0.5%.
- Timeouts proxy 504: ~0 en operación normal.

## Quick Wins (1-3 dias)

1. **Caching corto en proxy backend discovery**
   - Mantener y ajustar TTL de descubrimiento del backend.
   - Evitar reprobar endpoints en cada request.

2. **Timeouts y retry controlado en llamadas externas**
   - Conservar timeout corto en JWKS/Supabase.
   - Añadir retry simple con backoff para errores transitorios.
   - Estado: timeout JWKS implementado, retry pendiente.

3. **Indices SQL para consultas calientes**
   - Revisar rutas con `order_by(date desc)` y filtros por `user_id`.
   - Crear índices compuestos donde aplique.

4. **Reducir payloads grandes en listas**
   - Aplicar paginación o límites por defecto en endpoints de historial.
   - Evitar campos innecesarios en respuesta.

## Backend (1-2 semanas)

1. **Perfilado de endpoints críticos**
   - Medir latencia por endpoint y por query SQL.
   - Identificar N+1 o joins costosos.

2. **Optimización de acceso a DB**
   - Consolidar lecturas duplicadas por request.
   - Evitar serialización JSON repetida de settings.

3. **Session/bootstrap optimization**
   - Asegurar que `ensure_user_bootstrap` no haga trabajo redundante por request.
   - Cachear checks de existencia cuando sea seguro.

## Frontend (1-2 semanas)

1. **Split de componentes pesados**
   - Lazy load para vistas no críticas (`calendar`, `progress`, `library`).

2. **Fetch inteligente en cliente**
   - Evitar requests duplicados al montar pantallas.
   - Reutilizar datos en navegación interna.

3. **Optimización visual**
   - Comprimir imágenes grandes y usar tamaños fijos de render.
   - Mantener logos/íconos livianos y cacheables.
   - Mantener modales de entrada numerica y calculadora usables en pantallas chicas.

## Infraestructura

1. **Healthcheck profundo opcional**
   - Endpoint de salud extendido: DB + auth dependency reachability.

2. **Variables y secretos consistentes por entorno**
   - Evitar env vacíos en build/runtime para claves públicas.

3. **Política de recursos**
   - Definir CPU/RAM mínimos para frontend y backend en Coolify.
   - Revisar reinicios por OOM o throttling.

## Observabilidad mínima recomendada

- Log estructurado por request: método, ruta, status, duración.
- Log de fallos proxy con causa (`timeout`, `connection refused`, `401`).
- Métricas por endpoint (p50/p95/p99) y dashboard de errores.

## Plan por fases

### Fase 1 (rápida)
- Instrumentación básica de latencia y errores.
- Ajustes de timeout/retry.
- 2-3 índices DB de mayor impacto.

### Fase 2 (optimización)
- Refactor de queries lentas.
- Reducción de payloads y paginación.
- Mejoras de carga de vistas pesadas.

### Fase 3 (hardening)
- Budget de performance por release.
- Alertas automáticas por incremento de p95 y 5xx.

## Criterios de éxito

- Deploys sin regresión de tiempo de respuesta.
- Menos incidencias de timeout percibidas por usuarios.
- Diagnóstico de incidentes en minutos, no horas.
- Flujo de logging en Today estable en mobile sin bloqueos de teclado nativo.
