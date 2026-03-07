"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
    api,
    type CreateExercisePayload,
    type TodayPlan,
    type TodaySet,
    type SetLogEntry,
    type ExerciseLogEntry,
    type AlternativeExercise,
    type LastSessionSet,
    type DayOption,
    type DayRecommendation,
    type DayOptionCreate,
    type ExerciseItem,
} from "@/lib/api";
import { PlateCalculatorModal } from "@/components/plate-calculator-modal";
import { WeightKeypadSheet } from "@/components/weight-keypad-sheet";
import { WorkoutCompletedIcon } from "@/components/icons";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActualSet = SetLogEntry;

interface ExerciseState {
    name: string;
    is_anchor: boolean;
    notes: string;
    plannedSets: TodaySet[];
    sets: ActualSet[];
    open: boolean;
    lastSession: LastSessionSet[] | null; // null = not fetched yet
}

interface TodayDraft {
    version: 1;
    dayName: string;
    date: string;
    savedId: number | null;
    savedAt: number;
    startedAt?: number | null;
    elapsedSeconds?: number;
    timerRunning?: boolean;
    exercises: ExerciseState[];
}

interface WorkoutExerciseSummary {
    name: string;
    completedSets: number;
    loggedSets: number;
    volume: number;
    topSet: string | null;
}

interface WorkoutFinishSummary {
    exerciseCount: number;
    completedSets: number;
    loggedSets: number;
    totalVolume: number;
    exercises: WorkoutExerciseSummary[];
}

type KeypadField = "weight" | "reps" | "rir";

interface KeypadTarget {
    exerciseIdx: number;
    setIdx: number;
    field: KeypadField;
}

interface UndoAction {
    label: string;
    previousExercises: ExerciseState[];
}

const DRAFT_PREFIX = "gymos:today-draft";

function localDateISO() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
}

function draftKey(dayName: string, date = localDateISO()) {
    return `${DRAFT_PREFIX}:${date}:${dayName}`;
}

function normalizeName(name: string) {
    return name.trim().toLowerCase();
}

function fieldLabel(field: KeypadField): string {
    if (field === "weight") return "lbs";
    if (field === "reps") return "reps";
    return "RIR";
}

function hasSetData(s: ActualSet) {
    return s.actual_weight !== null || s.actual_reps !== null || s.actual_rir !== null;
}

function normalizeIndices(sets: ActualSet[]) {
    return sets.map((s, i) => ({ ...s, index: i }));
}

function cloneExercises(state: ExerciseState[]) {
    return state.map((ex) => ({
        ...ex,
        plannedSets: ex.plannedSets.map((set) => ({ ...set })),
        sets: ex.sets.map((set) => ({ ...set })),
        lastSession: ex.lastSession ? ex.lastSession.map((set) => ({ ...set })) : ex.lastSession,
    }));
}

