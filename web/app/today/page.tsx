"use client";

import { useEffect, useState, useCallback } from "react";
import {
    api,
    type TodayPlan,
    type TodayExercise,
    type TodaySet,
    type SetLogEntry,
    type ExerciseLogEntry,
} from "@/lib/api";

// ---------- Types ----------

interface ActualSet extends SetLogEntry {
    // mutable UI state
}

interface ExerciseState {
    exercise: TodayExercise;
    open: boolean;
    sets: ActualSet[];
}

// ---------- Utils ----------

function initSets(sets: TodaySet[]): ActualSet[] {
    return sets.map((s) => ({
        index: s.index,
        actual_weight: s.weight_lbs,
        actual_reps: s.target_reps,
        actual_rir: s.rir_target,
        completed: false,
    }));
}

function setTypeBadge(type: string) {
    if (type === "warmup") return <span className="text-amber-400 text-xs font-semibold uppercase">Warmup</span>;
    if (type === "drop") return <span className="text-red-400 text-xs font-semibold uppercase">Drop</span>;
    return <span className="text-violet-400 text-xs font-semibold uppercase">Work</span>;
}

function setTypeBorder(type: string) {
    if (type === "warmup") return "border-l-amber-400";
    if (type === "drop") return "border-l-red-400";
    return "border-l-violet-500";
}

// ---------- Set Row ----------

interface SetRowProps {
    planned: TodaySet;
    actual: ActualSet;
    onChange: (updated: ActualSet) => void;
    autoSave: () => void;
}

