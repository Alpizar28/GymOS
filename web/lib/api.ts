const API_BASE = "/api";

async function getAccessToken(): Promise<string | null> {
    if (typeof window === "undefined") return null;

    const { supabase } = await import("@/lib/supabase");

    const sessionResult = await supabase.auth.getSession();
    let token = sessionResult.data.session?.access_token ?? null;

    if (!token) {
        const refreshed = await supabase.auth.refreshSession();
        token = refreshed.data.session?.access_token ?? null;
    }

    return token;
}

export interface AthleteState {
    next_day_index: number;
    next_day_name: string;
    fatigue_score: number;
}

export interface DashboardData {
    state: AthleteState;
    last_plan: PlanData | null;
    weekly_stats: WeeklyStats;
    recommendation?: DayRecommendation;
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

export interface DayRecommendation {
    day_name: string;
    reason: string;
}

export interface DayOption {
    name: string;
    focus: string;
    exercises?: string[];
}

export interface DayOptionCreate {
    name?: string;
    focus: string;
    rules: Record<string, unknown>;
}

export interface PersonalProfile {
    full_name: string;
    photo_url: string | null;
    age: number | null;
    sex: "male" | "female" | "other" | "prefer_not_to_say" | null;
    height_cm: number | null;
    weight_lbs: number | null;
    body_fat_pct: number | null;
    primary_goal: "fat_loss" | "muscle_gain" | "recomp" | "strength" | "performance" | "health" | null;
    goal_detail: string | null;
    target_weight_lbs: number | null;
    timeline_weeks: number | null;
    training_years: number | null;
    days_per_week: number | null;
    session_duration_min: number | null;
    preferred_split: string | null;
    equipment_access: string[];
    injuries: Array<{ area: string; severity: "low" | "medium" | "high"; notes?: string | null }>;
    limitations: string | null;
    exercise_likes: string[];
    exercise_dislikes: string[];
    sleep_hours: number | null;
    stress_level: "low" | "medium" | "high" | null;
    activity_level: "sedentary" | "light" | "moderate" | "high" | "athlete" | null;
    nutrition_notes: string | null;
    goal: string | null;
    notes: string | null;
}

export interface OnboardingStatus {
    completed: boolean;
    completed_at: string | null;
    version: number;
}

export interface RoutineFolder {
    id: number;
    name: string;
    sort_order: number;
    routine_count: number;
}

export interface RoutineSetTemplate {
    id?: number;
    set_index: number;
    set_type: string;
    target_weight_lbs: number | null;
    target_reps: number | null;
    rir_target: number | null;
}

export interface RoutineExerciseTemplate {
    id?: number;
    name: string;
    exercise_id: number | null;
    rest_seconds: number | null;
    notes: string | null;
    primary_muscle?: string;
    is_anchor?: boolean;
    sets: RoutineSetTemplate[];
}

export interface RoutineCard {
    id: number;
    folder_id: number;
    name: string;
    subtitle: string | null;
    notes: string | null;
    training_type: "push" | "pull" | "legs" | "custom";
    sort_order: number;
    exercise_count: number;
    total_sets: number;
    preview_exercises: string[];
    preview_items?: { name: string; set_count: number }[];
    remaining_exercises?: number;
}

export interface RoutineDetail {
    id: number;
    folder_id: number;
    name: string;
    subtitle: string | null;
    notes: string | null;
    training_type: "push" | "pull" | "legs" | "custom";
    sort_order: number;
    exercise_count: number;
    total_sets: number;
    muscles: string[];
    exercises: RoutineExerciseTemplate[];
}

export interface RoutineProgressionTopSet {
    date: string;
    weight: number;
    reps: number;
    rir: number | null;
}

export interface RoutineProgressionSuggestion {
    action: "increase_weight" | "increase_reps" | "maintain" | "deload" | "add_set";
    reason: string;
    apply_scope: "all_working_sets" | "top_working_set" | "none";
    delta_lbs?: number;
    delta_reps?: number;
}

export interface RoutineProgressionAnchor {
    routine_exercise_id: number;
    exercise_id: number;
    exercise: string;
    lookback_used: number;
    recent_top_sets: RoutineProgressionTopSet[];
    anchor_target: {
        target_weight: number | null;
        target_reps_min: number | null;
        target_reps_max: number | null;
        status: string | null;
    };
    suggestion: RoutineProgressionSuggestion;
    proposed_updates: Array<{
        set_index: number;
        target_weight_lbs: number | null;
        target_reps: number | null;
    }>;
    proposed_new_set: {
        set_type: string;
        target_weight_lbs: number | null;
        target_reps: number | null;
        rir_target: number | null;
    } | null;
}

export interface RoutineProgressionPreviewResponse {
    routine_id: number;
    routine_name: string;
    lookback: number;
    anchors: RoutineProgressionAnchor[];
}

export interface RoutineProgressionApplyResponse extends RoutineProgressionPreviewResponse {
    updated_exercises: number;
    updated_sets: number;
    added_sets: number;
    routine: RoutineDetail;
}

export interface RoutineSetInput {
    set_type: string;
    target_weight_lbs: number | null;
    target_reps: number | null;
    rir_target: number | null;
}

export interface RoutineExerciseInput {
    name: string;
    exercise_id?: number | null;
    rest_seconds?: number | null;
    notes?: string | null;
    sets: RoutineSetInput[];
}

export interface RoutineCreatePayload {
    folder_id: number;
    name: string;
    subtitle?: string | null;
    notes?: string | null;
    training_type?: "push" | "pull" | "legs" | "custom";
    sort_order?: number | null;
    exercises: RoutineExerciseInput[];
}

export interface RoutineUpdatePayload {
    folder_id?: number;
    name?: string;
    subtitle?: string | null;
    notes?: string | null;
    training_type?: "push" | "pull" | "legs" | "custom";
    sort_order?: number;
    exercises?: RoutineExerciseInput[];
}

export interface CalendarWorkoutSummary {
    id: number;
    date: string;
    day_name: string | null;
    training_type?: "push" | "pull" | "legs" | "custom";
    duration_min: number | null;
    total_sets: number;
    total_volume_lbs: number;
}

export interface CalendarDay {
    date: string;
    workouts: CalendarWorkoutSummary[];
}

export type TrainingType = "all" | "push" | "pull" | "legs" | "custom";

export interface WeeklyWindowSummary {
    from: string;
    to: string;
    sessions: number;
    sets: number;
    volume: number;
}

export interface WeeklyCompareResponse {
    reference_date: string;
    training_type: TrainingType;
    current_week: WeeklyWindowSummary;
    previous_week: WeeklyWindowSummary;
    delta: {
        sessions: number;
        sets: number;
        volume: number;
    };
    delta_pct: {
        sessions: number | null;
        sets: number | null;
        volume: number | null;
    };
}

export interface BackfillTrainingTypeResponse {
    workouts_scanned: number;
    updated: number;
    upgraded_from_custom: number;
    matched_routine: number;
    matched_heuristic: number;
}

export interface TrainingTypeStatsResponse {
    total: number;
    push: number;
    pull: number;
    legs: number;
    custom: number;
    non_custom: number;
    inferred: number;
}

export interface ManualSet {
    weight: number | null;
    reps: number | null;
    rir: number | null;
    set_type?: string | null;
}

export interface ManualExercise {
    name: string;
    sets: ManualSet[];
}

export interface ManualWorkoutPayload {
    date: string;
    day_name?: string | null;
    notes?: string | null;
    text?: string | null;
    exercises?: ManualExercise[] | null;
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
    sets: {
        set_type: string;
        weight: number | null;
        reps: number | null;
        rir: number | null;
        completed: boolean;
    }[];
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

export interface CreateExercisePayload {
    name: string;
    primary_muscle?: string;
    type?: string;
    movement_pattern?: string;
    is_anchor?: boolean;
    is_staple?: boolean;
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
    const firstHeaders = new Headers(init?.headers ?? {});
    const firstToken = await getAccessToken();
    if (firstToken) {
        firstHeaders.set("Authorization", `Bearer ${firstToken}`);
        firstHeaders.set("X-Supabase-Access-Token", firstToken);
    }

