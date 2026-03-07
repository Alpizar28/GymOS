# GymOS — Posibles Mejoras Proximas (0 a 6 semanas)

## Objetivo
Este documento define mejoras de alto impacto y bajo riesgo para elevar diseno, experiencia de uso y claridad sin romper el flujo principal de entrenamiento.

## Estado de avance (actualizado)
- `COMPLETADO`: feature implementado y visible en flujo principal.
- `PARCIAL`: implementado en parte, faltan estandarizacion o detalles.
- `PENDIENTE`: no implementado aun en UI principal.

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

**Estado**: `COMPLETADO` (con pequena variacion)

**Mejora**
- Presets rapidos de descanso por set: 60s, 90s, 120s.
- Boton de reinicio rapido del timer en la misma tarjeta del set.
- Persistir ultimo valor elegido durante la sesion.

**Implementado hoy**
- Presets activos: 90s, 120s, 150s.
- Reset rapido y controles Start/Pause/+30/Skip.
- Inicio automatico al completar set.

**Impacto esperado**
- Menos taps por set.
- Mejor ritmo de sesion y menos distracciones.

### A2. Flujo de entrada numerica mobile-first
**Problema**: el teclado nativo era lento para registrar pesos y hacia friccion en pleno entrenamiento.

**Estado**: `COMPLETADO`

**Mejora**
- Teclado personalizado para `lbs` con accesos rapidos y apertura de Plate Calculator.
- Teclado personalizado para `reps` y `rir` con botones `+1/-1`.
- Edicion en vivo del input activo sin salto automatico de foco.

**Impacto esperado**
- Menos taps y menos errores de digitacion en mobile.

### A3. Undo de acciones destructivas
**Problema**: borrar set/ejercicio por error cuesta tiempo y causa frustracion.

**Estado**: `COMPLETADO`

**Mejora**
- Snackbar con opcion "Deshacer" durante 5 segundos para:
  - eliminar set
  - eliminar ejercicio

**Impacto esperado**
- Menos perdida accidental de progreso.

### A4. Cierre real de sesion (Finish)
**Problema**: finalizar sesion no transmitia claramente que el entrenamiento habia cerrado.

**Estado**: `COMPLETADO`

**Mejora**
- Modal de resumen antes de finalizar (ejercicios, sets y volumen).
- Confirmacion final con fatiga y avance de dia.
- Pantalla final con racha de dias y resumen de sesion.

**Impacto esperado**
- Mayor sensacion de logro y menor ambiguedad al terminar.

### A5. Selector de tipo de set en Today
**Problema**: al agregar sets no se podia elegir claramente entre warmup/approach/effective/drop.

**Estado**: `COMPLETADO`

**Mejora**
- Acciones rapidas `+W`, `+A`, `+E`, `+D` en cada ejercicio.
- Persistencia de `set_type` en `today/log`.
- Visual por tipo de set en tarjetas.

**Impacto esperado**
- Registro mas fiel al flujo real de entrenamiento.

---

## B. Historial unificado (calendario + rachas + detalle)

### B1. Filtros de sesiones
**Problema**: historial puede verse plano sin segmentacion.

**Estado**: `COMPLETADO`

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

**Estado**: `COMPLETADO`

**Mejora**
- Bloque "Esta semana vs Semana pasada" con:
  - sesiones
  - sets
  - volumen

**Impacto esperado**
- Mayor claridad de progreso real, no solo percepcion subjetiva.

### B3. Leyenda de intensidad
**Problema**: escala de color del calendario puede no ser obvia.

**Estado**: `COMPLETADO`

**Mejora**
- Agregar leyenda visual minima: baja, media, alta.

**Impacto esperado**
- Mejor interpretacion del heatmap mensual.

---

## C. Routines (rapidez de creacion y mantenimiento)

### C1. Duplicar rutina desde tarjeta
**Problema**: duplicar requiere entrar al detalle.

**Estado**: `COMPLETADO`

**Mejora**
- Accion "Duplicar" visible en card de rutina.

**Impacto esperado**
- Menos pasos para crear variaciones de rutina.

**Implementado hoy**
- Boton `Duplicar` visible en card de rutina.
- Duplica sin entrar al detalle y refresca lista.

### C2. Bloques rapidos
**Problema**: crear rutina desde cero es lento para casos repetitivos.

