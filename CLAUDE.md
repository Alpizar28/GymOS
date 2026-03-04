# GymOS - Documento de Contexto del Proyecto

> **Propósito**: Este documento proporciona contexto completo del proyecto GymOS para que Claude (u otro LLM) pueda entender la arquitectura, patrones y decisiones de diseño sin necesidad de explorar el código cada vez.

---

## 1. RESUMEN EJECUTIVO

### ¿Qué es GymOS?

GymOS es un **sistema integral de entrenamiento personal** que combina:

- **Análisis de datos históricos** de entrenamiento (327+ sesiones)
- **Motor de progresión determinista** basado en RIR (Reps In Reserve)
- **Generación de planes con LLM** (OpenAI GPT-4o)
- **Dashboard web** para tracking y logging de workouts
- **Sistema de protección** para lesiones/dolor

### Stack Tecnológico

| Capa | Tecnología | Versión |
|------|------------|---------|
| **Backend** | FastAPI + SQLAlchemy (async) | Python 3.11+ |
| **Frontend** | Next.js + React + Tailwind | Next.js 16, React 19 |
| **Base de Datos** | SQLite (aiosqlite) | - |
| **LLM** | OpenAI API | GPT-4o |
| **Deployment** | Docker Compose + Nginx | - |

### Diseño Single-Tenant

GymOS está diseñado para **un solo atleta** (Jose Alpizar). El `AthleteState` es un singleton (siempre `id=1`). Todo el sistema se adapta basado en el historial personal del atleta.

---

## 2. ARQUITECTURA GENERAL

### Diagrama de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                    │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                        ┌───────────▼───────────┐
                        │        NGINX          │
                        │  gymos.com → :3000    │
                        │  api.gymos.com → :8000│
                        └───────────┬───────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
            ▼                       ▼                       │
┌───────────────────┐   ┌───────────────────┐              │
│   FRONTEND        │   │   BACKEND         │              │
│   Next.js :3000   │──▶│   FastAPI :8000   │              │
│                   │   │                   │              │
│  • Dashboard      │   │  • REST API       │              │
│  • Today Logger   │   │  • Services       │              │
│  • Week Planner   │   │  • Progression    │              │
│  • Progress Charts│   │  • LLM Integration│              │
└───────────────────┘   └─────────┬─────────┘              │
                                  │                        │
                        ┌─────────▼─────────┐              │
                        │     SQLite        │              │
                        │   gym.db          │              │
                        └───────────────────┘              │
                                                           │
                        ┌──────────────────────────────────┘
                        │
                        ▼
                ┌───────────────┐
                │   OpenAI API  │
                │   GPT-4o      │
                └───────────────┘
```

### Pipeline de Datos (Offline)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  CSV Export  │────▶│ process_gym  │────▶│  Markdown    │────▶│ convert_to_  │
│  (gym app)   │     │    .py       │     │    Log       │     │ structured.py│
└──────────────┘     └──────────────┘     └──────────────┘     └──────┬───────┘
                                                                       │
                                                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              analyze_training.py                              │
│   Genera 3 archivos JSON a partir del historial de entrenamiento              │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐         ┌─────────────────┐         ┌─────────────────────┐
│ATHLETE_PROFILE│         │EXERCISE_LIBRARY │         │PROGRAM_CONSTRAINTS  │
│    .json      │         │     .json       │         │       .json         │
│               │         │                 │         │                     │
│ • 327 sesiones│         │ • ~95 ejercicios│         │ • Límites de volumen│
│ • Métricas    │         │ • Stats por ej. │         │ • Frecuencia        │
│ • Patrones    │         │ • Anchors/Staple│         │ • Balance push/pull │
└───────────────┘         └─────────────────┘         └─────────────────────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    │
                        ┌───────────▼───────────┐
                        │   scripts/seed_db.py  │
                        │   Puebla la DB        │
                        └───────────────────────┘
```

---

## 3. ESTRUCTURA DEL PROYECTO

