const API_BASE = "/api";

export interface AthleteState {
    next_day_index: number;
    next_day_name: string;
    fatigue_score: number;
}

export interface DashboardData {
    state: AthleteState;
    last_plan: PlanData | null;
    weekly_stats: WeeklyStats;
}

export interface WeeklyStats {
    workouts: number;
    total_sets: number;
    total_volume_lbs: number;
    fatigue_score: number;
    week: string;
    anchor_progress: AnchorSummary[];
}

export interface AnchorSummary {
    exercise: string;
    target_weight: number;
    reps_range: string;
    status: string;
    streak: number;
}

export interface PlanData {
    day_name: string;
    estimated_duration_min: number;
    exercises: PlanExercise[];
    total_sets: number;
    estimated_volume_lbs: number;
    note?: string;
}

export interface PlanExercise {
    name: string;
    is_anchor: boolean;
    sets: PlanSet[];
    notes?: string;
}

export interface PlanSet {
    set_type: string;
    weight_lbs: number;
    target_reps: number;
    rir_target?: number;
    rest_seconds?: number;
}

export interface WorkoutSummary {
    id: number;
    date: string;
    template_day_name: string | null;
    duration_min: number | null;
    exercise_count: number;
    total_sets: number;
}

export interface WorkoutDetail {
    id: number;
    date: string;
    template_day_name: string | null;
    duration_min: number | null;
    notes: string | null;
    exercises: WorkoutExerciseDetail[];
}

export interface WorkoutExerciseDetail {
    name: string;
    order: number;
    sets: { set_type: string; weight: number; reps: number; rir: number | null }[];
}

export interface ExerciseItem {
    id: number;
    name: string;
    primary_muscle: string;
    type: string;
    movement_pattern: string;
    is_anchor: boolean;
    is_staple: boolean;
    avg_weight: number;
    max_weight: number;
    avg_reps: number;
    frequency_score: string;
    total_sets: number;
}

export interface AnchorProgress {
    exercise: string;
    exercise_id: number;
    target_weight: number;
    reps_range: string;
    status: string;
    streak: number;
    last_rir: number | null;
    history: { date: string; weight: number; reps: number; estimated_1rm: number }[];
}

// --- API Functions ---

async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, init);
    if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
    return res.json();
}

export const api = {
    getDashboard: () => fetchApi<DashboardData>("/dashboard"),
    generateToday: () => fetchApi<PlanData>("/generate-today", { method: "POST" }),
    getWorkouts: (limit = 30) => fetchApi<WorkoutSummary[]>(`/workouts?limit=${limit}`),
    getWorkout: (id: number) => fetchApi<WorkoutDetail>(`/workouts/${id}`),
    getExercises: () => fetchApi<ExerciseItem[]>("/exercises"),
    getProgress: () => fetchApi<AnchorProgress[]>("/progress"),
    getWeeklyStats: () => fetchApi<WeeklyStats>("/stats/weekly"),
    getTodayPlan: () => fetchApi<TodayPlan>("/today"),
    logToday: (payload: TodayLogPayload) =>
        fetchApi<{ workout_id: number; created: boolean }>("/today/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }),
    completeSession: (workout_id: number, fatigue: number) =>
        fetchApi<{ workout_id: number; next_day_index: number }>("/today/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workout_id, fatigue }),
        }),
    getWeekPlan: () => fetchApi<WeekDay[]>("/week"),
    generateWeek: () => fetchApi<WeekDay[]>("/week/generate", { method: "POST" }),
    getAlternatives: (exerciseName: string) =>
        fetchApi<AlternativeExercise[]>(`/exercises/${encodeURIComponent(exerciseName)}/alternatives`),
    getProtections: () => fetchApi<ProtectionRule[]>("/protection"),
    addProtection: (muscle_group: string, severity: number) =>
        fetchApi<ProtectionRule>("/protection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ muscle_group, severity }),
        }),
    removeProtection: (muscle_group: string) =>
        fetchApi<{ removed: string }>(`/protection/${encodeURIComponent(muscle_group)}`, {
            method: "DELETE",
        }),
};

// --- Week Types ---

export interface WeekDay {
    day_index: number;
    name: string;
    focus: string;
    has_plan: boolean;
    plan: PlanData | null;
}

// --- Swap Types ---

export interface AlternativeExercise {
    id: number;
    name: string;
    primary_muscle: string;
    movement_pattern: string;
    is_anchor: boolean;
    avg_weight: number;
    total_sets: number;
}

// --- Protection Types ---

export interface ProtectionRule {
    muscle_group: string;
    severity: number;
    factor: number;
    active: boolean;
}

// --- Today Logger Types ---

export interface TodayPlan {
    plan_id: number;
    day_name: string;
    estimated_duration_min: number | null;
    total_sets: number | null;
    exercises: TodayExercise[];
}

export interface TodayExercise {
    name: string;
    is_anchor: boolean;
    notes: string;
    sets: TodaySet[];
}

export interface TodaySet {
    index: number;
    set_type: string; // "warmup" | "normal" | "drop"
    weight_lbs: number | null;
    target_reps: number | null;
    rir_target: number | null;
    rest_seconds: number | null;
}

export interface SetLogEntry {
    index: number;
    actual_weight: number | null;
    actual_reps: number | null;
    actual_rir: number | null;
    completed: boolean;
}

export interface ExerciseLogEntry {
    name: string;
    sets: SetLogEntry[];
}

export interface TodayLogPayload {
    day_name: string;
    exercises: ExerciseLogEntry[];
}