**Estado**: `COMPLETADO`

**Mejora**
- Plantillas rapidas de bloque:
  - Push
  - Pull
  - Legs

**Impacto esperado**
- Creacion inicial en segundos y luego ajuste fino.

**Implementado hoy**
- En crear rutina se agregaron bloques rapidos `Push`, `Pull`, `Legs`.
- Opcion `Vacia` para mantener flujo manual.
- Al elegir bloque, la rutina se crea con ejercicios/sets base editables.

### C3. Calculadora de discos + barra visual
**Problema**: calcular carga total en barra era lento y propenso a error.

**Estado**: `COMPLETADO`

**Mejora**
- Plate Calculator integrado al flujo de peso.
- Visualizacion grafica de barra con discos por lado.
- Soporte de barra corta configurable desde Perfil.

**Impacto esperado**
- Menor error de carga y mejor velocidad de logging.

---

## D. Consistencia visual y de feedback

### D1. Sistema de feedback unificado
**Estado**: `PARCIAL`

**Mejora**
- Estandarizar toasts para toda la app:
  - posicion
  - duracion
  - tono visual por tipo de mensaje

**Nota**
- Existen toasts locales en varias pantallas, pero no un sistema unico compartido.

### D2. Jerarquia de botones consistente
**Estado**: `PARCIAL`

**Mejora**
- Primario = rojo.
- Secundario = borde zinc.
- Destructivo = rojo oscuro + confirmacion.

### D3. Simplificacion de copy
**Estado**: `PARCIAL`

**Mejora**
- Reducir textos largos y repetidos.
- Priorizar titulos cortos y subtitulos de una linea.

---

## E. Rendimiento percibido

### E1. Skeletons en vistas criticas
**Estado**: `PENDIENTE`

**Mejora**
- Reemplazar spinners por skeletons en:
  - Today
  - Historial
  - Routines
  - Perfil

**Impacto esperado**
- App percibida como mas rapida y estable.

### E2. Persistencia de contexto
**Estado**: `PARCIAL`

**Mejora**
- Recordar:
  - mes seleccionado en historial
  - modo Resumen/Detalle
  - seccion activa en Perfil

**Implementado hoy**
- Historial: se persisten `selectedDate`, `mode`, `trainingType`.
- Today: se persiste borrador de sesion por dia.
- Falta persistir seccion activa en Perfil.

### E3. Warmups no obligatorios en todos los ejercicios
**Estado**: `COMPLETADO`

**Mejora**
- Normalizacion de plan para limitar warmups automaticos a ejercicios principales.
- Warmups siguen disponibles manualmente cuando el usuario los necesita.

**Impacto esperado**
- Planes mas limpios por defecto sin perder control manual.

**Impacto esperado**
- Menos repeticion de acciones al navegar.

---

## Checklist de implementacion sugerida (pendientes)
1. Feedback unificado (toast global)
2. Jerarquia visual final de botones en todas las vistas
3. Skeletons en Today/Historial/Routines/Perfil
4. Persistir seccion activa en Perfil
5. Pulido final de copy en modales y CTAs secundarios

---

## F. Migracion a Supabase (completada)

### Estado
- Infra principal migrada a Supabase/Postgres.
- Auth (email + Google) activa.
- Backend validando JWT.
- RLS activo para tablas de negocio principales.
- Storage de perfil activo (`profile-photos`).

### Entregables cerrados
1. Configuracion de entornos en Coolify para frontend/backend.
2. Conexion estable al pooler de Supabase.
3. Ajuste de compatibilidad `asyncpg` + pooler (`DATABASE_STATEMENT_CACHE_SIZE=0`).
4. Script SQL de hardening post-cutover.
5. Validacion funcional E2E en dominios nuevos.

### Pendientes posteriores al cutover
1. Rotacion periodica de credenciales sensibles.
2. Automatizar backup/restore drills.
3. Definir politica de retencion y purga historica.
4. Revisar costos reales y alertas operativas mensuales.

---

---

## Metricas para validar impacto
- Tiempo promedio de registro de sesion en Today.
- Numero de taps por set completado.
- Tasa de uso de historial (visitas por semana).
- Uso de duplicado de rutina.
- Errores de borrado (cuantas veces se usa Undo).
- Tiempo promedio hasta `Finish` confirmado.
- Uso de Plate Calculator vs entrada manual de peso.