```
GymOS/
├── src/                          # Backend FastAPI
│   ├── __init__.py
│   ├── main.py                   # Entry point, lifespan, CORS
│   ├── config.py                 # Pydantic Settings (.env)
│   ├── database.py               # SQLAlchemy async engine
│   ├── api/
│   │   └── routes.py             # Todos los endpoints REST
│   ├── llm/
│   │   ├── client.py             # Wrapper OpenAI con fallback
│   │   └── prompts.py            # Templates de prompts
│   ├── models/                   # SQLAlchemy ORM
│   │   ├── exercises.py          # Exercise, ExerciseStats
│   │   ├── workouts.py           # Workout, WorkoutExercise, WorkoutSet
│   │   ├── plans.py              # Plan, PlanDay
│   │   ├── progression.py        # AnchorTarget
│   │   ├── settings.py           # Setting, WeekTemplate, AthleteState
│   │   └── feedback.py           # SessionFeedback
│   └── services/                 # Lógica de negocio
│       ├── import_service.py     # Importación JSON → DB
│       ├── plan_generator.py     # Generación de planes (LLM)
│       ├── workout_logger.py     # Parser de workouts
│       ├── progression_engine.py # Motor de progresión (determinista)
│       ├── protection_service.py # Modo protección (lesiones)
│       ├── stats_service.py      # Stats semanales
│       └── swap_service.py       # Alternativas de ejercicios
│
├── web/                          # Frontend Next.js
│   ├── app/                      # App Router
│   │   ├── layout.tsx            # Layout con navegación
│   │   ├── page.tsx              # Dashboard (/)
│   │   ├── today/page.tsx        # Logger de workout (/today)
│   │   ├── week/page.tsx         # Plan semanal (/week)
│   │   ├── workouts/page.tsx     # Historial (/workouts)
│   │   ├── library/page.tsx      # Biblioteca ejercicios (/library)
│   │   ├── progress/page.tsx     # Gráficos progreso (/progress)
│   │   ├── settings/page.tsx     # Configuración (/settings)
│   │   └── globals.css           # Estilos Tailwind
│   ├── lib/
│   │   └── api.ts                # Cliente API + tipos TypeScript
│   ├── next.config.ts            # Proxy /api → backend
│   └── package.json
│
├── scripts/
│   └── seed_db.py                # CLI para poblar DB
│
├── tests/
│   ├── test_import_service.py
│   ├── test_progression_engine.py
│   └── test_workout_logger.py
│
├── nginx/
│   └── gymos.conf                # Config Nginx producción
│
├── analyze_training.py           # Genera JSON desde datos estructurados
├── convert_to_structured.py      # Markdown → formato estructurado
├── process_gym.py                # CSV → Markdown
│
├── ATHLETE_PROFILE.json          # Perfil del atleta (327 sesiones)
├── EXERCISE_LIBRARY.json         # ~95 ejercicios con stats
├── PROGRAM_CONSTRAINTS.json      # Límites para generación
│
├── jose_alpizar_data.csv         # Datos raw exportados
├── jose_alpizar_training_log.md  # Log en Markdown
├── jose_alpizar_structured.txt   # Formato estructurado YAML-like
│
├── docker-compose.yaml
├── Dockerfile.backend
├── Dockerfile.frontend
├── pyproject.toml
└── .env.example
```

---

## 4. MODELOS DE DATOS (ORM)

### Diagrama Entidad-Relación