function formatWeightCompact(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatElapsedTime(totalSeconds: number): string {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = safe % 60;

    if (hours > 0) {
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function buildFinishSummary(exercises: ExerciseState[]): WorkoutFinishSummary {
    const rows: WorkoutExerciseSummary[] = exercises
        .map((exercise) => {
            const completedSets = exercise.sets.filter((set) => set.completed).length;
            const loggedSets = exercise.sets.filter((set) => set.completed || hasSetData(set)).length;
            const setsWithWeight = exercise.sets.filter((set) => (set.completed || hasSetData(set)) && (set.actual_weight ?? 0) > 0);
            const volume = setsWithWeight.reduce((sum, set) => sum + (set.actual_weight ?? 0) * (set.actual_reps ?? 0), 0);

            let topSet: string | null = null;
            const top = setsWithWeight.reduce<ActualSet | null>((best, current) => {
                if (!best) return current;
                const bestWeight = best.actual_weight ?? 0;
                const currentWeight = current.actual_weight ?? 0;
                if (currentWeight > bestWeight) return current;
                if (currentWeight === bestWeight && (current.actual_reps ?? 0) > (best.actual_reps ?? 0)) {
                    return current;
                }
                return best;
            }, null);

            if (top && top.actual_weight !== null && top.actual_reps !== null) {
                topSet = `${formatWeightCompact(top.actual_weight)} x ${top.actual_reps}`;
            }

            return {
                name: exercise.name,
                completedSets,
                loggedSets,
                volume,
                topSet,
            };
        })
        .filter((row) => row.loggedSets > 0);

    return {
        exerciseCount: rows.length,
        completedSets: rows.reduce((sum, row) => sum + row.completedSets, 0),
        loggedSets: rows.reduce((sum, row) => sum + row.loggedSets, 0),
        totalVolume: rows.reduce((sum, row) => sum + row.volume, 0),
        exercises: rows,
    };
}

function CompletionConfetti() {
    const pieces = useMemo(
        () => Array.from({ length: 28 }, (_, i) => ({
            id: i,
            left: `${(i * 17) % 100}%`,
            delay: `${(i % 7) * 0.06}s`,
            duration: `${1.4 + (i % 5) * 0.22}s`,
            rotate: `${(i % 2 === 0 ? 1 : -1) * (120 + (i % 4) * 45)}deg`,
            color: i % 3 === 0 ? "#ef4444" : i % 3 === 1 ? "#fca5a5" : "#e4e4e7",
        })),
        []
    );

    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            {pieces.map((piece) => (
                <span
                    key={piece.id}
                    className="absolute top-0 h-2.5 w-1.5 rounded-sm confetti-piece"
                    style={{
                        left: piece.left,
                        backgroundColor: piece.color,
                        animationDelay: piece.delay,
                        animationDuration: piece.duration,
                        rotate: piece.rotate,
                    }}
                />
            ))}
            <style jsx>{`
                .confetti-piece {
                    animation-name: fall;
                    animation-timing-function: ease-out;
                    animation-fill-mode: forwards;
                }
                @keyframes fall {
                    0% { transform: translateY(-20px) scale(1); opacity: 0; }
                    12% { opacity: 1; }
                    100% { transform: translateY(420px) scale(0.85); opacity: 0; }
                }
            `}</style>
        </div>
    );
}

function mergeExercises(base: ExerciseState[], incoming: ExerciseState[]) {
    const mergeSetRows = (baseSets: ActualSet[], incomingSets: ActualSet[]) => {
        const max = Math.max(baseSets.length, incomingSets.length);
        const merged: ActualSet[] = [];
        for (let i = 0; i < max; i += 1) {
            const baseSet = baseSets[i];
            const incomingSet = incomingSets[i];
            if (incomingSet && (incomingSet.completed || hasSetData(incomingSet))) {
                merged.push({ ...incomingSet, index: i });
            } else if (baseSet) {
                merged.push({ ...baseSet, index: i });
            } else if (incomingSet) {
                merged.push({ ...incomingSet, index: i });
            }
        }
        return merged;
    };

    const used = new Array(incoming.length).fill(false);
    const merged = base.map((baseEx) => {
        const matchIndex = incoming.findIndex(
            (cand, i) => !used[i] && normalizeName(cand.name) === normalizeName(baseEx.name)
        );

        if (matchIndex === -1) {
            return baseEx;
        }

        used[matchIndex] = true;
        const from = incoming[matchIndex];
        return {
            ...baseEx,
            is_anchor: from.is_anchor,
            notes: from.notes || baseEx.notes,
            plannedSets: from.plannedSets.length > 0 ? from.plannedSets : baseEx.plannedSets,
            sets: mergeSetRows(baseEx.sets, from.sets),
            open: from.open,
        };
    });

    for (let i = 0; i < incoming.length; i += 1) {
        if (!used[i]) {
            merged.push({
                ...incoming[i],
                sets: normalizeIndices(incoming[i].sets),
                lastSession: null,
            });
        }
    }

    return merged;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newSet(index: number, setType: ActualSet["set_type"] = "normal"): ActualSet {
    return { index, set_type: setType, actual_weight: null, actual_reps: null, actual_rir: null, completed: false };
}

function normalizeSetType(value: string | null | undefined): ActualSet["set_type"] {
    if (value === "warmup" || value === "approach" || value === "drop") return value;
    return "normal";
}

function initSets(planned: TodaySet[]): ActualSet[] {
    return planned.map((s) => ({
        index: s.index,
        set_type: normalizeSetType(s.set_type),
        actual_weight: s.weight_lbs,
        actual_reps: s.target_reps,
        actual_rir: s.rir_target,
        completed: false,
    }));
}

const DAY_LABELS: Record<string, string> = {
    Push_Heavy: "Push Heavy",
    Pull_Heavy: "Pull Heavy",
    Quads_Heavy: "Quads Heavy",
    Upper_Complement: "Upper Complement",
    Arms_Shoulders: "Arms & Shoulders",
    Posterior_Heavy: "Posterior Heavy",
    Pecho_Hombro_Tricep: "Pecho, hombro y tricep",
    Espalda_Biceps: "Espalda y biceps",
    Cuadriceps: "Cuadriceps",
    Femorales_Nalga: "Femorales y nalga",
    Pierna: "Pierna",
    Brazo: "Brazo (hombro enfasis)",
    Pecho_Espalda: "Pecho y espalda",
};

function formatDayName(name: string) {
    return DAY_LABELS[name] ?? name.replace(/_/g, " ");
}

const PATTERN_OPTIONS = [
    "horizontal_push",
    "vertical_push",
    "horizontal_pull",
    "vertical_pull",
    "squat",
    "hinge",
    "unilateral",
    "lateral_raise",
    "core",
    "cardio",
];

const MUSCLE_OPTIONS = [
    "chest",
    "lats",
    "upper_back",
    "biceps",
    "triceps",
    "front_delts",
    "side_delts",
    "rear_delts",
    "quads",
    "hamstrings",
    "glutes",
    "calves",
    "core",
];

const EXERCISE_TYPE_OPTIONS = ["compound", "isolation", "machine", "cable", "bodyweight", "unknown"];

const MOVEMENT_PATTERN_OPTIONS = [
    "horizontal_push",
    "vertical_push",
    "horizontal_pull",
    "vertical_pull",
    "squat",
    "hinge",
    "unilateral",
    "core",
    "other",
    "unknown",
];

function TogglePill({
    label,
    active,
    onClick,
}: {
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                active
                    ? "bg-red-600/30 text-red-200 border-red-500/40"
                    : "bg-zinc-800 text-zinc-500 border-zinc-700/60"
            }`}
        >
            {label}
        </button>
    );
}

// ─── Rest Timer ───────────────────────────────────────────────────────────────

function RestTimerPanel({
    secondsLeft,
    running,
    defaultSeconds,
    onToggle,
    onAdd30,
    onReset,
    onSkip,
    onSetDefault,
}: {
    secondsLeft: number | null;
    running: boolean;
    defaultSeconds: number;
    onToggle: () => void;
    onAdd30: () => void;
    onReset: () => void;
    onSkip: () => void;
    onSetDefault: (seconds: number) => void;
}) {
    const active = secondsLeft !== null;
    const effective = active ? secondsLeft : defaultSeconds;
    const mins = Math.floor(effective / 60);
    const secs = effective % 60;

    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wide font-semibold">Rest Timer</p>
                    <p className="text-4xl font-bold font-mono text-white tabular-nums">
                        {mins}:{secs.toString().padStart(2, "0")}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                        {active ? (running ? "Running" : "Paused") : `Default ${Math.floor(defaultSeconds / 60)}:${(defaultSeconds % 60).toString().padStart(2, "0")}`}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                    <button
                        onClick={onToggle}
                        disabled={!active}
                        className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 disabled:opacity-40"
                    >
                        {running ? "Pause" : "Start"}
                    </button>
                    <button
                        onClick={onAdd30}
                        disabled={!active}
                        className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 disabled:opacity-40"
                    >
                        +30s
                    </button>
                    <button
                        onClick={onReset}
                        className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200"
                    >
                        Reset
                    </button>
                    <button
                        onClick={onSkip}
                        disabled={!active}
                        className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-400 disabled:opacity-40"
                    >
                        Skip
                    </button>
                </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
                {[90, 120, 150].map((seconds) => {
                    const selected = defaultSeconds === seconds;
                    return (
                        <button
                            key={seconds}
                            onClick={() => onSetDefault(seconds)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${selected
                                ? "bg-red-600/25 text-red-200 border-red-500/40"
                                : "bg-zinc-900 text-zinc-400 border-zinc-700"
                                }`}
                        >
                            {Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, "0")}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Add Exercise Modal ───────────────────────────────────────────────────────

function AddExerciseModal({
    onAdd,
    onClose,
}: {
    onAdd: (exercise: { name: string; is_anchor: boolean }) => void;
    onClose: () => void;
}) {
    const [q, setQ] = useState("");
    const [library, setLibrary] = useState<ExerciseItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");
    const [showDetails, setShowDetails] = useState(false);
    const [details, setDetails] = useState<CreateExercisePayload>({
        name: "",
        primary_muscle: "unknown",
        type: "unknown",
        movement_pattern: "unknown",
        is_anchor: false,
        is_staple: false,
    });

    useEffect(() => {
        api
            .getExercises()
            .then(setLibrary)
            .catch(() => setError("No se pudo cargar la biblioteca"))
            .finally(() => setLoading(false));
    }, []);

    const filtered = library
        .filter((ex) => ex.name.toLowerCase().includes(q.toLowerCase().trim()))
        .slice(0, 12);

    const quickCreate = async () => {
        const name = q.trim();
        if (!name) return;
        setCreating(true);
        setError("");
        try {
            const created = await api.createExercise({ name });
            setLibrary((prev) => [created, ...prev]);
            onAdd({ name: created.name, is_anchor: created.is_anchor });
        } catch (e: unknown) {
            if (e instanceof Error && e.message.includes("409")) {
                const existing = library.find((ex) => ex.name.toLowerCase() === name.toLowerCase());
                if (existing) {
                    onAdd({ name: existing.name, is_anchor: existing.is_anchor });
                    return;
                }
            }
            setError("No se pudo crear el ejercicio");
        } finally {
            setCreating(false);
        }
    };

    const detailedCreate = async () => {
        const name = details.name?.trim() || q.trim();
        if (!name) {
            setError("Escribe un nombre para crear el ejercicio");
            return;
        }
        setCreating(true);
        setError("");
        try {
            const created = await api.createExercise({ ...details, name });
            setLibrary((prev) => [created, ...prev]);
            onAdd({ name: created.name, is_anchor: created.is_anchor });
        } catch {
            setError("No se pudo crear el ejercicio con detalles");
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                    <h3 className="font-semibold text-white">Add Exercise</h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white text-2xl w-10 h-10 flex items-center justify-center">✕</button>
                </div>
                <div className="p-5 space-y-4 pb-8 max-h-[80vh] overflow-y-auto">
                    <input autoFocus type="text" placeholder="Exercise name…" value={q}
                        onChange={(e) => setQ(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && q.trim()) quickCreate(); }}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-base text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-500" />

                    {loading ? (
                        <p className="text-sm text-zinc-500">Cargando biblioteca...</p>
                    ) : (
                        <div className="space-y-2">
                            {filtered.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => onAdd({ name: item.name, is_anchor: item.is_anchor })}
                                    className="w-full text-left px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-950/60"
                                >
                                    <p className="text-sm text-white">{item.name}</p>
                                    <p className="text-xs text-zinc-500">{item.primary_muscle} · {item.type}</p>
                                </button>
                            ))}
                            {filtered.length === 0 && q.trim() && (
                                <p className="text-xs text-zinc-600">No hay coincidencias en biblioteca.</p>
                            )}
                        </div>
                    )}

                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 space-y-3">
                        <p className="text-xs uppercase tracking-wide text-zinc-500">Crear nuevo ejercicio</p>
                        <button
                            onClick={quickCreate}
                            disabled={creating || !q.trim()}
                            className="w-full py-2.5 bg-red-600 text-white font-semibold rounded-lg disabled:opacity-40"
                        >
                            {creating ? "Creando..." : "Agregar rapido"}
                        </button>
                        <button
                            onClick={() => {
                                setShowDetails((v) => !v);
                                setDetails((prev) => ({ ...prev, name: q.trim() || prev.name || "" }));
                            }}
                            className="w-full py-2.5 border border-zinc-700 text-zinc-300 rounded-lg"
                        >
                            {showDetails ? "Ocultar detalles" : "Agregar con detalles"}
                        </button>

                        {showDetails && (
                            <div className="space-y-2 pt-1">
                                <input
                                    value={details.name || ""}
                                    onChange={(e) => setDetails((p) => ({ ...p, name: e.target.value }))}
                                    placeholder="Nombre"
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
                                />
                                <div className="grid grid-cols-3 gap-2">
                                    <select
                                        value={details.primary_muscle}
                                        onChange={(e) => setDetails((p) => ({ ...p, primary_muscle: e.target.value }))}
                                        className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-2 text-xs text-white"
                                    >
                                        {MUSCLE_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    <select
                                        value={details.type}
                                        onChange={(e) => setDetails((p) => ({ ...p, type: e.target.value }))}
                                        className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-2 text-xs text-white"
                                    >
                                        {EXERCISE_TYPE_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    <select
                                        value={details.movement_pattern}
                                        onChange={(e) => setDetails((p) => ({ ...p, movement_pattern: e.target.value }))}
                                        className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-2 text-xs text-white"
                                    >
                                        {MOVEMENT_PATTERN_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="flex gap-2 text-xs">
                                    <label className="flex items-center gap-1 text-zinc-400">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(details.is_anchor)}
                                            onChange={(e) => setDetails((p) => ({ ...p, is_anchor: e.target.checked }))}
                                        />
                                        Anchor
                                    </label>
                                    <label className="flex items-center gap-1 text-zinc-400">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(details.is_staple)}
                                            onChange={(e) => setDetails((p) => ({ ...p, is_staple: e.target.checked }))}
                                        />
                                        Staple
                                    </label>
                                </div>
                                <button
                                    onClick={detailedCreate}
                                    disabled={creating}
                                    className="w-full py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg disabled:opacity-40"
                                >
                                    Guardar con detalles
                                </button>
                            </div>
                        )}
                    </div>
                    {error && <p className="text-xs text-red-400">{error}</p>}
                </div>
            </div>
        </div>
    );
}

