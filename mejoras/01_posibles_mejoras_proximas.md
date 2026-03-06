# GymOS — Posibles Mejoras Proximas (0 a 6 semanas)

## Objetivo
Este documento define mejoras de alto impacto y bajo riesgo para elevar diseno, experiencia de uso y claridad sin romper el flujo principal de entrenamiento.

## Principios de esta fase
- Priorizar mejoras que reduzcan friccion en uso diario.
- Mantener compatibilidad con la arquitectura actual (multiusuario con Supabase Auth/RLS, FastAPI + Next.js).
- Evitar cambios de dominio complejos (sin migraciones profundas en esta fase).
- Garantizar que todo sea mobile-first y consistente con el estilo visual actual (dark + red).

## Nota de alcance actualizada
- Este documento tambien incluye la migracion a Supabase como prioridad corta.
- La migracion se detalla de forma extensa por su impacto transversal.

---

## A. UX y Productividad en Today

### A1. Rest timer mas util
**Problema**: el descanso existe, pero no siempre se ajusta al contexto del ejercicio.

**Mejora**
- Presets rapidos de descanso por set: 60s, 90s, 120s.
- Boton de reinicio rapido del timer en la misma tarjeta del set.
- Persistir ultimo valor elegido durante la sesion.

**Impacto esperado**
- Menos taps por set.
- Mejor ritmo de sesion y menos distracciones.

### A2. Autofocus secuencial
**Problema**: completar set requiere moverse manualmente entre campos y sets.

**Mejora**
- Al marcar set como completado, mover foco al siguiente set (o siguiente ejercicio si no hay mas sets).
- En mobile, abrir teclado solo cuando el campo esperado no esta completo.

**Impacto esperado**
- Flujo mas continuo tipo app nativa.

### A3. Undo de acciones destructivas
**Problema**: borrar set/ejercicio por error cuesta tiempo y causa frustracion.

**Mejora**
- Snackbar con opcion "Deshacer" durante 5 segundos para:
  - eliminar set
  - eliminar ejercicio

**Impacto esperado**
- Menos perdida accidental de progreso.

---

## B. Historial unificado (calendario + rachas + detalle)

### B1. Filtros de sesiones
**Problema**: historial puede verse plano sin segmentacion.

**Mejora**
- Filtros compactos:
  - Todos
  - Push
  - Pull
  - Legs
  - Custom

**Impacto esperado**
- Lectura mas rapida de tendencias por tipo de entrenamiento.

### B2. Comparacion semanal
**Problema**: cuesta entender progreso reciente con una sola cifra.

**Mejora**
- Bloque "Esta semana vs Semana pasada" con:
  - sesiones
  - sets
  - volumen

**Impacto esperado**
- Mayor claridad de progreso real, no solo percepcion subjetiva.

### B3. Leyenda de intensidad
**Problema**: escala de color del calendario puede no ser obvia.

**Mejora**
- Agregar leyenda visual minima: baja, media, alta.

**Impacto esperado**
- Mejor interpretacion del heatmap mensual.

---

## C. Routines (rapidez de creacion y mantenimiento)

### C1. Duplicar rutina desde tarjeta
**Problema**: duplicar requiere entrar al detalle.

**Mejora**
- Accion "Duplicar" visible en card de rutina.

**Impacto esperado**
- Menos pasos para crear variaciones de rutina.

### C2. Bloques rapidos
**Problema**: crear rutina desde cero es lento para casos repetitivos.

**Mejora**
- Plantillas rapidas de bloque:
  - Push
  - Pull
  - Legs

**Impacto esperado**
- Creacion inicial en segundos y luego ajuste fino.

---

## D. Consistencia visual y de feedback

### D1. Sistema de feedback unificado
**Mejora**
- Estandarizar toasts para toda la app:
  - posicion
  - duracion
  - tono visual por tipo de mensaje

### D2. Jerarquia de botones consistente
**Mejora**
- Primario = rojo.
- Secundario = borde zinc.
- Destructivo = rojo oscuro + confirmacion.

### D3. Simplificacion de copy
**Mejora**
- Reducir textos largos y repetidos.
- Priorizar titulos cortos y subtitulos de una linea.

---

## E. Rendimiento percibido