```
┌─────────────────┐         ┌─────────────────┐
│    Exercise     │   1:1   │  ExerciseStats  │
├─────────────────┤◄───────►├─────────────────┤
│ PK id           │         │ PK exercise_id  │
│    name_canon   │         │    avg_reps     │
│    aliases_json │         │    avg_weight   │
│    primary_mus  │         │    max_weight   │
│    second_mus   │         │    freq_score   │
│    type         │         │    total_sets   │
│    mov_pattern  │         │    vol_contrib  │
│    is_anchor    │         │    updated_at   │
│    is_staple    │         └─────────────────┘
└────────┬────────┘
         │
         │ 1:1 (si is_anchor=true)
         ▼
┌─────────────────┐
│  AnchorTarget   │
├─────────────────┤
│ PK exercise_id  │
│    target_wt    │
│    target_reps  │
│    rule_profile │  ◄── JSON: {increment_lbs, deload_pct, consolidation_sessions}
│    streak       │
│    status       │  ◄── active | deload | consolidate
│    last_rir     │
└─────────────────┘


┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│    Workout      │   1:N   │ WorkoutExercise │   1:N   │   WorkoutSet    │
├─────────────────┤◄───────►├─────────────────┤◄───────►├─────────────────┤
│ PK id           │         │ PK id           │         │ PK id           │
│    date         │         │ FK workout_id   │         │ FK workout_ex_id│
│    duration_min │         │ FK exercise_id  │         │    set_type     │  ◄── warmup|normal|drop
│    bodyweight   │         │    order_index  │         │    weight       │
│    notes        │         └─────────────────┘         │    reps         │
│    template_day │                                     │    rir          │
│    created_at   │                                     │    planned_*    │  ◄── del plan LLM
└────────┬────────┘                                     │    actual_*     │  ◄── loggeado por user
         │                                              │    completed    │
         │ 1:1                                          └─────────────────┘
         ▼
┌─────────────────┐
│ SessionFeedback │
├─────────────────┤
│ PK workout_id   │
│    soreness_json│  ◄── {"chest": 5, "shoulders": 3}
│    fatigue      │  ◄── 0-10
│    pain_flags   │  ◄── ["left_shoulder", "lower_back"]
└─────────────────┘


┌─────────────────┐         ┌─────────────────┐
│      Plan       │   1:N   │    PlanDay      │
├─────────────────┤◄───────►├─────────────────┤
│ PK id           │         │ PK id           │
│    start_date   │         │ FK plan_id      │
│    end_date     │         │    date         │
│    goal         │         │    template_name│
│    days_per_wk  │         │    content_json │  ◄── Plan completo del LLM
│    created_at   │         │    valid_json   │
└─────────────────┘         └─────────────────┘


┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Setting      │    │  WeekTemplate   │    │  AthleteState   │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ PK key          │    │ PK day_index    │    │ PK id (=1)      │  ◄── SINGLETON
│    value (JSON) │    │    name         │    │    next_day_idx │
└─────────────────┘    │    focus        │    │    fatigue_score│
                       │    rules_json   │    │    updated_at   │
                       └─────────────────┘    └─────────────────┘
```

### Split de 6 Días (WeekTemplate)

| day_index | name | focus |
|-----------|------|-------|
| 1 | Push_Heavy | Chest & Shoulders - Strength |
| 2 | Pull_Heavy | Back & Biceps - Strength |
| 3 | Legs_Heavy | Quads & Hamstrings - Strength |
| 4 | Push_Light | Chest & Shoulders - Volume |
| 5 | Pull_Light | Back & Biceps - Volume |
| 6 | Legs_Light | Quads & Hamstrings - Volume |

### Ejercicios Anchor (Strength Tracking)

Los "anchors" son ejercicios clave donde se trackea progresión de fuerza:

| Ejercicio | Tipo | Patrón |
|-----------|------|--------|
| Bench Press | compound | horizontal_push |
| Incline Bench Press | compound | horizontal_push |
| Overhead Press | compound | vertical_push |
| Lat Pulldown | compound | vertical_pull |
| Seated Cable Row | compound | horizontal_pull |
| Squat (Smith) | compound | squat |
| Leg Press | compound | squat |
| Romanian Deadlift | compound | hinge |

---

## 5. SERVICIOS PRINCIPALES

### 5.1 Plan Generator (`services/plan_generator.py`)

**Responsabilidad**: Generar planes de entrenamiento diarios usando LLM.