    let res = await fetch(`${API_BASE}${path}`, { ...init, headers: firstHeaders });

    if (res.status === 401 && typeof window !== "undefined") {
        const refreshedToken = await getAccessToken();
        if (refreshedToken && refreshedToken !== firstToken) {
            const retryHeaders = new Headers(init?.headers ?? {});
            retryHeaders.set("Authorization", `Bearer ${refreshedToken}`);
            retryHeaders.set("X-Supabase-Access-Token", refreshedToken);
            res = await fetch(`${API_BASE}${path}`, { ...init, headers: retryHeaders });
        }
    }

    if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
    return res.json();
}

export const api = {
    getDashboard: () => fetchApi<DashboardData>("/dashboard"),
    generateToday: () => fetchApi<PlanData>("/generate-today", { method: "POST" }),
    generateDay: (day_name: string) =>
        fetchApi<PlanData>("/generate-day", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ day_name }),
        }),
    getDayOptions: () => fetchApi<DayOption[]>("/day-options"),
    getDayRecommendation: () => fetchApi<DayRecommendation>("/day-recommendation"),
    createDayOption: (payload: DayOptionCreate) =>
        fetchApi<DayOption>("/day-options", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }),
    getPersonalProfile: () => fetchApi<PersonalProfile>("/profile/personal"),
    updatePersonalProfile: (payload: Partial<PersonalProfile>) =>
        fetchApi<PersonalProfile>("/profile/personal", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }),
    getOnboardingStatus: () => fetchApi<OnboardingStatus>("/profile/onboarding-status"),
    completeOnboarding: (payload: Partial<PersonalProfile>) =>
        fetchApi<PersonalProfile>("/profile/onboarding", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }),
    getRoutineFolders: () => fetchApi<RoutineFolder[]>("/routines/folders"),
    createRoutineFolder: (name: string) =>
        fetchApi<RoutineFolder>("/routines/folders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
        }),
    updateRoutineFolder: (folder_id: number, payload: { name?: string; sort_order?: number }) =>
        fetchApi<RoutineFolder>(`/routines/folders/${folder_id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }),
    deleteRoutineFolder: (folder_id: number) =>
        fetchApi<{ removed: number }>(`/routines/folders/${folder_id}`, {
            method: "DELETE",
        }),
    getRoutines: (folder_id?: number) =>
        fetchApi<RoutineCard[]>(
            folder_id !== undefined ? `/routines?folder_id=${folder_id}` : "/routines"
        ),
    createRoutine: (payload: RoutineCreatePayload) =>
        fetchApi<RoutineDetail>("/routines", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }),
    getRoutine: (routine_id: number) => fetchApi<RoutineDetail>(`/routines/${routine_id}`),
    updateRoutine: (routine_id: number, payload: RoutineUpdatePayload) =>
        fetchApi<RoutineDetail>(`/routines/${routine_id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }),
    deleteRoutine: (routine_id: number) =>
        fetchApi<{ removed: number }>(`/routines/${routine_id}`, {
            method: "DELETE",
        }),
    duplicateRoutine: (routine_id: number) =>
        fetchApi<RoutineDetail>(`/routines/${routine_id}/duplicate`, {
            method: "POST",
        }),
    shareRoutine: (routine_id: number) =>
        fetchApi<{ version: number; exported_at: string; routine: RoutineDetail }>(
            `/routines/${routine_id}/share`,
            {
                method: "POST",
            }
        ),
    getRoutineProgressionPreview: (routine_id: number, lookback = 5) =>
        fetchApi<RoutineProgressionPreviewResponse>(
            `/routines/${routine_id}/progression-preview?lookback=${lookback}`
        ),
    applyRoutineProgression: (routine_id: number, lookback = 5) =>
        fetchApi<RoutineProgressionApplyResponse>(
            `/routines/${routine_id}/progression-apply?lookback=${lookback}`,
            {
                method: "POST",
            }
        ),
    startRoutine: (routine_id: number) =>
        fetchApi<{ routine_id: number; plan_day_id: number; plan: PlanData }>(
            `/routines/${routine_id}/start`,
            {
                method: "POST",
            }
        ),
    getCalendar: (from: string, to: string, trainingType: TrainingType = "all") =>
        fetchApi<CalendarDay[]>(
            `/calendar?from=${from}&to=${to}&training_type=${encodeURIComponent(trainingType)}`
        ),
    getWeeklyCompare: (ref: string, trainingType: TrainingType = "all") =>
        fetchApi<WeeklyCompareResponse>(
            `/history/weekly-compare?ref=${ref}&training_type=${encodeURIComponent(trainingType)}`
        ),
    backfillHistoryTrainingType: () =>
        fetchApi<BackfillTrainingTypeResponse>("/history/backfill-training-type", {
            method: "POST",
        }),
    getTrainingTypeStats: () =>
        fetchApi<TrainingTypeStatsResponse>("/history/training-type-stats"),
    createManualWorkout: (payload: ManualWorkoutPayload) =>
        fetchApi<{ workout_id: number }>("/workouts/manual", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }),
    getWorkouts: (limit = 30) => fetchApi<WorkoutSummary[]>(`/workouts?limit=${limit}`),
    getWorkout: (id: number) => fetchApi<WorkoutDetail>(`/workouts/${id}`),
    getExercises: () => fetchApi<ExerciseItem[]>("/exercises"),
    createExercise: (payload: CreateExercisePayload) =>
        fetchApi<ExerciseItem>("/exercises", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }),
    getProgress: () => fetchApi<AnchorProgress[]>("/progress"),
    getWeeklyStats: () => fetchApi<WeeklyStats>("/stats/weekly"),
    getTodayPlan: () => fetchApi<TodayPlan>("/today"),
    logToday: (payload: TodayLogPayload) =>
        fetchApi<{ workout_id: number; created: boolean; prs: PrRecord[] }>("/today/log", {
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
    getLastSession: (exerciseName: string) =>
        fetchApi<LastSessionSet[]>(`/exercises/${encodeURIComponent(exerciseName)}/last-session`),
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

// --- PR Record Type ---

export interface PrRecord {
    exercise: string;
    type: "weight" | "e1rm";
    value: number;
}

// --- Last Session Types ---

export interface LastSessionSet {
    weight: number | null;
    reps: number | null;
    rir: number | null;
    set_type: string;
}

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
    training_type?: "push" | "pull" | "legs" | "custom";
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
    training_type?: "push" | "pull" | "legs" | "custom";
    exercises: ExerciseLogEntry[];
}
