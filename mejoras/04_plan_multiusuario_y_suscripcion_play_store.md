# GymOS — Plan Multiusuario y Suscripcion (Privado -> Play Store)

## Objetivo
Definir una ruta realista para pasar de GymOS single-tenant a producto multiusuario con monetizacion por suscripcion, empezando con familia/amigos y evolucionando a lanzamiento publico en Play Store.

---

## Contexto Actual
- Arquitectura actual: FastAPI + Next.js + SQLite (single-tenant).
- Estado de producto: flujo Today-first estable, rutinas, progresion deterministica, historial unificado.
- Necesidad de negocio:
  - corto/mediano plazo: cuentas separadas para novia, mama y amigos;
  - largo plazo: suscripcion para publico general.

---

## Principios de Implementacion
- Aislamiento estricto de datos por usuario desde la base de datos y backend.
- Progresion y reglas de entrenamiento siguen siendo deterministicas por usuario.
- Cambios por fases para evitar romper el flujo actual.
- Seguridad y privacidad como requisito de producto, no opcional.

---

## Fase 1 (0-6 semanas): Multiusuario privado minimo viable

## 1) Identidad y autenticacion
- Implementar registro/login con email + password.
- Soportar recuperacion de contrasena.
- Gestion de sesion con tokens (access + refresh) o proveedor externo.

## 2) Modelo de datos multiusuario
- Agregar `user_id` a entidades principales:
  - workouts, workout_exercises, sets,
  - plans, plan_days,
  - routines, routine_exercises, routine_sets,
  - anchor_targets,
  - athlete_state,
  - settings personalizadas.
- Convertir constraints unicas globales a unicas por usuario donde aplique.

## 3) Aislamiento en API
- Todas las queries deben filtrar por usuario autenticado.
- Ningun endpoint debe devolver datos de otro usuario.
- Agregar pruebas de aislamiento (caso usuario A vs usuario B).

## 4) Migracion de base de datos
- Migrar de SQLite a PostgreSQL antes de abrir a mas usuarios.
- Introducir migraciones versionadas (Alembic).
- Backfill inicial: asignar data existente al usuario owner.

---

## Fase 2 (6-12 semanas): Producto pequeno vendible

## 1) Operacion y control
- Rol `admin` para soporte basico.
- Panel interno minimo:
  - listado de usuarios,
  - estado de cuenta,
  - actividad reciente,
  - opcion de desactivar cuenta.

## 2) Producto y retencion
- Onboarding corto por usuario (objetivo, experiencia, dias disponibles).
- Limites de plan gratis vs plan pago.
- Telemetria minima:
  - activacion (primera rutina completada),
  - retencion semanal,
  - uso de progresion de anchors.

## 3) Seguridad
- Rate limit de autenticacion y endpoints sensibles.
- Politicas basicas de contrasena.
- Logs con trazabilidad por user_id.

---

## Fase 3 (12-20 semanas): Suscripcion y Play Store

## 1) Billing
- Integrar Google Play Billing para compras in-app en Android.
- Validar recibos en backend (no confiar solo en cliente).
- Modelo de suscripcion con estados:
  - active,
  - grace_period,
  - canceled,
  - expired.

## 2) Entitlements
- Definir que desbloquea premium:
  - analitica avanzada,
  - historial extendido,
  - funciones pro de rutinas/progresion,
  - backups/exportaciones.
- Aplicar control de acceso por backend.

## 3) Publicacion
- Politica de privacidad y terminos de uso.
- Flujo de eliminacion de cuenta y datos.
- QA en multiples dispositivos Android.

---

## Fase 4 (20+ semanas): Escala publica
- Jobs asyncronos para procesos pesados.
- Observabilidad completa (errores, latencia, saturacion).
- Backups automaticos y restauracion validada.
- Endurecimiento anti-abuso y monitoreo de fraude en suscripciones.

---

## Riesgos Principales y Mitigacion

## Riesgo A: fuga de datos entre usuarios
- Mitigacion: policy de "todo query con user_id" + tests obligatorios por endpoint.

## Riesgo B: deuda tecnica por migracion apresurada
- Mitigacion: migracion por capas (schema -> backfill -> enforce constraints).

## Riesgo C: billing inconsistente entre cliente y servidor
- Mitigacion: backend como fuente de verdad para estados de suscripcion.

## Riesgo D: complejidad operativa temprana
- Mitigacion: lanzar primero closed beta (familia/amigos) con cohortes pequenas.

---

## Checklist tecnico sugerido
1. Introducir auth + user model.
2. Agregar user_id en tablas y migraciones.
3. Refactor de servicios/rutas para aislamiento por usuario.
4. Test suite de seguridad de acceso.
5. Migrar a PostgreSQL.
6. Activar panel admin minimo.
7. Implementar billing Play Store y validacion server-side.
8. Publicar beta cerrada.
9. Ajustar retencion/precio con datos reales.
10. Preparar release publico.

---

## Metricas clave para tomar decisiones
- Activacion D1: porcentaje de usuarios que completan primera sesion.
- Retencion W1/W4.
- Conversion free -> paid.
- Churn mensual.
- Tiempo medio por sesion y frecuencia semanal.
- Errores de autorizacion/aislamiento (debe tender a cero).