**Flujo**:
```
1. get_day_template(day_index) → WeekTemplate
2. get_anchor_targets_for_day() → AnchorTarget[]
3. get_exercises_for_day() → Exercise[] (filtrado por movimiento)
4. get_constraints() → PROGRAM_CONSTRAINTS
5. build_generate_day_prompt(...) → prompt completo
6. call_llm_json(system, user) → plan JSON
7. _validate_plan() → validación opcional
8. Crear Plan + PlanDay en DB
```

**Fallback**: Si OpenAI no está disponible, `_generate_fallback_plan()` crea un plan básico determinista.

**Formato de Plan Generado**:
```json
{
  "day_name": "Push_Heavy",
  "estimated_duration_min": 75,
  "exercises": [
    {
      "name": "Incline Bench Press",
      "is_anchor": true,
      "sets": [
        {"set_type": "warmup", "weight_lbs": 95, "target_reps": 10, "rir_target": 5, "rest_seconds": 60},
        {"set_type": "normal", "weight_lbs": 185, "target_reps": 6, "rir_target": 1, "rest_seconds": 180}
      ],
      "notes": "Focus on upper chest stretch"
    }
  ],
  "total_sets": 18,
  "estimated_volume_lbs": 18500
}
```

### 5.2 Progression Engine (`services/progression_engine.py`)

**Responsabilidad**: Motor de progresión **100% determinista** (sin LLM).

**Regla Principal** (basada en RIR del top set):

| RIR | Acción | Descripción |
|-----|--------|-------------|
| ≥ 2 | `INCREASE_WEIGHT` | +5 lbs (incremento configurable) |
| = 1 | `INCREASE_REPS` | +1 rep (si no está en max del rango) |
| = 0 | `CONSOLIDATE` | Mantener peso/reps, sesión de consolidación |
| N/A | `DELOAD` | -10% peso si reps declinan 2+ sesiones |

**Función Core**:
```python
def evaluate_anchor(target, exercise_name, top_set_reps, top_set_rir, recent_rep_counts) -> ProgressionResult:
    # 1. Detectar si necesita deload (2 sesiones con reps decrecientes)
    if _should_deload(recent_rep_counts, threshold=2):
        new_weight = round_down_to_nearest_5(target.target_weight * 0.9)
        return ProgressionResult(action=DELOAD, new_weight=new_weight)
    
    # 2. RIR >= 2 → Aumentar peso
    if top_set_rir >= 2:
        new_weight = target.target_weight + increment_lbs
        return ProgressionResult(action=INCREASE_WEIGHT, new_weight=new_weight)
    
    # 3. RIR == 1 → Aumentar reps (si hay espacio en el rango)
    if top_set_rir == 1 and top_set_reps < target.target_reps_max:
        return ProgressionResult(action=INCREASE_REPS, new_reps=top_set_reps + 1)
    
    # 4. RIR == 0 → Consolidar
    return ProgressionResult(action=CONSOLIDATE)
```

**Post-Workout Update**:
```python
async def update_anchor_after_workout(session, workout_id):
    # Para cada ejercicio del workout que tenga AnchorTarget:
    # 1. Obtener top set (el más pesado tipo "normal")
    # 2. Obtener historial reciente
    # 3. Llamar evaluate_anchor()
    # 4. Actualizar AnchorTarget en DB
```

### 5.3 Workout Logger (`services/workout_logger.py`)

**Responsabilidad**: Parsear texto libre de workout y crear registros.

**Formatos Soportados**:
```
Bench Press 185x6x3           → 3 sets de 185 lbs x 6 reps
Chest Fly 170x12, 160x12      → 2 sets con pesos diferentes
Squat 225x5 RIR2              → 1 set con RIR=2
Lateral Raise 30x12 drop      → Set tipo drop
Bench Press 95x10 warmup      → Set tipo warmup
Dumbbell Curl 27.5x10x3       → Peso decimal
```