function CreateTemplateModal({
    onCreate,
    onClose,
}: {
    onCreate: (payload: DayOptionCreate) => void;
    onClose: () => void;
}) {
    const [name, setName] = useState("");
    const [focus, setFocus] = useState("");
    const [anchors, setAnchors] = useState("");
    const [requiredPatterns, setRequiredPatterns] = useState<string[]>([]);
    const [optionalPatterns, setOptionalPatterns] = useState<string[]>([]);
    const [primaryMuscles, setPrimaryMuscles] = useState<string[]>([]);
    const [maxExercises, setMaxExercises] = useState(6);
    const [maxSets, setMaxSets] = useState(20);
    const [allowDropSets, setAllowDropSets] = useState(false);
    const [error, setError] = useState("");

    const toggle = (list: string[], value: string, setter: (v: string[]) => void) => {
        setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
    };

    const handleCreate = () => {
        if (!focus.trim()) {
            setError("Define un focus para el template.");
            return;
        }
        if (requiredPatterns.length === 0 && primaryMuscles.length === 0) {
            setError("Selecciona al menos un pattern requerido o musculo principal.");
            return;
        }
        setError("");
        const payload: DayOptionCreate = {
            name: name.trim() || undefined,
            focus: focus.trim(),
            rules: {
                anchors: anchors
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                required_patterns: requiredPatterns,
                optional_patterns: optionalPatterns,
                primary_muscles: primaryMuscles,
                max_exercises: maxExercises,
                max_sets: maxSets,
                allow_drop_sets: allowDropSets,
            },
        };
        onCreate(payload);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-950">
                    <div>
                        <h3 className="font-semibold text-white">Crear Template</h3>
                        <p className="text-xs text-zinc-500 mt-1">Define patrones, musculos y limites</p>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 text-2xl w-10 h-10 flex items-center justify-center">✕</button>
                </div>
                <div className="p-5 space-y-5 overflow-y-auto pb-8">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Identidad</p>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-zinc-500 mb-2">Nombre interno (opcional)</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Espalda_Anchor"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-2">Focus</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Espalda y biceps con enfasis en dorsales"
                                    value={focus}
                                    onChange={(e) => setFocus(e.target.value)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-2">Anchors (separados por coma)</label>
                                <input
                                    type="text"
                                    placeholder="Bench Press, Lat Pulldown"
                                    value={anchors}
                                    onChange={(e) => setAnchors(e.target.value)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Patrones</p>
                        <div>
                            <label className="block text-xs text-zinc-500 mb-2">Required patterns</label>
                            <div className="flex flex-wrap gap-2">
                                {PATTERN_OPTIONS.map((p) => (
                                    <TogglePill
                                        key={p}
                                        label={p}
                                        active={requiredPatterns.includes(p)}
                                        onClick={() => toggle(requiredPatterns, p, setRequiredPatterns)}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className="block text-xs text-zinc-500 mb-2">Optional patterns</label>
                            <div className="flex flex-wrap gap-2">
                                {PATTERN_OPTIONS.map((p) => (
                                    <TogglePill
                                        key={p}
                                        label={p}
                                        active={optionalPatterns.includes(p)}
                                        onClick={() => toggle(optionalPatterns, p, setOptionalPatterns)}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Musculos</p>
                        <label className="block text-xs text-zinc-500 mb-2">Primary muscles</label>
                        <div className="flex flex-wrap gap-2">
                            {MUSCLE_OPTIONS.map((m) => (
                                <TogglePill
                                    key={m}
                                    label={m}
                                    active={primaryMuscles.includes(m)}
                                    onClick={() => toggle(primaryMuscles, m, setPrimaryMuscles)}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Limites</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-zinc-500 mb-2">Max exercises</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={maxExercises}
                                    onChange={(e) => setMaxExercises(parseInt(e.target.value || "0", 10))}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-2">Max sets</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={maxSets}
                                    onChange={(e) => setMaxSets(parseInt(e.target.value || "0", 10))}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white"
                                />
                            </div>
                        </div>
                        <label className="flex items-center gap-3 text-sm text-zinc-300 mt-4">
                            <input
                                type="checkbox"
                                checked={allowDropSets}
                                onChange={(e) => setAllowDropSets(e.target.checked)}
                                className="accent-red-500"
                            />
                            Permitir drop sets
                        </label>
                    </div>
                    <button
                        onClick={handleCreate}
                        className="w-full py-3.5 bg-gradient-to-r from-red-600 to-red-500 text-white font-bold rounded-xl active:opacity-80 touch-manipulation text-base"
                    >
                        Crear template
                    </button>
                    {error && (
                        <p className="text-xs text-red-400 mt-3">{error}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Swap Modal ───────────────────────────────────────────────────────────────

function SwapModal({ exerciseName, onClose, onSwap }: {
    exerciseName: string; onClose: () => void; onSwap: (alt: AlternativeExercise) => void;
}) {
    const [alts, setAlts] = useState<AlternativeExercise[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => { api.getAlternatives(exerciseName).then(setAlts).finally(() => setLoading(false)); }, [exerciseName]);
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
                    <h3 className="font-semibold text-white truncate pr-4">Swap: {exerciseName}</h3>
                    <button onClick={onClose} className="text-zinc-500 text-2xl w-10 h-10 flex items-center justify-center flex-shrink-0">✕</button>
                </div>
                <div className="p-4 space-y-2 overflow-y-auto pb-8">
                    {loading ? <div className="text-center py-10 text-zinc-600">Finding alternatives...</div>
                        : alts.length === 0 ? <div className="text-center py-10 text-zinc-600">No alternatives found</div>
                            : alts.map((alt) => (
                                <button key={alt.id} onClick={() => onSwap(alt)}
                                    className="w-full flex justify-between p-4 rounded-xl bg-zinc-800/60 active:bg-zinc-700 border border-zinc-700/30 text-left touch-manipulation">
                                    <div>
                                        <p className="font-medium text-white">{alt.name}</p>
                                        <p className="text-xs text-zinc-500 mt-0.5">{alt.primary_muscle} · {alt.movement_pattern}{alt.is_anchor && " · anchor"}</p>
                                    </div>
                                    {alt.avg_weight > 0 && <p className="text-xs text-zinc-600 ml-3">{alt.avg_weight} lb avg</p>}
                                </button>
                            ))}
                </div>
            </div>
        </div>
    );
}

// ─── Complete Modal ───────────────────────────────────────────────────────────

function CompleteModal({ summary, onConfirm, onClose }: {
    summary: WorkoutFinishSummary;
    onConfirm: (fatigue: number) => Promise<void>;
    onClose: () => void;
}) {
    const [fatigue, setFatigue] = useState(5);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const label = fatigue <= 3 ? "Easy" : fatigue <= 6 ? "Moderate" : fatigue <= 8 ? "Hard" : "Exhausted";

    async function go() {
        setError("");
        setSaving(true);
        try {
            await onConfirm(fatigue);
        } catch {
            setError("No se pudo completar la sesion. Intenta de nuevo.");
        }
        finally { setSaving(false); }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-5 border-b border-zinc-800">
                    <h3 className="font-bold text-white text-xl">Finish Workout</h3>
                    <p className="text-sm text-zinc-500 mt-1">Review your session and confirm completion</p>
                </div>
                <div className="p-6 space-y-5 pb-10">
                    <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-center">
                            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Exercises</p>
                            <p className="text-xl font-bold text-white mt-1">{summary.exerciseCount}</p>
                        </div>
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-center">
                            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Sets</p>
                            <p className="text-xl font-bold text-white mt-1">{summary.completedSets}/{summary.loggedSets}</p>
                        </div>
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-center">
                            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Volume</p>
                            <p className="text-xl font-bold text-white mt-1">{Math.round(summary.totalVolume)}</p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 max-h-56 overflow-y-auto space-y-2">
                        {summary.exercises.length === 0 ? (
                            <p className="text-xs text-zinc-500">No sets logged yet.</p>
                        ) : (
                            summary.exercises.map((exercise) => (
                                <div key={exercise.name} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-white truncate">{exercise.name}</p>
                                        <p className="text-xs text-zinc-400">{exercise.completedSets}/{exercise.loggedSets} sets</p>
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-1">
                                        {exercise.topSet ? `Top set ${exercise.topSet}` : "No top set"}
                                        {` · Vol ${Math.round(exercise.volume)}`}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>

                    <div>
                        <div className="flex justify-between text-base mb-3">
                            <span className="text-zinc-400">Fatigue</span>
                            <span className="font-bold text-white">{fatigue}/10 — {label}</span>
                        </div>
                        <input type="range" min={1} max={10} value={fatigue}
                            onChange={(e) => setFatigue(parseInt(e.target.value))}
                            className="w-full h-8 accent-red-500 touch-manipulation" />
                    </div>
                    {error && <p className="text-xs text-red-400">{error}</p>}
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={onClose} disabled={saving} className="py-4 rounded-xl bg-zinc-800 text-zinc-400 font-semibold active:bg-zinc-700 touch-manipulation disabled:opacity-40">Cancel</button>
                        <button onClick={go} disabled={saving}
                            className="py-4 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white font-bold active:opacity-80 disabled:opacity-50 touch-manipulation">
                            {saving ? "Finalizing..." : "Confirm & Complete"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Set Card ────────────────────────────────────────────────────────────────

function SetCard({ exerciseIndex, index, actual, lastData, onChange, onRemove, onCopyAbove, onMoveUp, onMoveDown, canMoveUp, canMoveDown, onComplete: onDone, onOpenFieldKeypad, activeField }: {
    exerciseIndex: number;
    index: number;
    actual: ActualSet;
    lastData: LastSessionSet | null;
    onChange: (u: ActualSet) => void;
    onRemove: () => void;
    onCopyAbove: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    canMoveUp: boolean;
    canMoveDown: boolean;
    onComplete: (setIndex: number) => void; // triggers rest timer + next focus
    onOpenFieldKeypad: (field: KeypadField) => void;
    activeField: KeypadField | null;
}) {
    const upd = (f: Partial<ActualSet>) => onChange({ ...actual, ...f });
    const isEditingThisSet = activeField !== null;
    const setType = normalizeSetType(actual.set_type);

    return (
        <div className={`bg-zinc-900/60 border rounded-xl transition-all ${isEditingThisSet ? "border-red-500/70 ring-1 ring-red-500/40" : "border-zinc-800"}`}>
            {/* Top row */}
            <div className="px-3 pt-2.5 pb-1.5 min-h-[22px]">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    {lastData ? (
                        <span className="text-xs text-zinc-600 leading-none">
                            Last: {lastData.weight && `${lastData.weight}lb`}{lastData.reps && ` × ${lastData.reps}`}
                        </span>
                    ) : null}
                    {isEditingThisSet ? (
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-red-300 leading-none">
                            Editing {fieldLabel(activeField)}
                        </span>
                    ) : null}
                </div>
            </div>

            {/* Inputs row */}
            <div className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.25fr)] gap-2 px-3 pb-3 pt-0.5 items-center">
                <div className="h-full">
                    <select
                        value={setType}
                        onChange={(e) => upd({ set_type: normalizeSetType(e.target.value) })}
                        className="w-full h-full min-h-[44px] bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-xs font-semibold text-zinc-200 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        aria-label={`Set ${index + 1} type`}
                    >
                        <option value="normal">Normal</option>
                        <option value="approach">Approach</option>
                        <option value="warmup">Warmup</option>
                        <option value="drop">Drop set</option>
                    </select>
                </div>
                <div>
                    <input type="number" step="2.5" inputMode="decimal"
                        id={`set-${exerciseIndex}-${index}-weight`}
                        aria-label={`Set ${index + 1} weight in pounds`}
                        value={actual.actual_weight ?? ""}
                        onFocus={(e) => {
                            e.currentTarget.blur();
                            onOpenFieldKeypad("weight");
                        }}
                        onChange={(e) => upd({ actual_weight: e.target.value ? parseFloat(e.target.value) : null })}
                        placeholder="lb"
                        className={`w-full bg-zinc-800 border rounded-lg px-2 py-2 text-base font-mono text-center text-white placeholder-zinc-700 focus:outline-none ${activeField === "weight"
                                ? "border-red-500 ring-1 ring-red-500"
                                : "border-zinc-700 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                            }`} />
                </div>
                <div>
                    <input type="number" inputMode="numeric"
                        id={`set-${exerciseIndex}-${index}-reps`}
                        aria-label={`Set ${index + 1} reps`}
                        value={actual.actual_reps ?? ""}
                        onFocus={(e) => {
                            e.currentTarget.blur();
                            onOpenFieldKeypad("reps");
                        }}
                        onChange={(e) => upd({ actual_reps: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="reps"
                        className={`w-full bg-zinc-800 border rounded-lg px-2 py-2 text-base font-mono text-center text-white placeholder-zinc-700 focus:outline-none ${activeField === "reps"
                                ? "border-red-500 ring-1 ring-red-500"
                                : "border-zinc-700 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                            }`} />
                </div>
                <div>
                    <input type="number" inputMode="numeric" min="0" max="5"
                        id={`set-${exerciseIndex}-${index}-rir`}
                        aria-label={`Set ${index + 1} RIR`}
                        value={actual.actual_rir ?? ""}
                        onFocus={(e) => {
                            e.currentTarget.blur();
                            onOpenFieldKeypad("rir");
                        }}
                        onChange={(e) => upd({ actual_rir: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="RIR"
                        className={`w-full bg-zinc-800 border rounded-lg px-2 py-2 text-base font-mono text-center text-white placeholder-zinc-700 focus:outline-none ${activeField === "rir"
                                ? "border-red-500 ring-1 ring-red-500"
                                : "border-zinc-700 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                            }`} />
                </div>
                {/* Done button */}
                <div>
                    <div className="grid grid-cols-5 gap-1">
                        <button
                            onClick={onCopyAbove}
                            title="Copiar set anterior"
                            disabled={index === 0}
                            className="h-[44px] rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 active:text-red-300 active:bg-red-900/30 disabled:opacity-30 disabled:active:text-zinc-400 disabled:active:bg-zinc-800 flex items-center justify-center text-base touch-manipulation"
                        >
                            ⧉
                        </button>
                        <button
                            onClick={onMoveUp}
                            title="Mover arriba"
                            disabled={!canMoveUp}
                            className="h-[44px] rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 active:text-red-300 active:bg-red-900/30 disabled:opacity-30 disabled:active:text-zinc-400 disabled:active:bg-zinc-800 flex items-center justify-center text-base touch-manipulation"
                        >
                            ↑
                        </button>
                        <button
                            onClick={onMoveDown}
                            title="Mover abajo"
                            disabled={!canMoveDown}
                            className="h-[44px] rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 active:text-red-300 active:bg-red-900/30 disabled:opacity-30 disabled:active:text-zinc-400 disabled:active:bg-zinc-800 flex items-center justify-center text-base touch-manipulation"
                        >
                            ↓
                        </button>
                        <button
                            onClick={onRemove}
                            title="Remove set"
                            className="h-[44px] rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 active:text-red-300 active:bg-red-900/30 flex items-center justify-center text-xl touch-manipulation"
                        >
                            ×
                        </button>
                        <button
                            onClick={() => {
                                upd({ completed: !actual.completed });
                                if (!actual.completed) onDone(index); // trigger rest timer on marking done
                            }}
                            title="Marcar completado"
                            className={`h-[44px] rounded-lg font-bold text-base transition-colors touch-manipulation ${actual.completed
                                    ? "bg-red-600 text-white"
                                    : "bg-zinc-800 border border-zinc-700 text-zinc-500"
                                }`}
                        >
                            ✓
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Exercise Accordion ──────────────────────────────────────────────────────

function ExerciseAccordion({ exerciseIndex, state, onToggle, onSetChange, onAddSet, onMoveSet, onRemoveSet, onCopyPreviousSet, onRemoveExercise, onSwap, onMoveUp, onMoveDown, onSetComplete, onOpenFieldKeypad, activeSetKeypadField }: {
    exerciseIndex: number;
    state: ExerciseState;
    onToggle: () => void;
    onSetChange: (si: number, u: ActualSet) => void;
    onAddSet: (setType: ActualSet["set_type"]) => void;
    onMoveSet: (setIndex: number, direction: -1 | 1) => void;
    onRemoveSet: (si: number) => void;
    onCopyPreviousSet: (si: number) => void;
    onRemoveExercise: () => void;
    onSwap: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onSetComplete: (setIndex: number) => void;
    onOpenFieldKeypad: (setIndex: number, field: KeypadField) => void;
    activeSetKeypadField: { setIdx: number; field: KeypadField } | null;
}) {
    const { open, sets, lastSession } = state;
    const done = sets.filter((s) => s.completed).length;
    const total = sets.length;
    const allDone = done === total && total > 0;

    return (
        <div className={`rounded-xl border overflow-hidden ${allDone ? "border-red-600/50 bg-red-950/10" : "border-zinc-700/50 bg-zinc-800/50"}`}>
            <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-4 text-left touch-manipulation active:bg-zinc-700/20">
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-500">{state.is_anchor ? "anchor" : "std"}</span>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-base truncate">{state.name}</p>
                    {state.is_anchor && <span className="text-xs text-red-400 font-bold uppercase">Anchor</span>}
                    {/* Last session summary under exercise name */}
                    {lastSession && lastSession.length > 0 && (
                        <p className="text-xs text-zinc-600 mt-0.5">
                            Last: {lastSession.filter(s => s.set_type !== "warmup").slice(0, 3).map(s => `${s.weight}×${s.reps}`).join(", ")}
                        </p>
                    )}
                </div>
                <div className={`px-2.5 py-1 rounded-full text-sm font-bold flex-shrink-0 ${allDone ? "bg-red-600/30 text-red-400" : done > 0 ? "bg-red-600/20 text-red-300" : "bg-zinc-700/60 text-zinc-500"}`}>
                    {done}/{total}
                </div>
                <span className={`text-zinc-500 text-lg flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
            </button>

            {open && (
                <div className="px-4 pb-4 space-y-3">
                    <div className="flex gap-2">
                        <button onClick={onSwap} className="flex-1 py-2 text-sm rounded-lg bg-zinc-700/40 text-zinc-400 active:bg-red-900/30 active:text-red-300 touch-manipulation">Swap</button>
                        <button onClick={onMoveUp} className="px-3 py-2 text-sm rounded-lg bg-zinc-700/40 text-zinc-400 active:bg-red-900/30 active:text-red-300 touch-manipulation">↑</button>
                        <button onClick={onMoveDown} className="px-3 py-2 text-sm rounded-lg bg-zinc-700/40 text-zinc-400 active:bg-red-900/30 active:text-red-300 touch-manipulation">↓</button>
                        <button onClick={onRemoveExercise} className="flex-1 py-2 text-sm rounded-lg bg-zinc-700/40 text-zinc-400 active:bg-red-900/30 active:text-red-400 touch-manipulation">Remove</button>
                    </div>
                    <div className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.25fr)] gap-2 px-3 pb-0.5 text-[10px] uppercase tracking-wide text-zinc-500 font-semibold text-center leading-none">
                        <span className="text-center">type</span>
                        <span className="text-center">lbs</span>
                        <span className="text-center">reps</span>
                        <span className="text-center">rir</span>
                        <span className="text-center">actions</span>
                    </div>
                    <div className="space-y-3">
                        {sets.map((actual, i) => (
                            <SetCard
                                key={i}
                                exerciseIndex={exerciseIndex}
                                index={i}
                                actual={actual}
                                lastData={lastSession ? lastSession[i] ?? null : null}
                                onChange={(u) => onSetChange(i, u)}
                                onRemove={() => onRemoveSet(i)}
                                onCopyAbove={() => onCopyPreviousSet(i)}
                                onMoveUp={() => onMoveSet(i, -1)}
                                onMoveDown={() => onMoveSet(i, 1)}
                                canMoveUp={i > 0}
                                canMoveDown={i < sets.length - 1}
                                onComplete={onSetComplete}
                                onOpenFieldKeypad={(field) => onOpenFieldKeypad(i, field)}
                                activeField={activeSetKeypadField?.setIdx === i ? activeSetKeypadField.field : null}
                            />
                        ))}
                    </div>

                    <div className="grid grid-cols-1">
                        <button onClick={() => onAddSet("normal")}
                            className="py-2 rounded-xl border border-dashed border-zinc-700 text-zinc-500 text-xs active:border-red-500 active:text-red-400 touch-manipulation">
                            + Add set
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TodayPage() {
    const [plan, setPlan] = useState<TodayPlan | null>(null);
    const [exercises, setExercises] = useState<ExerciseState[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [dayOptions, setDayOptions] = useState<DayOption[]>([]);
    const [recommendation, setRecommendation] = useState<DayRecommendation | null>(null);
    const [selectedDay, setSelectedDay] = useState("");
    const [generating, setGenerating] = useState(false);
    const [creatingTemplate, setCreatingTemplate] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savedId, setSavedId] = useState<number | null>(null);
    const [toast, setToast] = useState("");
    const [showComplete, setShowComplete] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [nextDay, setNextDay] = useState<number | null>(null);
    const [streakDays, setStreakDays] = useState<number>(0);
    const [finishSummary, setFinishSummary] = useState<WorkoutFinishSummary | null>(null);
    const [swapFor, setSwapFor] = useState<string | null>(null);
    const [showAddExercise, setShowAddExercise] = useState(false);
    const [uiStep, setUiStep] = useState<1 | 2>(1);
    const [focusMode, setFocusMode] = useState(false);
    const [focusIndex, setFocusIndex] = useState(0);
    const [restTimerLeft, setRestTimerLeft] = useState<number | null>(null);
    const [restRunning, setRestRunning] = useState(false);
    const [restDefaultSeconds, setRestDefaultSeconds] = useState(120);
    const [workoutElapsedSeconds, setWorkoutElapsedSeconds] = useState(0);
    const [workoutTimerRunning, setWorkoutTimerRunning] = useState(false);
    const [shortBarWeight, setShortBarWeight] = useState(35);
    const [keypadTarget, setKeypadTarget] = useState<KeypadTarget | null>(null);
    const [plateTarget, setPlateTarget] = useState<{ exerciseIdx: number; setIdx: number } | null>(null);
    const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
    const undoTimeoutRef = useRef<number | null>(null);
    const generateRequestRef = useRef(0);
    const draftReadyRef = useRef(false);
    const workoutElapsedRef = useRef(0);
    const workoutTimerRunningRef = useRef(false);
    const [lastDraftSaveAt, setLastDraftSaveAt] = useState<number | null>(null);
    const [restoredDraft, setRestoredDraft] = useState(false);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

    const clearUndoTimeout = useCallback(() => {
        if (undoTimeoutRef.current !== null) {
            window.clearTimeout(undoTimeoutRef.current);
            undoTimeoutRef.current = null;
        }
    }, []);

    const queueUndo = useCallback((previousExercises: ExerciseState[], label: string) => {
        clearUndoTimeout();
        setUndoAction({ previousExercises: cloneExercises(previousExercises), label });
        undoTimeoutRef.current = window.setTimeout(() => {
            setUndoAction(null);
            undoTimeoutRef.current = null;
        }, 5000);
    }, [clearUndoTimeout]);

    const applyUndo = useCallback(() => {
        if (!undoAction) return;
        clearUndoTimeout();
        setExercises(cloneExercises(undoAction.previousExercises));
        setUndoAction(null);
        showToast("Undo applied");
    }, [undoAction, clearUndoTimeout]);

    useEffect(() => {
        workoutElapsedRef.current = workoutElapsedSeconds;
    }, [workoutElapsedSeconds]);

    useEffect(() => {
        workoutTimerRunningRef.current = workoutTimerRunning;
    }, [workoutTimerRunning]);

    const buildExerciseStateFromPlan = useCallback((data: TodayPlan): ExerciseState[] => (
        data.exercises.map((ex) => ({
            name: ex.name,
            is_anchor: ex.is_anchor,
            notes: ex.notes,
            plannedSets: ex.sets,
            sets: initSets(ex.sets),
            open: false,
            lastSession: null,
        }))
    ), []);

    const readDraft = useCallback((dayName: string): TodayDraft | null => {
        if (typeof window === "undefined") return null;
        const raw = window.localStorage.getItem(draftKey(dayName));
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw) as TodayDraft;
            if (parsed.version !== 1 || parsed.dayName !== dayName || !Array.isArray(parsed.exercises)) {
                return null;
            }
            return parsed;
        } catch {
            return null;
        }
    }, []);

    const writeDraftNow = useCallback((
        dayName: string,
        exerciseState: ExerciseState[],
        draftSavedId: number | null,
        draftElapsedSeconds: number,
        draftTimerRunning: boolean
    ) => {
        if (typeof window === "undefined") return;
        const draft: TodayDraft = {
            version: 1,
            dayName,
            date: localDateISO(),
            savedId: draftSavedId,
            savedAt: Date.now(),
            startedAt: draftTimerRunning ? Date.now() - draftElapsedSeconds * 1000 : null,
            elapsedSeconds: draftElapsedSeconds,
            timerRunning: draftTimerRunning,
            exercises: exerciseState.map((ex) => ({
                ...ex,
                lastSession: null,
                sets: normalizeIndices(ex.sets),
            })),
        };
        window.localStorage.setItem(draftKey(dayName), JSON.stringify(draft));
        setLastDraftSaveAt(draft.savedAt);
    }, []);

    const clearDraft = useCallback((dayName?: string) => {
        if (typeof window === "undefined") return;
        const keyDay = dayName ?? plan?.day_name;
        if (!keyDay) return;
        window.localStorage.removeItem(draftKey(keyDay));
    }, [plan?.day_name]);

    const hydrateFromLoggedWorkout = useCallback(async (dayName: string, base: ExerciseState[]) => {
        const today = localDateISO();
        const workouts = await api.getWorkouts(40);
        const match = workouts.find((w) => w.date === today && w.template_day_name === dayName);
        if (!match) {
            return { exercises: base, workoutId: null as number | null };
        }

        const detail = await api.getWorkout(match.id);
        const fromWorkout: ExerciseState[] = detail.exercises.map((ex) => {
            const baseEx = base.find((b) => normalizeName(b.name) === normalizeName(ex.name));
            const sets = normalizeIndices(
                ex.sets.map((s, i) => ({
                    index: i,
                    set_type: (s.set_type as ActualSet["set_type"]) || "normal",
                    actual_weight: s.weight,
                    actual_reps: s.reps,
                    actual_rir: s.rir,
                    completed: s.completed,
                }))
            );

            return {
                name: ex.name,
                is_anchor: baseEx?.is_anchor ?? false,
                notes: baseEx?.notes ?? "",
                plannedSets: baseEx?.plannedSets ?? [],
                sets,
                open: false,
                lastSession: null,
            };
        });

        return {
            exercises: mergeExercises(base, fromWorkout),
            workoutId: detail.id,
        };
    }, []);

    const applyPlanWithRecovery = useCallback(async (data: TodayPlan, showRestoreToast = false) => {
        draftReadyRef.current = false;

        const base = buildExerciseStateFromPlan(data);

        let merged = base;
        let recoveredWorkoutId: number | null = null;

        try {
            const serverProgress = await hydrateFromLoggedWorkout(data.day_name, merged);
            merged = serverProgress.exercises;
            recoveredWorkoutId = serverProgress.workoutId;
        } catch {
            // Non-blocking; local draft can still recover state
        }

        const localDraft = readDraft(data.day_name);
        const legacyElapsedSeconds = localDraft?.startedAt
            ? Math.max(0, Math.floor((Date.now() - localDraft.startedAt) / 1000))
            : 0;
        const nextElapsedSeconds = Math.max(0, localDraft?.elapsedSeconds ?? legacyElapsedSeconds);
        const nextTimerRunning = localDraft?.timerRunning ?? true;
        if (localDraft) {
            merged = mergeExercises(merged, localDraft.exercises);
            recoveredWorkoutId = localDraft.savedId ?? recoveredWorkoutId;
            setRestoredDraft(true);
            if (showRestoreToast) {
                showToast("Borrador restaurado");
            }
        } else {
            setRestoredDraft(false);
        }

        setPlan(data);
        setExercises(merged);
        setSavedId(recoveredWorkoutId);
        setCompleted(false);
        setNextDay(null);
        setStreakDays(0);
        setFinishSummary(null);
        setWorkoutElapsedSeconds(nextElapsedSeconds);
        setWorkoutTimerRunning(nextTimerRunning);
        setRestTimerLeft(null);
        setRestRunning(false);
        clearUndoTimeout();
        setUndoAction(null);

        writeDraftNow(data.day_name, merged, recoveredWorkoutId, nextElapsedSeconds, nextTimerRunning);
        draftReadyRef.current = true;
    }, [buildExerciseStateFromPlan, clearUndoTimeout, hydrateFromLoggedWorkout, readDraft, writeDraftNow]);

    const loadDayMeta = useCallback(async () => {
        const [options, rec] = await Promise.all([
            api.getDayOptions(),
            api.getDayRecommendation(),
        ]);
        setDayOptions(options);
        setRecommendation(rec);
        const initial = rec?.day_name || options[0]?.name || "";
        setSelectedDay((prev) => prev || initial);
    }, []);

    useEffect(() => {
        if (!plan || !draftReadyRef.current) return;
        const timer = window.setTimeout(() => {
            writeDraftNow(
                plan.day_name,
                exercises,
                savedId,
                workoutElapsedRef.current,
                workoutTimerRunningRef.current,
            );
        }, 400);
        return () => window.clearTimeout(timer);
    }, [plan, exercises, savedId, writeDraftNow]);

    useEffect(() => {
        if (!plan || !draftReadyRef.current) return;
        if (workoutElapsedSeconds === 0 || workoutElapsedSeconds % 15 !== 0) return;
        writeDraftNow(plan.day_name, exercises, savedId, workoutElapsedSeconds, workoutTimerRunning);
    }, [plan, exercises, savedId, workoutElapsedSeconds, workoutTimerRunning, writeDraftNow]);

    useEffect(() => () => clearUndoTimeout(), [clearUndoTimeout]);

    useEffect(() => {
        if (completed || !workoutTimerRunning) return;
        const timer = window.setInterval(() => {
            setWorkoutElapsedSeconds((prev) => prev + 1);
        }, 1000);
        return () => window.clearInterval(timer);
    }, [workoutTimerRunning, completed]);

    useEffect(() => {
        if (!plan) return;
        const handler = () => {
            writeDraftNow(plan.day_name, exercises, savedId, workoutElapsedSeconds, workoutTimerRunning);
        };
        window.addEventListener("beforeunload", handler);
        return () => {
            window.removeEventListener("beforeunload", handler);
        };
    }, [plan, exercises, savedId, workoutElapsedSeconds, workoutTimerRunning, writeDraftNow]);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            try {
                await loadDayMeta();
                if (cancelled) return;
            } catch (e: unknown) {
                if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load options");
            }

            try {
                const data = await api.getTodayPlan();
                if (!cancelled) {
                    await applyPlanWithRecovery(data, true);
                    setSelectedDay(data.day_name);
                    setUiStep(2);
                }
            } catch {
                // No plan generated yet
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [applyPlanWithRecovery, loadDayMeta]);

    useEffect(() => {
        api
            .getPersonalProfile()
            .then((profile) => setShortBarWeight(profile.preferred_short_bar_lbs ?? 35))
            .catch(() => {});
    }, []);

    const mapGeneratedPlanToTodayPlan = useCallback((planData: Awaited<ReturnType<typeof api.generateDay>>): TodayPlan => ({
        plan_id: 0,
        day_name: planData.day_name,
        estimated_duration_min: planData.estimated_duration_min,
        total_sets: planData.total_sets,
        exercises: planData.exercises.map((ex) => ({
            name: ex.name,
            is_anchor: ex.is_anchor,
            notes: ex.notes || "",
            sets: ex.sets.map((s, i) => ({
                index: i,
                set_type: s.set_type,
                weight_lbs: s.weight_lbs,
                target_reps: s.target_reps,
                rir_target: s.rir_target ?? null,
                rest_seconds: s.rest_seconds ?? null,
            })),
        })),
    }), []);

    const generateAndLoadDay = useCallback(async (
        dayName: string,
        options?: { showSuccessToast?: boolean; switchToTrain?: boolean }
    ) => {
        if (!dayName || generating) return;
        const requestId = generateRequestRef.current + 1;
        generateRequestRef.current = requestId;
        setGenerating(true);
        try {
            const planData = await api.generateDay(dayName);
            if (generateRequestRef.current !== requestId) return;
            await applyPlanWithRecovery(mapGeneratedPlanToTodayPlan(planData), true);
            setSelectedDay(planData.day_name);
            if (options?.switchToTrain ?? true) {
                setUiStep(2);
            }
            if (options?.showSuccessToast ?? true) {
                showToast(`Plan generado: ${formatDayName(planData.day_name)}`);
            }
        } catch (e: unknown) {
            showToast(e instanceof Error ? e.message : "Generation failed");
        } finally {
            if (generateRequestRef.current === requestId) {
                setGenerating(false);
            }
        }
    }, [applyPlanWithRecovery, generating, mapGeneratedPlanToTodayPlan]);

    const handleGenerate = useCallback(async () => {
        if (!selectedDay) return;
        await generateAndLoadDay(selectedDay, { showSuccessToast: true, switchToTrain: true });
    }, [generateAndLoadDay, selectedDay]);

    const handleSelectDay = useCallback(async (dayName: string) => {
        setSelectedDay(dayName);
        if (!dayName) return;
        if (plan?.day_name === dayName) {
            setUiStep(2);
            return;
        }
        await generateAndLoadDay(dayName, { showSuccessToast: false, switchToTrain: true });
    }, [generateAndLoadDay, plan?.day_name]);

    const handleCreateTemplate = async (payload: DayOptionCreate) => {
        try {
            const created = await api.createDayOption(payload);
            await loadDayMeta();
            setSelectedDay(created.name);
            setCreatingTemplate(false);
            showToast(`Template creado: ${formatDayName(created.name)}`);
        } catch (e: unknown) {
            showToast(e instanceof Error ? e.message : "Failed to create template");
        }
    };

    // Lazy-load last session when accordion opens
    const handleToggle = (idx: number) => {
        setExercises((prev) => prev.map((e, i) => {
            if (i !== idx) return e;
            const willOpen = !e.open;
            // Fetch last session data if opening and not yet fetched
            if (willOpen && e.lastSession === null) {
                api.getLastSession(e.name).then((data) => {
                    setExercises((p2) => p2.map((e2, i2) => i2 === idx ? { ...e2, lastSession: data } : e2));
                }).catch(() => {
                    setExercises((p2) => p2.map((e2, i2) => i2 === idx ? { ...e2, lastSession: [] } : e2));
                });
            }
            return { ...e, open: willOpen };
        }));
    };

    const updateSet = (exIdx: number, si: number, u: ActualSet) =>
        setExercises((p) => p.map((e, i) => i === exIdx ? { ...e, sets: e.sets.map((s, j) => j === si ? u : s) } : e));

    const addSet = (exIdx: number, setType: ActualSet["set_type"] = "normal") =>
        setExercises((p) => p.map((e, i) => i === exIdx ? { ...e, sets: [...e.sets, newSet(e.sets.length, setType)] } : e));

    const moveSet = (exIdx: number, si: number, direction: -1 | 1) =>
        setExercises((p) => p.map((e, i) => {
            if (i !== exIdx) return e;
            const target = si + direction;
            if (target < 0 || target >= e.sets.length) return e;
            const nextSets = [...e.sets];
            [nextSets[si], nextSets[target]] = [nextSets[target], nextSets[si]];
            return { ...e, sets: normalizeIndices(nextSets) };
        }));

    const removeSet = (exIdx: number, si: number) =>
        setExercises((p) => {
            const target = p[exIdx];
            if (!target || !target.sets[si]) return p;
            const next = p.map((e, i) => i === exIdx
                ? { ...e, sets: e.sets.filter((_, j) => j !== si).map((s, j) => ({ ...s, index: j })) }
                : e);
            queueUndo(p, `${target.name}: set removed`);
            return next;
        });

    const copyPreviousSet = (exIdx: number, si: number) =>
        setExercises((p) =>
            p.map((e, i) => {
                if (i !== exIdx) return e;
                if (si === 0) return e;
                const previous = e.sets[si - 1];
                if (!previous) return e;
                const nextSets = e.sets.map((s, j) =>
                    j === si
                        ? {
                            ...s,
                            set_type: previous.set_type,
                            actual_weight: previous.actual_weight,
                            actual_reps: previous.actual_reps,
                            actual_rir: previous.actual_rir,
                            completed: false,
                        }
                        : s
                );
                return { ...e, sets: nextSets };
            })
        );

    const removeExercise = (idx: number) =>
        setExercises((p) => {
            const target = p[idx];
            if (!target) return p;
            const next = p.filter((_, i) => i !== idx);
            queueUndo(p, `${target.name}: exercise removed`);
            return next;
        });

    const addExercise = (exercise: { name: string; is_anchor: boolean }) => {
        setExercises((p) => [
            ...p,
            {
                name: exercise.name,
                is_anchor: exercise.is_anchor,
                notes: "",
                plannedSets: [],
                sets: [newSet(0, "normal")],
                open: true,
                lastSession: [],
            },
        ]);
        setShowAddExercise(false);
        showToast(`Added ${exercise.name}`);
    };

    const moveExercise = (idx: number, direction: -1 | 1) => {
        setExercises((prev) => {
            const next = idx + direction;
            if (next < 0 || next >= prev.length) return prev;
            const arr = [...prev];
            [arr[idx], arr[next]] = [arr[next], arr[idx]];
            return arr;
        });
    };

    const swapExercise = (idx: number, alt: AlternativeExercise) => {
        setExercises((p) => p.map((e, i) => i === idx ? { ...e, name: alt.name, is_anchor: alt.is_anchor } : e));
        setSwapFor(null);
        showToast(`Swapped to ${alt.name}`);
    };

    const buildPayload = useCallback(() => {
        if (!plan) return null;
        const exEntries: ExerciseLogEntry[] = exercises
            .map((e) => ({
                name: e.name,
                sets: e.sets
                    .filter((s) => s.completed || hasSetData(s))
                    .map((s) => ({ ...s, set_type: s.set_type ?? "normal" })),
            }))
            .filter((e) => e.sets.length > 0);
        return { day_name: plan.day_name, training_type: plan.training_type, exercises: exEntries };
    }, [plan, exercises]);

    const save = useCallback(async (silent = false): Promise<number | null> => {
        const payload = buildPayload();
        if (!payload) { if (!silent) showToast("Genera un plan primero."); return null; }
        if (payload.exercises.length === 0) { if (!silent) showToast("Ingresa al menos un set para guardar."); return null; }
        if (!silent) setSaving(true);
        try {
            const res = await api.logToday(payload);
            setSavedId(res.workout_id);
            if (plan) {
                writeDraftNow(plan.day_name, exercises, res.workout_id, workoutElapsedSeconds, workoutTimerRunning);
            }
            if (!silent) {
                showToast(`Saved as Workout #${res.workout_id}`);
            }
            return res.workout_id;
        } catch { if (!silent) showToast("Save failed."); }
        finally { if (!silent) setSaving(false); }
        return null;
    }, [buildPayload, writeDraftNow, plan, exercises, workoutElapsedSeconds, workoutTimerRunning]);

    const openFinishModal = useCallback(() => {
        const summary = buildFinishSummary(exercises);
        if (summary.loggedSets === 0) {
            showToast("Ingresa al menos un set antes de finalizar.");
            return;
        }
        setFinishSummary(summary);
        setShowComplete(true);
    }, [exercises]);

    const confirmFinish = useCallback(async (fatigue: number) => {
        let workoutId = savedId;
        if (workoutId === null) {
            workoutId = await save(true);
        }
        if (workoutId === null) {
            throw new Error("Workout save failed");
        }

        const durationMin = workoutElapsedSeconds > 0
            ? Math.max(1, Math.round(workoutElapsedSeconds / 60))
            : undefined;

        const response = await api.completeSession(workoutId, fatigue, durationMin);
        clearDraft();
        setStreakDays(response.streak_days ?? 0);
        setNextDay(response.next_day_index);
        setCompleted(true);
        setShowComplete(false);
    }, [savedId, save, clearDraft, workoutElapsedSeconds]);

    const startAnotherRoutine = useCallback(() => {
        clearDraft();
        setCompleted(false);
        setShowComplete(false);
        setNextDay(null);
        setStreakDays(0);
        setFinishSummary(null);
        setSavedId(null);
        setPlan(null);
        setExercises([]);
        setUiStep(1);
        setFocusMode(false);
        setFocusIndex(0);
        setWorkoutElapsedSeconds(0);
        setWorkoutTimerRunning(false);
        setPlateTarget(null);
        setKeypadTarget(null);
        setRestTimerLeft(null);
        setRestRunning(false);
    }, [clearDraft]);

    useEffect(() => {
        if (!restRunning || restTimerLeft === null) return;
        const timer = window.setInterval(() => {
            setRestTimerLeft((prev) => {
                if (prev === null) return null;
                if (prev <= 1) {
                    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                    setRestRunning(false);
                    return null;
                }
                return prev - 1;
            });
        }, 1000);

        return () => window.clearInterval(timer);
    }, [restRunning, restTimerLeft]);

    const startRestTimer = () => {
        setRestTimerLeft(restDefaultSeconds);
        setRestRunning(true);
    };

    const closePlateCalculator = () => setPlateTarget(null);

    const closeWeightKeypad = () => setKeypadTarget(null);

    const openSetFieldKeypad = useCallback((exerciseIdx: number, setIdx: number, field: KeypadField) => {
        setKeypadTarget({ exerciseIdx, setIdx, field });
        window.requestAnimationFrame(() => {
            const el = document.getElementById(`set-${exerciseIdx}-${setIdx}-${field}`);
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
    }, []);

    const updateFieldFromKeypad = (value: number | null) => {
        if (!keypadTarget) return;
        const targetSet = exercises[keypadTarget.exerciseIdx]?.sets[keypadTarget.setIdx];
        if (!targetSet) return;
        if (keypadTarget.field === "weight") {
            updateSet(keypadTarget.exerciseIdx, keypadTarget.setIdx, { ...targetSet, actual_weight: value });
            return;
        }

        if (keypadTarget.field === "reps") {
            updateSet(keypadTarget.exerciseIdx, keypadTarget.setIdx, {
                ...targetSet,
                actual_reps: value === null ? null : Math.max(0, Math.floor(value)),
            });
            return;
        }

        updateSet(keypadTarget.exerciseIdx, keypadTarget.setIdx, {
            ...targetSet,
            actual_rir: value === null ? null : Math.min(5, Math.max(0, Math.floor(value))),
        });
    };

    const openPlateCalculatorFromKeypad = () => {
        if (!keypadTarget) return;
        if (keypadTarget.field !== "weight") return;
        setPlateTarget({ exerciseIdx: keypadTarget.exerciseIdx, setIdx: keypadTarget.setIdx });
        setKeypadTarget(null);
    };

    const savePlateWeight = (weight: number) => {
        if (!plateTarget) return;
        const { exerciseIdx, setIdx } = plateTarget;
        const targetSet = exercises[exerciseIdx]?.sets[setIdx];
        if (!targetSet) {
            closePlateCalculator();
            return;
        }
        updateSet(exerciseIdx, setIdx, { ...targetSet, actual_weight: weight });
        closePlateCalculator();
    };

    const totalSets = exercises.reduce((n, e) => n + e.sets.length, 0);
    const enteredSets = exercises.reduce((n, e) => n + e.sets.filter((s) => hasSetData(s)).length, 0);
    const completedSets = exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0);
    const workoutDurationSeconds = workoutElapsedSeconds;
    const workoutDurationLabel = formatElapsedTime(workoutDurationSeconds);
    const visibleExerciseItems = focusMode
        ? exercises[focusIndex]
            ? [{ ex: exercises[focusIndex], index: focusIndex }]
            : []
        : exercises.map((ex, index) => ({ ex, index }));
    const selectedDayOption = dayOptions.find((opt) => opt.name === selectedDay) ?? null;

    const swapIndex = swapFor !== null ? exercises.findIndex((e) => e.name === swapFor) : -1;

    useEffect(() => {
        if (exercises.length === 0) {
            setFocusIndex(0);
            return;
        }
        if (focusIndex > exercises.length - 1) {
            setFocusIndex(exercises.length - 1);
        }
    }, [exercises.length, focusIndex]);

    if (loading) return (
        <div className="flex items-center justify-center h-64 gap-3 text-zinc-500">
            <div className="w-6 h-6 border-2 border-zinc-600 border-t-red-500 rounded-full animate-spin" />
            Loading...
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
            <p className="text-red-400 text-xl">No plan found</p>
            <p className="text-zinc-500 text-sm">{error}</p>
            <a href="/today" className="mt-2 px-6 py-3.5 bg-red-600 text-white text-base font-semibold rounded-xl">Generate in Today</a>
        </div>
    );

    if (completed) return (
        <div className="relative max-w-lg mx-auto min-h-[70vh] flex flex-col justify-center px-5 py-10 text-center">
            <CompletionConfetti />
            <div className="relative rounded-3xl border border-red-500/30 bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.24),_transparent_60%)] bg-zinc-950 p-6">
                <div className="mx-auto h-16 w-16 rounded-2xl border border-red-500/40 bg-red-500/15 flex items-center justify-center shadow-[0_0_35px_rgba(239,68,68,0.28)]">
                    <WorkoutCompletedIcon className="h-8 w-8 text-red-200" />
                </div>
                <h2 className="text-3xl font-bold text-white mt-3">Terminado por hoy</h2>
                <p className="text-zinc-400 text-sm mt-1">Sesion cerrada correctamente. Puedes descansar o empezar otra rutina.</p>

                <div className="grid grid-cols-2 gap-3 mt-5 text-left">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-zinc-500">Next Day</p>
                        <p className="text-xl font-bold text-white">{nextDay ?? "-"}</p>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-zinc-500">Streak</p>
                        <p className="text-xl font-bold text-red-300">{streakDays} days</p>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-zinc-500">Exercises</p>
                        <p className="text-xl font-bold text-white">{finishSummary?.exerciseCount ?? 0}</p>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-zinc-500">Volume</p>
                        <p className="text-xl font-bold text-white">{Math.round(finishSummary?.totalVolume ?? 0)}</p>
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                        onClick={startAnotherRoutine}
                        className="inline-flex items-center justify-center w-full py-3 bg-red-600 text-white rounded-xl font-bold text-base"
                    >
                        Empezar otra rutina
                    </button>
                    <a href="/today" className="inline-flex items-center justify-center w-full py-3 border border-zinc-700 text-zinc-200 rounded-xl font-semibold text-base">
                        Volver a Today
                    </a>
                </div>
            </div>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto pb-36 sm:pb-8 overflow-x-hidden">
            {plateTarget && (
                <PlateCalculatorModal
                    shortBarWeight={shortBarWeight}
                    onClose={closePlateCalculator}
                    onSave={savePlateWeight}
                />
            )}
            {keypadTarget && (
                <WeightKeypadSheet
                    initialValue={
                        keypadTarget.field === "weight"
                            ? exercises[keypadTarget.exerciseIdx]?.sets[keypadTarget.setIdx]?.actual_weight ?? null
                            : keypadTarget.field === "reps"
                                ? exercises[keypadTarget.exerciseIdx]?.sets[keypadTarget.setIdx]?.actual_reps ?? null
                                : exercises[keypadTarget.exerciseIdx]?.sets[keypadTarget.setIdx]?.actual_rir ?? null
                    }
                    mode={keypadTarget.field === "weight" ? "weight" : "count"}
                    activeTargetLabel={`Set ${keypadTarget.setIdx + 1} ${fieldLabel(keypadTarget.field)}`}
                    onChange={updateFieldFromKeypad}
                    onClose={closeWeightKeypad}
                    onOpenPlateCalculator={openPlateCalculatorFromKeypad}
                />
            )}
            {/* Modals */}
            {swapFor !== null && swapIndex >= 0 && (
                <SwapModal exerciseName={swapFor} onClose={() => setSwapFor(null)} onSwap={(alt) => swapExercise(swapIndex, alt)} />
            )}
            {showComplete && finishSummary && (
                <CompleteModal
                    summary={finishSummary}
                    onConfirm={confirmFinish}
                    onClose={() => setShowComplete(false)}
                />
            )}
            {showAddExercise && <AddExerciseModal onAdd={addExercise} onClose={() => setShowAddExercise(false)} />}
            {creatingTemplate && (
                <CreateTemplateModal
                    onCreate={handleCreateTemplate}
                    onClose={() => setCreatingTemplate(false)}
                />
            )}

            {/* Header */}
            <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Today</h1>
                        <p className="text-zinc-500 text-sm mt-1">Simple, focused training flow</p>
                    </div>
                </div>

                <div className="sticky top-2 z-20 rounded-xl border border-zinc-800 bg-zinc-950/95 p-3 backdrop-blur">
                    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 mb-2">
                        <button
                            onClick={() => setUiStep(1)}
                            className={`w-8 h-8 rounded-full text-xs font-bold border ${uiStep === 1 ? "border-red-500 bg-red-600 text-white" : "border-zinc-700 bg-zinc-900 text-zinc-400"}`}
                        >
                            1
                        </button>
                        <div className="h-[2px] bg-zinc-800 rounded-full overflow-hidden">
                            <div className={`h-full bg-red-500 transition-all duration-300 ${uiStep === 2 ? "w-full" : "w-1/2"}`} />
                        </div>
                        <button
                            onClick={() => setUiStep(2)}
                            disabled={!plan}
                            className={`w-8 h-8 rounded-full text-xs font-bold border ${uiStep === 2 ? "border-red-500 bg-red-600 text-white" : "border-zinc-700 bg-zinc-900 text-zinc-400"} disabled:opacity-40`}
                        >
                            2
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <button
                            onClick={() => setUiStep(1)}
                            className={`py-1.5 rounded-md border ${uiStep === 1 ? "border-red-500/40 text-red-200 bg-red-600/15" : "border-zinc-800 text-zinc-500"}`}
                        >
                            Choose
                        </button>
                        <button
                            onClick={() => setUiStep(2)}
                            disabled={!plan}
                            className={`py-1.5 rounded-md border ${uiStep === 2 ? "border-red-500/40 text-red-200 bg-red-600/15" : "border-zinc-800 text-zinc-500"} disabled:opacity-40`}
                        >
                            Train
                        </button>
                    </div>
                </div>
            </div>

            {uiStep === 1 && (
                <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 transition-all duration-200">
                    <div className="mb-4 rounded-xl border border-zinc-800 bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.14),_transparent_65%)] bg-zinc-900/60 px-3 py-3">
                        <p className="text-sm font-semibold text-zinc-100">Choose your training day</p>
                        <p className="text-xs text-zinc-400 mt-1">Pick a split and jump straight into training.</p>
                    </div>
                    {recommendation && (
                        <div className="mb-3 rounded-xl border border-red-500/35 bg-[linear-gradient(135deg,rgba(239,68,68,0.16),rgba(24,24,27,0.65))] px-3 py-2.5 shadow-[0_0_0_1px_rgba(239,68,68,0.08)]">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-[10px] uppercase tracking-wide text-red-200/85">Suggested</p>
                                    <p className="text-sm text-red-100 font-semibold mt-0.5">{formatDayName(recommendation.day_name)}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        void handleSelectDay(recommendation.day_name);
                                    }}
                                    disabled={generating}
                                    className="px-2.5 py-1 rounded-md border border-red-300/40 text-[11px] font-semibold text-red-50 bg-red-500/25 hover:bg-red-500/35 disabled:opacity-40 transition-colors"
                                >
                                    Use
                                </button>
                            </div>
                            {recommendation.reason ? (
                                <p className="text-[11px] text-zinc-300/85 mt-1.5">{recommendation.reason}</p>
                            ) : null}
                        </div>
                    )}
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {dayOptions.map((opt) => {
                                const selected = selectedDay === opt.name;
                                return (
                                    <button
                                        key={opt.name}
                                        onClick={() => {
                                            void handleSelectDay(opt.name);
                                        }}
                                        disabled={generating}
                                        className={`group relative overflow-hidden rounded-xl border px-3 py-3 text-left transition-all duration-200 disabled:opacity-40 ${selected
                                                ? "border-red-500/55 bg-[linear-gradient(160deg,rgba(239,68,68,0.16),rgba(24,24,27,0.72))] shadow-[0_0_0_1px_rgba(239,68,68,0.12)]"
                                                : "border-zinc-800 bg-zinc-900/70 hover:border-zinc-700 hover:-translate-y-0.5"
                                            }`}
                                    >
                                        <span className={`absolute right-2.5 top-2.5 h-2 w-2 rounded-full transition-colors ${selected ? "bg-red-300" : "bg-zinc-700 group-hover:bg-zinc-500"}`} />
                                        <p className={`text-sm font-semibold pr-5 ${selected ? "text-red-100" : "text-zinc-200"}`}>{formatDayName(opt.name)}</p>
                                        <p className={`text-[11px] mt-1.5 line-clamp-2 ${selected ? "text-zinc-300" : "text-zinc-500"}`}>
                                            {opt.focus || "No focus note"}
                                        </p>
                                        <p className={`text-[10px] uppercase tracking-wide mt-2 ${selected ? "text-red-200/85" : "text-zinc-600"}`}>
                                            {selected ? "Selected" : "Tap to load"}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                        {selectedDayOption?.focus ? (
                            <p className="text-xs text-zinc-500 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                                <span className="text-zinc-300 font-medium">Focus:</span> {selectedDayOption.focus}
                            </p>
                        ) : null}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <button
                                onClick={handleGenerate}
                                disabled={!selectedDay || generating}
                                className="py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl disabled:opacity-40 transition-colors"
                            >
                                {generating ? "Generating..." : plan ? "Regenerate" : "Generate"}
                            </button>
                            <button
                                onClick={() => setUiStep(2)}
                                disabled={!plan}
                                className="py-3 border border-zinc-700 text-zinc-200 font-semibold rounded-xl hover:border-zinc-500 disabled:opacity-40 transition-colors"
                            >
                                Continue
                            </button>
                            <button
                                onClick={() => setCreatingTemplate(true)}
                                className="py-3 border border-zinc-700 text-zinc-300 font-semibold rounded-xl hover:border-zinc-500 transition-colors"
                            >
                                New Template
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {uiStep === 2 && (
                plan ? (
                    <div className="space-y-3 transition-all duration-200">
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                            <p className="text-sm text-zinc-300 font-semibold">{formatDayName(plan.day_name)}</p>
                            <div className="flex items-center justify-between mt-1 text-xs text-zinc-500">
                                <span>{completedSets}/{totalSets} sets</span>
                                <span>{plan.estimated_duration_min} min est.</span>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                                <div className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs ${workoutTimerRunning
                                    ? "border-red-500/35 bg-red-500/10 text-red-100"
                                    : "border-zinc-700 bg-zinc-900/70 text-zinc-300"
                                    }`}>
                                    <span className={workoutTimerRunning ? "text-red-200/80" : "text-zinc-500"}>Duration</span>
                                    <span className={`font-mono ${workoutTimerRunning ? "text-red-100" : "text-zinc-200"}`}>{workoutDurationLabel}</span>
                                    <span className={`h-1.5 w-1.5 rounded-full ${workoutTimerRunning ? "bg-red-300" : "bg-zinc-500"}`} />
                                </div>
                                <button
                                    onClick={() => {
                                        const nextRunning = !workoutTimerRunning;
                                        setWorkoutTimerRunning(nextRunning);
                                        if (plan && draftReadyRef.current) {
                                            writeDraftNow(plan.day_name, exercises, savedId, workoutElapsedSeconds, nextRunning);
                                        }
                                    }}
                                    className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${workoutTimerRunning
                                        ? "border-red-500/40 bg-red-500/20 text-red-100 hover:bg-red-500/30"
                                        : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
                                        }`}
                                >
                                    {workoutTimerRunning ? "Pause" : "Resume"}
                                </button>
                            </div>
                            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mt-3">
                                <div
                                    className="h-full bg-red-500 rounded-full transition-all duration-500"
                                    style={{ width: `${totalSets > 0 ? (completedSets / totalSets) * 100 : 0}%` }}
                                />
                            </div>
                            <p className="text-xs text-zinc-600 mt-2">
                                {restoredDraft ? "Draft restored" : "Draft active"}
                                {lastDraftSaveAt ? ` · ${new Date(lastDraftSaveAt).toLocaleTimeString()}` : ""}
                            </p>

                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setFocusMode((v) => !v)}
                                    className={`py-2 rounded-lg text-xs font-semibold border ${focusMode
                                        ? "border-red-500/40 bg-red-600/15 text-red-200"
                                        : "border-zinc-700 text-zinc-400"
                                        }`}
                                >
                                    {focusMode ? "Focus On" : "Focus Off"}
                                </button>
                                <button
                                    onClick={() => {
                                        setFocusMode(true);
                                        setFocusIndex(0);
                                    }}
                                    disabled={exercises.length === 0}
                                    className="py-2 rounded-lg text-xs font-semibold border border-zinc-700 text-zinc-400 disabled:opacity-40"
                                >
                                    Start First Exercise
                                </button>
                            </div>

                            {focusMode && exercises.length > 0 && (
                                <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                                    <button
                                        onClick={() => setFocusIndex((i) => Math.max(0, i - 1))}
                                        disabled={focusIndex === 0}
                                        className="px-2 py-1 rounded border border-zinc-700 disabled:opacity-30"
                                    >
                                        Prev
                                    </button>
                                    <span>{focusIndex + 1}/{exercises.length}</span>
                                    <button
                                        onClick={() => setFocusIndex((i) => Math.min(exercises.length - 1, i + 1))}
                                        disabled={focusIndex >= exercises.length - 1}
                                        className="px-2 py-1 rounded border border-zinc-700 disabled:opacity-30"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="sticky top-2 z-10">
                            <RestTimerPanel
                                secondsLeft={restTimerLeft}
                                running={restRunning}
                                defaultSeconds={restDefaultSeconds}
                                onToggle={() => {
                                    if (restTimerLeft === null) return;
                                    setRestRunning((prev) => !prev);
                                }}
                                onAdd30={() => {
                                    if (restTimerLeft === null) return;
                                    setRestTimerLeft((prev) => (prev ?? 0) + 30);
                                }}
                                onReset={() => {
                                    setRestTimerLeft(restDefaultSeconds);
                                    setRestRunning(false);
                                }}
                                onSkip={() => {
                                    setRestTimerLeft(null);
                                    setRestRunning(false);
                                }}
                                onSetDefault={(seconds) => {
                                    setRestDefaultSeconds(seconds);
                                    if (restTimerLeft === null) return;
                                    setRestTimerLeft(seconds);
                                    setRestRunning(false);
                                }}
                            />
                        </div>

                        <div className="hidden sm:grid sm:grid-cols-3 gap-2">
                            <button
                                onClick={() => setShowAddExercise(true)}
                                className="py-3 border border-zinc-700 text-zinc-300 font-semibold rounded-xl"
                            >
                                Add Exercise
                            </button>
                            <button
                                onClick={() => save(false)}
                                disabled={saving || enteredSets === 0}
                                className="py-3 bg-red-600 text-white font-bold rounded-xl disabled:opacity-40"
                            >
                                {saving ? "Saving..." : `Save ${enteredSets}`}
                            </button>
                            <button
                                onClick={openFinishModal}
                                disabled={enteredSets === 0}
                                className="py-3 bg-zinc-800 text-zinc-100 font-bold rounded-xl disabled:opacity-40"
                            >
                                Finish
                            </button>
                        </div>

                        {exercises.length === 0 && (
                            <div className="text-center py-16 text-zinc-600 rounded-2xl border border-zinc-800 bg-zinc-950">
                                <p className="text-lg mb-3">No exercises yet</p>
                                <button onClick={() => setShowAddExercise(true)} className="px-6 py-3 border border-zinc-700 rounded-xl text-zinc-400 touch-manipulation">Add Exercise</button>
                            </div>
                        )}
                        {visibleExerciseItems.map(({ ex, index: i }) => (
                            <ExerciseAccordion
                                key={`${ex.name}-${i}`}
                                exerciseIndex={i}
                                state={ex}
                                onToggle={() => handleToggle(i)}
                                onSetChange={(si, u) => updateSet(i, si, u)}
                                onAddSet={(setType) => addSet(i, setType)}
                                onMoveSet={(si, direction) => moveSet(i, si, direction)}
                                onRemoveSet={(si) => removeSet(i, si)}
                                onCopyPreviousSet={(si) => copyPreviousSet(i, si)}
                                onRemoveExercise={() => removeExercise(i)}
                                onSwap={() => setSwapFor(ex.name)}
                                onMoveUp={() => moveExercise(i, -1)}
                                onMoveDown={() => moveExercise(i, 1)}
                                onSetComplete={() => startRestTimer()}
                                onOpenFieldKeypad={(si, field) => openSetFieldKeypad(i, si, field)}
                                activeSetKeypadField={keypadTarget?.exerciseIdx === i ? { setIdx: keypadTarget.setIdx, field: keypadTarget.field } : null}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-center text-zinc-500 text-sm">
                        Generate a plan first in step 1.
                    </div>
                )
            )}

            {plan && uiStep === 2 && (
                <div className="sm:hidden fixed left-3 right-3 bottom-20 z-40 rounded-2xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-xl p-2">
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => setShowAddExercise(true)}
                            className="py-3 rounded-xl border border-zinc-700 text-zinc-200 text-sm font-semibold"
                        >
                            Add
                        </button>
                        <button
                            onClick={() => save(false)}
                            disabled={saving || enteredSets === 0}
                            className="py-3 rounded-xl bg-red-600 text-white text-sm font-bold disabled:opacity-40"
                        >
                            {saving ? "Saving" : `Save ${enteredSets}`}
                        </button>
                        <button
                            onClick={openFinishModal}
                            disabled={enteredSets === 0}
                            className="py-3 rounded-xl bg-zinc-800 text-zinc-100 text-sm font-bold disabled:opacity-40"
                        >
                            Finish
                        </button>
                    </div>
                </div>
            )}

            {undoAction && (
                <div className="fixed bottom-36 left-4 right-4 z-40 sm:left-auto sm:right-6 sm:w-auto sm:max-w-sm px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl flex items-center justify-between gap-3">
                    <p className="text-xs text-zinc-300 truncate">{undoAction.label}</p>
                    <button
                        onClick={applyUndo}
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold"
                    >
                        Undo
                    </button>
                </div>
            )}

            {toast && (
                <div className="fixed bottom-24 left-4 right-4 z-40 sm:left-auto sm:right-6 sm:w-auto sm:max-w-sm px-5 py-4 bg-zinc-800 border border-zinc-600 rounded-xl shadow-2xl text-sm font-medium text-white text-center">
                    {toast}
                </div>
            )}
        </div>
    );
}
