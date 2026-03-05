# GymOS — Posibles Mejoras Proximas (0 a 6 semanas)

## Objetivo
Este documento define mejoras de alto impacto y bajo riesgo para elevar diseno, experiencia de uso y claridad sin romper el flujo principal de entrenamiento.

## Principios de esta fase
- Priorizar mejoras que reduzcan friccion en uso diario.
- Mantener compatibilidad con la arquitectura actual (single-tenant, FastAPI + Next.js).
- Evitar cambios de dominio complejos (sin migraciones profundas en esta fase).
- Garantizar que todo sea mobile-first y consistente con el estilo visual actual (dark + red).

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

## Metricas para validar impacto
- Tiempo promedio de registro de sesion en Today.
- Numero de taps por set completado.
- Tasa de uso de historial (visitas por semana).
- Uso de duplicado de rutina.
- Errores de borrado (cuantas veces se usa Undo).