**Flujo**:
```python
def log_workout(session, text, workout_date, template_day_name, notes):
    workout = Workout(date=workout_date, template_day_name=template_day_name, notes=notes)
    
    for line in text.strip().split('\n'):
        parsed = parse_exercise_line(line)  # → {name, sets: [{weight, reps, rir, type}]}
        if not parsed:
            continue
        
        exercise = find_exercise_by_name(session, parsed['name'])
        workout_exercise = WorkoutExercise(workout=workout, exercise=exercise)
        
        for set_data in parsed['sets']:
            workout_set = WorkoutSet(
                weight=set_data['weight'],
                reps=set_data['reps'],
                rir=set_data.get('rir'),
                set_type=set_data.get('type', 'normal')
            )
            workout_exercise.sets.append(workout_set)
    
    return workout
```

### 5.4 Protection Service (`services/protection_service.py`)

**Responsabilidad**: Manejar "modo protección" para grupos musculares con dolor/lesión.

**Cálculo de Factor de Reducción**:
```python
def calculate_factor(severity):
    # severity: 1-10
    # 1 = reducción mínima (factor 0.9)
    # 10 = reducción máxima (factor 0.2)
    return max(0.2, 1 - (severity * 0.08))
```

**Uso**: El plan generator aplica el factor al volumen de ejercicios que trabajan el músculo protegido.

### 5.5 Stats Service (`services/stats_service.py`)

**Responsabilidad**: Generar resúmenes estadísticos.

**Weekly Summary**:
```json
{
  "week": "2024-W08",
  "workouts": 4,
  "total_sets": 72,
  "total_volume_lbs": 76000,
  "fatigue_score": 6.5,
  "anchor_progress": [
    {"exercise": "Bench Press", "delta": "+5 lbs"},
    {"exercise": "Squat", "delta": "consolidated"}
  ]
}
```

### 5.6 Swap Service (`services/swap_service.py`)

**Responsabilidad**: Encontrar ejercicios alternativos.

**Criterios de Match**:
1. Mismo patrón de movimiento (horizontal_push, vertical_pull, etc.)
2. Mismo músculo primario
3. Ordenado por frecuencia de uso histórica

---

## 6. API ENDPOINTS

### Base URL: `/api`

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/health` | GET | Healthcheck |
| `/dashboard` | GET | Estado + último plan + stats semanales |
| `/generate-today` | POST | Genera plan del día con LLM |
| `/today` | GET | Obtiene último plan para logging |
| `/today/log` | POST | Loggea workout (idempotente) |
| `/today/complete` | POST | Completa sesión, guarda fatigue |
| `/workouts` | GET | Lista workouts recientes |
| `/workouts/{id}` | GET | Detalle de workout |
| `/exercises` | GET | Lista todos los ejercicios |
| `/exercises/{name}/last-session` | GET | Última sesión de un ejercicio |
| `/exercises/{name}/alternatives` | GET | Alternativas para swap |
| `/progress` | GET | Progreso de anchors con historial |
| `/stats/weekly` | GET | Stats semanales |
| `/week-template` | GET | Plantilla del split de 6 días |
| `/week` | GET | Plan semanal completo |
| `/week/generate` | POST | Genera los 6 días |
| `/protection` | GET | Lista protecciones activas |
| `/protection` | POST | Activa protección |
| `/protection/{muscle}` | DELETE | Desactiva protección |

---

## 7. FRONTEND

### Páginas y Rutas

| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/` | `app/page.tsx` | Dashboard: estado, stats, último plan |
| `/today` | `app/today/page.tsx` | **Logger principal**: loggear workout del día |
| `/week` | `app/week/page.tsx` | Vista y generación del plan semanal |
| `/workouts` | `app/workouts/page.tsx` | Historial de entrenamientos |
| `/library` | `app/library/page.tsx` | Biblioteca de ejercicios con búsqueda |
| `/progress` | `app/progress/page.tsx` | Gráficos de progreso (Chart.js) |
| `/settings` | `app/settings/page.tsx` | Gestión de protecciones musculares |

### Componentes Clave en `/today`

El logger de workout (`app/today/page.tsx`) es la página más compleja:

