# HIS-09 — QA Funcional (Historial)

## Alcance validado
- Filtros de historial por tipo (`all`, `push`, `pull`, `legs`, `custom`)
- Comparativa semanal (`/api/history/weekly-compare`)
- Persistencia de preferencias en historial (`mode`, `trainingType`, `selectedDate`)
- Leyenda de intensidad en modo detalle

## Estado
- QA tecnico automatizado: **completado**
- QA manual E2E (Today -> Save -> Settings -> filtros -> detalle): **pendiente de ejecucion interactiva en navegador**

## Validaciones ejecutadas (CLI)

### 1) Build frontend
Comando:
```bash
cd web && npm run build
```
Resultado:
- **OK**
- Compila rutas de app correctamente, incluyendo `/settings` y `/today`.

### 2) Lint frontend
Comando:
```bash
cd web && npm run lint
```
Resultado:
- **OK sin errores** (solo warnings no bloqueantes).
- Se corrigio el error legado de `StreakTab` en `web/app/settings/page.tsx:905`.

Observacion:
- Se mantienen warnings de calidad en distintas paginas para atender en hardening (`UX-03`), pero no bloquean QA tecnico.

### 3) Verificacion sintactica backend
Comandos:
```bash
python3 -m py_compile src/api/routes.py
python3 -m compileall -q src
```
Resultado:
- **OK** (sin errores de sintaxis en backend).

## Casos de prueba manuales (checklist HIS-09)

### Flujo principal (smoke)
- [ ] Generar/guardar sesion en `Today`.
- [ ] Ir a `Settings` > Historial.
- [ ] Confirmar que aparece la sesion del dia seleccionado.
- [ ] Abrir detalle de workout desde la lista del dia.

### Filtros por tipo
- [ ] Cambiar filtro a `Push` y verificar que solo se muestran sesiones push.
- [ ] Repetir para `Pull`, `Legs`, `Custom`.
- [ ] Volver a `Todos` y validar restauracion completa.

### Comparativa semanal
- [ ] Verificar bloque "Esta semana vs semana pasada" visible.
- [ ] Confirmar metricas: `Sesiones`, `Sets`, `Volumen`.
- [ ] Confirmar formato de delta absoluto y delta %.

### Persistencia
- [ ] Seleccionar `Detalle`, filtro `Pull`, fecha distinta.
- [ ] Recargar pagina.
- [ ] Validar que se mantiene `mode`, filtro y fecha seleccionada.

### Intensidad del calendario
- [ ] Activar modo `Detalle`.
- [ ] Verificar que aparece leyenda `Baja / Media / Alta`.
- [ ] Validar coherencia visual entre leyenda y dias de mayor volumen.

### Mobile
- [ ] Probar ancho 390x844 (iPhone-like) y 360x800 (Android-like).
- [ ] Confirmar que chips de filtro no rompen layout.
- [ ] Confirmar que no hay overflow horizontal.

## Hallazgos actuales
- Hallazgo 1: warnings de lint no bloqueantes en paginas no relacionadas al flujo HIS-09.
  - Severidad: baja
  - Accion recomendada: consolidar en `UX-03`.

## Criterio de cierre HIS-09
HIS-09 se considera cerrado cuando:
1. Se ejecuta checklist manual completo (desktop + mobile).
2. Se documentan resultados con evidencia (capturas o notas por caso).
3. No hay regresiones funcionales en historial.