### E1. Skeletons en vistas criticas
**Mejora**
- Reemplazar spinners por skeletons en:
  - Today
  - Historial
  - Routines
  - Perfil

**Impacto esperado**
- App percibida como mas rapida y estable.

### E2. Persistencia de contexto
**Mejora**
- Recordar:
  - mes seleccionado en historial
  - modo Resumen/Detalle
  - seccion activa en Perfil

**Impacto esperado**
- Menos repeticion de acciones al navegar.

---

## Checklist de implementacion sugerida (orden recomendado)
1. Undo de borrado (sets/ejercicios)
2. Rest timer con presets
3. Autofocus secuencial
4. Historial: filtros + leyenda + comparacion semanal
5. Routines: duplicar en tarjeta + bloques rapidos
6. Feedback unificado + simplificacion de copy
7. Skeletons + persistencia de contexto

---

## F. Migracion a Supabase (muy detallado, corto plazo)

### F0. Preparacion y definiciones
**Objetivo**: pasar de SQLite local a Postgres administrado (Supabase) sin romper el flujo actual.

**Definiciones clave**
- Proyecto Supabase unico para produccion.
- Auth con Google via Supabase Auth.
- Backend FastAPI sigue siendo fuente de verdad de negocio.
- Plan de retencion inicial: 3 meses para datos detallados.

### F1. Configuracion de infraestructura Supabase
1. Crear proyecto Supabase en la region mas cercana a los usuarios.
2. Configurar plan Pro y limites de uso.
3. Habilitar backups diarios y retencion 7 dias.
4. Configurar alertas de uso (egress, disk, compute).
5. Crear claves de servicio y anon para uso en backend.

### F2. Auth Google (Supabase Auth)
1. Crear OAuth Client en Google Cloud Console.
2. Configurar redirect URIs para:
   - Produccion
   - Staging
   - Local dev
3. Activar proveedor Google en Supabase Auth.
4. Probar flujo login/logout desde frontend.
5. Asegurar que el backend valida el JWT emitido por Supabase.

### F3. Preparar backend para Postgres
1. Introducir Alembic si no existe.
2. Crear migracion inicial con el schema actual.
3. Ajustar modelos SQLAlchemy si se requieren tipos especificos Postgres.
4. Asegurar que `DATABASE_URL` soporte `postgresql+asyncpg`.

### F4. Migracion de datos desde SQLite
1. Congelar escritura en SQLite (modo mantenimiento temporal).
2. Exportar datos de SQLite:
   - workouts, workout_exercises, sets
   - routines, routine_exercises, routine_sets
   - plans, plan_days
   - anchor_targets, athlete_state, settings
   - body_metrics
3. Transformar datos si hay cambios de schema.
4. Importar a Postgres en orden correcto respetando FK.
5. Validar conteos por tabla (SQLite vs Postgres).

### F5. Cambios de configuracion
1. Actualizar variables de entorno en Coolify:
   - `DATABASE_URL`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. Ajustar el pool de conexiones (asyncpg) para produccion.

### F6. Verificacion funcional
1. Ejecutar smoke tests backend.
2. Verificar endpoints criticos:
   - Today logging
   - Historial
   - Routines
   - Body metrics
3. Validar latencia y queries pesadas.

### F7. Cortes y rollout
1. Ventana de mantenimiento corta para cutover.
2. Cambio de `DATABASE_URL` a Postgres.
3. Monitoreo intensivo primeras 24-48h.
4. Plan de rollback (volver a SQLite si falla).

### F8. Post-migracion
1. Activar retencion de 3 meses (purga automatizada).
2. Implementar job de resumen mensual si se conserva historico.
3. Revisar indices en tablas de alto volumen.
4. Revisar costos reales vs estimados.

### F9. Seguridad y aislamiento
1. Definir estrategia de `user_id` para multiusuario futuro.
2. Preparar RLS opcional (si se usa Supabase directamente en frontend).
3. Mantener backend como capa de autorizacion principal.

---

---

## Metricas para validar impacto
- Tiempo promedio de registro de sesion en Today.
- Numero de taps por set completado.
- Tasa de uso de historial (visitas por semana).
- Uso de duplicado de rutina.
- Errores de borrado (cuantas veces se usa Undo).