| Componente | Función |
|------------|---------|
| `RestTimer` | Timer de descanso con vibración al terminar |
| `PrBanner` | Modal de celebración para PRs |
| `AddExerciseModal` | Agregar ejercicios manualmente |
| `SwapModal` | Intercambiar ejercicio por alternativa |
| `CompleteModal` | Finalizar sesión con rating de fatigue |
| `SetCard` | Inputs de peso/reps/RIR por set |
| `ExerciseAccordion` | Acordeón expandible por ejercicio |

### Sistema de Diseño

**Paleta (Dark Mode)**:
- Fondo: `zinc-950`, `zinc-900`, `zinc-800`
- Accent: `violet-500/600`, `indigo-400/500`
- Success: `emerald-500/600`
- Warning: `amber-400/500`
- Danger: `red-400/500`

**Gradientes**:
- Primario: `from-violet-600 to-indigo-500`
- Completado: `from-emerald-600 to-teal-500`
- Protección: `from-amber-600 to-orange-500`

### Conexión con Backend

El frontend usa un proxy de Next.js (`next.config.ts`):

```typescript
async rewrites() {
  return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
}
```

Cliente API en `lib/api.ts` con 27 interfaces TypeScript y 16 métodos.

---

## 8. ARCHIVOS JSON DE CONFIGURACIÓN

### ATHLETE_PROFILE.json

**Contenido**: Perfil completo del atleta generado por `analyze_training.py`.

```json
{
  "global_metrics": {
    "total_sessions": 327,
    "date_range": "2024-09-11 to 2026-02-25",
    "avg_sessions_per_week": 4.3,
    "avg_session_duration_minutes": 82.4,
    "avg_session_volume_lbs": 19036.0,
    "bodyweight_start_lbs": 167.6,
    "bodyweight_end_lbs": 186.0,
    "bodyweight_delta_lbs": 18.4
  },
  "frequency_patterns": {
    "split_distribution": {"push": 97, "legs": 85, "pull": 72, "upper": 60},
    "dominant_split": "push",
    "avg_rest_between_sessions_days": 1.65
  },
  "strength_profile": {
    "estimated_profile": "hypertrophy_dominant",
    "rep_distribution": {"hypertrophy_8_15_pct": 87.4}
  },
  "progression_model_detected": {
    "dominant_model": "undulating"
  }
}
```

### EXERCISE_LIBRARY.json

**Contenido**: Catálogo de ~95 ejercicios con estadísticas históricas.

```json
[
  {
    "name": "Lat Pulldown",
    "primary_muscle": "lats",
    "secondary_muscles": ["biceps", "rear_delts"],
    "type": "compound",
    "movement_pattern": "vertical_pull",
    "avg_reps": 9.3,
    "avg_weight_lbs": 157.8,
    "max_weight_detected_lbs": 180.0,
    "session_count": 97,
    "frequency_score": "high",
    "total_sets": 294,
    "volume_contribution_pct": 7.22,
    "notes": "strength_anchor, high_frequency_staple"
  }
]
```

### PROGRAM_CONSTRAINTS.json

**Contenido**: Límites y restricciones para generación de programas.

```json
{
  "time_window": {
    "avg_duration_minutes": 82.4,
    "p10_duration_minutes": 44.3,
    "p90_duration_minutes": 85.0
  },
  "volume_limits": {
    "avg_session_volume_lbs": 19036.0,
    "safe_volume_ceiling_lbs": 25483.0,
    "optimal_session_volume_window_lbs": "14060-23334"
  },
  "frequency_limits": {
    "avg_sessions_per_week": 4.3,
    "sustainable_weekly_frequency": "4-5"
  },
  "exercise_bias": {
    "push_pull_ratio": "1.53:1",
    "upper_lower_ratio": "1.99:1",
    "compound_isolation_ratio": "0.79:1"
  }
}
```

---

## 9. DEPLOYMENT

### Docker Compose