function SetRow({ planned, actual, onChange, autoSave }: SetRowProps) {
    const update = (fields: Partial<ActualSet>) => {
        onChange({ ...actual, ...fields });
    };

    return (
        <tr className={`border-l-2 ${setTypeBorder(planned.set_type)} bg-zinc-900/40 hover:bg-zinc-900/70 transition-colors`}>
            <td className="px-3 py-2 text-center">{setTypeBadge(planned.set_type)}</td>

            {/* Planned */}
            <td className="px-3 py-2 text-center text-zinc-500 font-mono text-sm">
                {planned.weight_lbs ?? "—"} lb
            </td>
            <td className="px-3 py-2 text-center text-zinc-500 font-mono text-sm">
                {planned.target_reps ?? "—"}
            </td>
            <td className="px-3 py-2 text-center text-zinc-500 font-mono text-sm">
                {planned.rir_target ?? "—"}
            </td>

            {/* Actual inputs */}
            <td className="px-2 py-2">
                <input
                    type="number"
                    step="2.5"
                    value={actual.actual_weight ?? ""}
                    onChange={(e) => update({ actual_weight: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-20 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-sm font-mono text-center text-white focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
                    placeholder="lb"
                />
            </td>
            <td className="px-2 py-2">
                <input
                    type="number"
                    value={actual.actual_reps ?? ""}
                    onChange={(e) => update({ actual_reps: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-16 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-sm font-mono text-center text-white focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
                    placeholder="reps"
                />
            </td>
            <td className="px-2 py-2">
                <input
                    type="number"
                    min="0"
                    max="5"
                    value={actual.actual_rir ?? ""}
                    onChange={(e) => update({ actual_rir: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-14 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-sm font-mono text-center text-white focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
                    placeholder="RIR"
                />
            </td>

            {/* Completed checkbox */}
            <td className="px-3 py-2 text-center">
                <input
                    type="checkbox"
                    checked={actual.completed}
                    onChange={(e) => {
                        update({ completed: e.target.checked });
                        setTimeout(autoSave, 200);
                    }}
                    className="w-5 h-5 rounded accent-violet-500 cursor-pointer"
                />
            </td>
        </tr>
    );
}

// ---------- Exercise Accordion ----------

interface ExerciseAccordionProps {
    state: ExerciseState;
    onToggle: () => void;
    onSetChange: (setIdx: number, updated: ActualSet) => void;
    autoSave: () => void;
}

function ExerciseAccordion({ state, onToggle, onSetChange, autoSave }: ExerciseAccordionProps) {
    const { exercise, open, sets } = state;
    const completedCount = sets.filter((s) => s.completed).length;
    const totalCount = sets.length;
    const isFullyDone = completedCount === totalCount && totalCount > 0;

    return (
        <div className={`rounded-xl border transition-all duration-200 ${isFullyDone
                ? "border-emerald-600/50 bg-emerald-950/20"
                : "border-zinc-700/50 bg-zinc-800/50"
            }`}>
            {/* Header */}
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
            >
                <div className="flex items-center gap-3">
                    <span className="text-lg">
                        {exercise.is_anchor ? "🔴" : "⚪"}
                    </span>
                    <div>
                        <p className="font-semibold text-white">{exercise.name}</p>
                        {exercise.is_anchor && (
                            <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                                Anchor
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {/* Progress pill */}
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${isFullyDone
                            ? "bg-emerald-600/25 text-emerald-400"
                            : completedCount > 0
                                ? "bg-violet-600/20 text-violet-300"
                                : "bg-zinc-700/50 text-zinc-500"
                        }`}>
                        {isFullyDone ? "✓ " : ""}{completedCount}/{totalCount} sets
                    </div>
                    <span className={`text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
                        ▾
                    </span>
                </div>
            </button>

            {/* Body */}
            {open && (
                <div className="px-5 pb-4 overflow-x-auto">
                    {exercise.notes && (
                        <p className="text-xs text-zinc-500 italic mb-3">💡 {exercise.notes}</p>
                    )}
                    <table className="w-full text-sm min-w-[580px]">
                        <thead>
                            <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-zinc-700/50">
                                <th className="px-3 py-2 text-center">Type</th>
                                <th className="px-3 py-2 text-center text-zinc-600">Plan lbs</th>
                                <th className="px-3 py-2 text-center text-zinc-600">Plan reps</th>
                                <th className="px-3 py-2 text-center text-zinc-600">Plan RIR</th>
                                <th className="px-3 py-2 text-center">Actual lb</th>
                                <th className="px-3 py-2 text-center">Actual reps</th>
                                <th className="px-3 py-2 text-center">RIR</th>
                                <th className="px-3 py-2 text-center">✓</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {exercise.sets.map((planned, i) => (
                                <SetRow
                                    key={i}
                                    planned={planned}
                                    actual={sets[i]}
                                    onChange={(updated) => onSetChange(i, updated)}
                                    autoSave={autoSave}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ---------- Main Page ----------

export default function TodayPage() {
    const [plan, setPlan] = useState<TodayPlan | null>(null);
    const [exercises, setExercises] = useState<ExerciseState[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [savedId, setSavedId] = useState<number | null>(null);
    const [toast, setToast] = useState("");

    useEffect(() => {
        api.getTodayPlan()
            .then((data) => {
                setPlan(data);
                setExercises(
                    data.exercises.map((ex) => ({
                        exercise: ex,
                        open: false,
                        sets: initSets(ex.sets),
                    }))
                );
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    const toggleExercise = (idx: number) => {
        setExercises((prev) =>
            prev.map((e, i) => (i === idx ? { ...e, open: !e.open } : e))
        );
    };

    const updateSet = (exIdx: number, setIdx: number, updated: ActualSet) => {
        setExercises((prev) =>
            prev.map((e, i) =>
                i === exIdx
                    ? { ...e, sets: e.sets.map((s, si) => (si === setIdx ? updated : s)) }
                    : e
            )
        );
    };

    const buildPayload = useCallback(() => {
        if (!plan) return null;
        const exEntries: ExerciseLogEntry[] = exercises
            .filter((e) => e.sets.some((s) => s.completed))
            .map((e) => ({
                name: e.exercise.name,
                sets: e.sets.filter((s) => s.completed),
            }));
        return { day_name: plan.day_name, exercises: exEntries };
    }, [plan, exercises]);

    const save = useCallback(async (silent = false) => {
        const payload = buildPayload();
        if (!payload || payload.exercises.length === 0) {
            if (!silent) setToast("No completed sets to save.");
            return;
        }
        if (!silent) setSaving(true);
        try {
            const res = await api.logToday(payload);
            setSavedId(res.workout_id);
            if (!silent) setToast(`✅ Saved as Workout #${res.workout_id}`);
        } catch (e) {
            if (!silent) setToast("❌ Save failed. Try again.");
        } finally {
            if (!silent) setSaving(false);
            setTimeout(() => setToast(""), 3000);
        }
    }, [buildPayload]);

    // Summary stats
    const totalSets = exercises.reduce((n, e) => n + e.sets.length, 0);
    const completedSets = exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0);
    const completedVolume = exercises.reduce(
        (n, e) =>
            n + e.sets
                .filter((s) => s.completed && s.actual_weight && s.actual_reps)
                .reduce((v, s) => v + (s.actual_weight! * s.actual_reps!), 0),
        0
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 gap-3 text-zinc-500">
                <div className="w-5 h-5 border-2 border-zinc-600 border-t-violet-500 rounded-full animate-spin" />
                Loading plan...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
                <p className="text-amber-400 text-lg">⚠️ No plan found</p>
                <p className="text-zinc-500 text-sm max-w-xs">{error}</p>
                <a href="/" className="mt-4 px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-500 transition">
                    → Generate on Dashboard
                </a>
            </div>
        );
    }

    if (!plan) return null;

    return (
        <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Today's Workout</h1>
                    <p className="text-zinc-500 text-sm mt-1">
                        🏋️ {plan.day_name.replace(/_/g, " ")} &nbsp;·&nbsp;
                        ⏱ ~{plan.estimated_duration_min} min &nbsp;·&nbsp;
                        📊 {plan.total_sets} planned sets
                    </p>
                </div>
                <button
                    onClick={() => save(false)}
                    disabled={saving || completedSets === 0}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-emerald-500/25 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0"
                >
                    {saving ? "⏳ Saving..." : `💾 Save Session (${completedSets} sets)`}
                </button>
            </div>

            {/* Progress bar */}
            <div className="mb-6">
                <div className="flex justify-between text-xs text-zinc-500 mb-1">
                    <span>{completedSets} / {totalSets} sets completed</span>
                    <span>{totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${totalSets > 0 ? (completedSets / totalSets) * 100 : 0}%` }}
                    />
                </div>
            </div>

            {/* Exercises */}
            <div className="space-y-3">
                {exercises.map((exState, i) => (
                    <ExerciseAccordion
                        key={i}
                        state={exState}
                        onToggle={() => toggleExercise(i)}
                        onSetChange={(si, updated) => updateSet(i, si, updated)}
                        autoSave={() => save(true)}
                    />
                ))}
            </div>

            {/* Session Summary */}
            {completedSets > 0 && (
                <div className="mt-8 p-5 bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 border border-zinc-700/50 rounded-xl">
                    <h3 className="font-semibold text-zinc-300 mb-3">📊 Session Summary</h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-2xl font-bold text-white">{completedSets}</p>
                            <p className="text-xs text-zinc-500 uppercase tracking-wide">Sets done</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">
                                {exercises.filter((e) => e.sets.some((s) => s.completed)).length}
                            </p>
                            <p className="text-xs text-zinc-500 uppercase tracking-wide">Exercises</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">
                                {completedVolume > 0 ? Math.round(completedVolume).toLocaleString() : "—"}
                            </p>
                            <p className="text-xs text-zinc-500 uppercase tracking-wide">lbs volume</p>
                        </div>
                    </div>
                    {savedId && (
                        <p className="text-center text-xs text-emerald-400 mt-3">✅ Saved as Workout #{savedId}</p>
                    )}
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-zinc-800 border border-zinc-600 rounded-xl shadow-2xl text-sm font-medium text-white transition-all duration-300">
                    {toast}
                </div>
            )}
        </div>
    );
}