```yaml
services:
  backend:
    build: {dockerfile: Dockerfile.backend}
    environment:
      - DATABASE_URL=sqlite+aiosqlite:////app/data/gym.db
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - gym-data:/app/data
    expose: ["8000"]
    
  frontend:
    build: {dockerfile: Dockerfile.frontend}
    environment:
      - BACKEND_URL=http://backend:8000
    expose: ["3000"]
    depends_on:
      backend: {condition: service_healthy}

volumes:
  gym-data:  # Persistencia SQLite
```

### Nginx (Producción)

- `api.gymos.com` → backend:8000
- `gymos.com` → frontend:3000
- SSL con Let's Encrypt

### Variables de Entorno

| Variable | Requerido | Descripción |
|----------|-----------|-------------|
| `OPENAI_API_KEY` | Sí | API key de OpenAI para generación |
| `DATABASE_URL` | No | Default: `sqlite+aiosqlite:///gym.db` |
| `LOG_LEVEL` | No | Default: `INFO` |
| `PORT` | No | Default: `8000` |
| `WEB_URL` | No | Para CORS en producción |

---

## 10. PATRONES DE DISEÑO

### Backend

| Patrón | Uso |
|--------|-----|
| **Service Layer** | Separación API → Services → Models |
| **Singleton** | `AthleteState` (id=1), cliente OpenAI |
| **Factory** | `create_app()`, `async_sessionmaker` |
| **Strategy** | Progression Engine con diferentes acciones |
| **Fallback** | Plan básico cuando LLM no disponible |

### Frontend

| Patrón | Uso |
|--------|-----|
| **Compound Components** | Múltiples componentes en un archivo |
| **Lazy Loading** | Chart.js importado dinámicamente |
| **Optimistic UI** | Updates locales antes de API response |

---

## 11. TESTING

### Ejecutar Tests

```bash
pytest tests/ -v
```

### Tests Disponibles

| Archivo | Tests |
|---------|-------|
| `test_import_service.py` | Importación de JSON, seeding de DB |
| `test_progression_engine.py` | Lógica de progresión (RIR, deload) |
| `test_workout_logger.py` | Parser de líneas de ejercicio |

### Ejemplo de Test de Progresión

```python
def test_rir_2_plus_increases_weight():
    target = MockAnchorTarget(target_weight=185, increment=5)
    result = evaluate_anchor(target, "Bench Press", 
                            top_set_reps=6, top_set_rir=2, 
                            recent_rep_counts=[6, 6, 6])
    
    assert result.action == ProgressionAction.INCREASE_WEIGHT
    assert result.new_weight == 190
```

---

## 12. FLUJOS PRINCIPALES

### Flujo 1: Generación de Plan Diario

```
Usuario abre Dashboard
       │
       ▼
Click "Generate Today"
       │
       ▼
POST /api/generate-today
       │
       ├── get_day_template(next_day_index)
       ├── get_anchor_targets_for_day()
       ├── get_exercises_for_day()
       ├── get_constraints()
       │
       ▼
build_generate_day_prompt()
       │
       ▼
call_llm_json() → OpenAI GPT-4o
       │
       ▼
Validar y guardar Plan + PlanDay
       │
       ▼
Return plan JSON al frontend
```

### Flujo 2: Logging de Workout

```
Usuario abre /today
       │
       ▼
GET /api/today → último plan
       │
       ▼
Para cada ejercicio:
  │
  ├── Expandir acordeón
  ├── Ver peso/reps sugeridos
  ├── Ingresar peso/reps/RIR actuales
  ├── Click "Complete Set" → inicia RestTimer
  │
  └── (Opcional) Swap ejercicio → GET /api/exercises/{name}/alternatives
       │
       ▼
POST /api/today/log (se llama al guardar)
       │
       ▼
Click "Complete Session"
       │
       ├── Seleccionar fatigue (1-10)
       │
       ▼
POST /api/today/complete
       │
       ├── Crear SessionFeedback
       ├── Actualizar AthleteState.next_day_index
       ├── update_anchor_after_workout() → Progresión
       │
       ▼
Mostrar PRs si los hubo
```

### Flujo 3: Progresión de Anchors (Post-Workout)

```
update_anchor_after_workout(workout_id)
       │
       ▼
Para cada WorkoutExercise con is_anchor=true:
       │
       ├── Obtener top_set (heaviest "normal" set)
       ├── Obtener recent_rep_counts (últimas 5 sesiones)
       │
       ▼
evaluate_anchor(target, reps, rir, history)
       │
       ├── Declining reps? → DELOAD (-10%)
       ├── RIR >= 2? → INCREASE_WEIGHT (+5 lbs)
       ├── RIR == 1? → INCREASE_REPS (+1 rep)
       └── RIR == 0? → CONSOLIDATE
       │
       ▼
Actualizar AnchorTarget en DB
       │
       ├── new target_weight / target_reps
       ├── status (active/deload/consolidate)
       └── streak++
```

---

## 13. CONVENCIONES DE CÓDIGO

### Python (Backend)

- **Estilo**: Ruff con line-length=100
- **Async**: Todo el stack es async (SQLAlchemy, FastAPI)
- **Types**: Type hints en todas las funciones
- **Imports**: Ordenados con isort (via Ruff)

### TypeScript (Frontend)

- **Estilo**: ESLint con config de Next.js
- **Componentes**: Funciones con `"use client"` al inicio
- **Types**: Interfaces para todos los responses de API
- **State**: `useState` + `useCallback` (sin Redux)

### Commits

No hay convención estricta, pero se recomienda:
- `feat:` nuevas funcionalidades
- `fix:` correcciones de bugs
- `refactor:` refactorizaciones
- `docs:` documentación

---

## 14. TROUBLESHOOTING

### El backend no inicia

1. Verificar que existe `.env` con `OPENAI_API_KEY`
2. Verificar Python 3.11+: `python --version`
3. Instalar dependencias: `pip install -e .`

### El frontend no se conecta al backend

1. Verificar que backend está corriendo en `:8000`
2. Verificar `BACKEND_URL` en Next.js config
3. Revisar CORS en `main.py`

### No se generan planes (LLM)

1. Verificar `OPENAI_API_KEY` válida
2. Revisar logs del backend
3. El sistema tiene fallback: genera plan básico sin LLM

### Base de datos vacía

```bash
python scripts/seed_db.py
```

---

## 15. COMANDOS ÚTILES

### Desarrollo Local

```bash
# Backend
cd GymOS
pip install -e ".[dev]"
python -m src.main

# Frontend
cd GymOS/web
npm install
npm run dev

# Tests
pytest tests/ -v

# Lint
ruff check src/
ruff format src/
```

### Docker

```bash
# Build y run
docker-compose up --build

# Solo backend
docker-compose up backend

# Logs
docker-compose logs -f backend
```

### Database

```bash
# Seed inicial
python scripts/seed_db.py

# Reset (eliminar y re-seed)
rm -f gym.db && python scripts/seed_db.py
```

---

## 16. NOTAS IMPORTANTES

### Diseño Single-Tenant

- El sistema está diseñado para **un solo atleta**
- `AthleteState` siempre tiene `id=1`
- No hay autenticación de usuarios
- Los datos JSON son específicos de Jose Alpizar

### Motor de Progresión Determinista

- **NO depende de LLM** - es 100% algorítmico
- Basado en RIR (Reps In Reserve) del top set
- Reglas claras y predecibles
- El LLM solo se usa para **generar planes**, no para decidir progresión

### Anchors vs Staples

- **Anchors**: Ejercicios de fuerza donde se trackea progresión (8 ejercicios)
- **Staples**: Ejercicios de alta frecuencia (pueden o no ser anchors)
- Solo los anchors tienen `AnchorTarget` asociado

### Fallback sin OpenAI

Si `OPENAI_API_KEY` no está configurada:
- `call_llm()` retorna `None`
- `plan_generator` usa `_generate_fallback_plan()`
- El plan fallback es básico pero funcional

---

*Documento generado para proporcionar contexto completo del proyecto GymOS.*
*Última actualización: Generado automáticamente por análisis de código.*
