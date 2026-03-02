"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
    api,
    type TodayPlan,
    type TodaySet,
    type SetLogEntry,
    type ExerciseLogEntry,
    type AlternativeExercise,
    type LastSessionSet,
    type PrRecord,
} from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActualSet extends SetLogEntry { }

interface ExerciseState {
    name: string;
    is_anchor: boolean;
    notes: string;
    plannedSets: TodaySet[];
    sets: ActualSet[];
    open: boolean;
    lastSession: LastSessionSet[] | null; // null = not fetched yet
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newSet(index: number): ActualSet {
    return { index, actual_weight: null, actual_reps: null, actual_rir: null, completed: false };
}

function initSets(planned: TodaySet[]): ActualSet[] {
    return planned.map((s) => ({
        index: s.index,
        actual_weight: s.weight_lbs,
        actual_reps: s.target_reps,
        actual_rir: s.rir_target,
        completed: false,
    }));
}

function setColors(type: string) {
    if (type === "warmup") return { badge: "text-amber-400 bg-amber-900/30", bar: "border-l-amber-400" };
    if (type === "drop") return { badge: "text-red-400 bg-red-900/30", bar: "border-l-red-400" };
    return { badge: "text-violet-400 bg-violet-900/30", bar: "border-l-violet-500" };
}

function e1rm(w: number, r: number) { return Math.round(w * (1 + r / 30)); }

// ─── Rest Timer ───────────────────────────────────────────────────────────────

function RestTimer({ seconds: initial, onDismiss }: { seconds: number; onDismiss: () => void }) {
    const [left, setLeft] = useState(initial);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pct = (left / initial) * 100;

    useEffect(() => {
        intervalRef.current = setInterval(() => {
            setLeft((p) => {
                if (p <= 1) {
                    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                    onDismiss();
                    return 0;
                }
                return p - 1;
            });
        }, 1000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [onDismiss]);

    const mins = Math.floor(left / 60);
    const secs = left % 60;

    return (
        <div className="fixed bottom-20 left-4 right-4 z-50 sm:left-auto sm:right-6 sm:w-72">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl p-4 overflow-hidden">
                {/* Progress bar */}
                <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-violet-500 to-teal-500 transition-all duration-1000"
                    style={{ width: `${pct}%` }} />
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wide font-semibold">Rest</p>
                        <p className="text-4xl font-bold font-mono text-white tabular-nums">
                            {mins}:{secs.toString().padStart(2, "0")}
                        </p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <button onClick={() => setLeft((p) => p + 30)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-700 text-zinc-300 text-sm font-semibold active:bg-zinc-600 touch-manipulation">
                            +30s
                        </button>
                        <button onClick={onDismiss}
                            className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-500 text-sm active:bg-zinc-700 touch-manipulation">
                            Skip
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── PR Banner ────────────────────────────────────────────────────────────────

function PrBanner({ prs, onDismiss }: { prs: PrRecord[]; onDismiss: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
            <div className="bg-gradient-to-br from-amber-900/80 to-orange-900/80 border border-amber-500/50 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
                <div className="text-6xl mb-3">🏆</div>
                <h2 className="text-2xl font-bold text-white mb-1">Personal Record!</h2>
                <div className="space-y-2 my-4">
                    {prs.map((pr, i) => (
                        <div key={i} className="bg-black/30 rounded-xl px-4 py-2.5">
                            <p className="font-semibold text-amber-300">{pr.exercise}</p>
                            <p className="text-sm text-amber-200/70 mt-0.5">
                                {pr.type === "weight" ? `New max weight: ${pr.value} lbs` : `New estimated 1RM: ${pr.value} lbs`}
                            </p>
                        </div>
                    ))}
                </div>
                <button onClick={onDismiss}
                    className="w-full py-3.5 bg-amber-500 text-black font-bold rounded-xl active:opacity-80 touch-manipulation text-base">
                    Let's go! 🔥
                </button>
            </div>
        </div>
    );
}

// ─── Add Exercise Modal ───────────────────────────────────────────────────────

function AddExerciseModal({ onAdd, onClose }: { onAdd: (name: string) => void; onClose: () => void }) {
    const [q, setQ] = useState("");
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                    <h3 className="font-semibold text-white">Add Exercise</h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white text-2xl w-10 h-10 flex items-center justify-center">✕</button>
                </div>
                <div className="p-5 space-y-4 pb-8">
                    <input autoFocus type="text" placeholder="Exercise name…" value={q}
                        onChange={(e) => setQ(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && q.trim()) onAdd(q.trim()); }}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-base text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                    <button onClick={() => q.trim() && onAdd(q.trim())}
                        className="w-full py-3.5 bg-violet-600 text-white font-bold rounded-xl active:opacity-80 touch-manipulation text-base">
                        ➕ Add to Workout
                    </button>
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
                                        <p className="text-xs text-zinc-500 mt-0.5">{alt.primary_muscle} · {alt.movement_pattern}{alt.is_anchor && " · 🔴"}</p>
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

function CompleteModal({ workoutId, onComplete, onClose }: {
    workoutId: number; onComplete: (nd: number) => void; onClose: () => void;
}) {
    const [fatigue, setFatigue] = useState(5);
    const [saving, setSaving] = useState(false);
    const label = fatigue <= 3 ? "Easy 💪" : fatigue <= 6 ? "Moderate 😤" : fatigue <= 8 ? "Hard 😓" : "Destroyed 💀";
    async function go() {
        setSaving(true);
        try { const r = await api.completeSession(workoutId, fatigue); onComplete(r.next_day_index); }
        finally { setSaving(false); }
    }
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm shadow-2xl">
                <div className="px-6 py-5 border-b border-zinc-800">
                    <h3 className="font-bold text-white text-xl">Complete Session 🎉</h3>
                    <p className="text-sm text-zinc-500 mt-1">Rate fatigue to advance the day</p>
                </div>
                <div className="p-6 space-y-6 pb-10">
                    <div>
                        <div className="flex justify-between text-base mb-3">
                            <span className="text-zinc-400">Fatigue</span>
                            <span className="font-bold text-white">{fatigue}/10 — {label}</span>
                        </div>
                        <input type="range" min={1} max={10} value={fatigue}
                            onChange={(e) => setFatigue(parseInt(e.target.value))}
                            className="w-full h-8 accent-violet-500 touch-manipulation" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={onClose} className="py-4 rounded-xl bg-zinc-800 text-zinc-400 font-semibold active:bg-zinc-700 touch-manipulation">Cancel</button>
                        <button onClick={go} disabled={saving}
                            className="py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold active:opacity-80 disabled:opacity-50 touch-manipulation">
                            {saving ? "Saving..." : "Done! →"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Set Card ────────────────────────────────────────────────────────────────

function SetCard({ index, planned, actual, lastData, onChange, onRemove, onDuplicate, onComplete: onDone }: {
    index: number;
    planned: TodaySet | null;
    actual: ActualSet;
    lastData: LastSessionSet | null;
    onChange: (u: ActualSet) => void;
    onRemove: () => void;
    onDuplicate: () => void;
    onComplete: () => void; // triggers rest timer
}) {
    const upd = (f: Partial<ActualSet>) => onChange({ ...actual, ...f });
    const type = planned?.set_type ?? "normal";
    const { badge, bar } = setColors(type);
    const label = type === "warmup" ? "Warmup" : type === "drop" ? "Drop" : "Work";

    // Estimated 1RM for this set
    const est1rm = actual.actual_weight && actual.actual_reps
        ? e1rm(actual.actual_weight, actual.actual_reps) : null;

    return (
        <div className={`border-l-4 ${bar} bg-zinc-900/60 rounded-r-xl`}>
            {/* Top row */}
            <div className="flex items-center justify-between px-3 pt-3 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge}`}>{label} #{index + 1}</span>
                    {lastData && (
                        <span className="text-xs text-zinc-600">
                            Last: {lastData.weight && `${lastData.weight}lb`}{lastData.reps && ` × ${lastData.reps}`}
                        </span>
                    )}
                    {est1rm && (
                        <span className="text-xs text-zinc-700">~{est1rm} 1RM</span>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    <button onClick={onDuplicate} title="Duplicate set"
                        className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-600 active:text-violet-400 active:bg-violet-900/30 flex items-center justify-center text-base touch-manipulation">
                        ⧉
                    </button>
                    <button onClick={onRemove} title="Remove set"
                        className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-600 active:text-red-400 active:bg-red-900/30 flex items-center justify-center text-xl touch-manipulation">
                        ×
                    </button>
                </div>
            </div>

            {/* Inputs row */}
            <div className="grid grid-cols-4 gap-2 px-3 pb-3 pt-1 items-end">
                <div>
                    <label className="block text-xs text-zinc-600 mb-1">lbs</label>
                    <input type="number" step="2.5" inputMode="decimal"
                        value={actual.actual_weight ?? ""}
                        onChange={(e) => upd({ actual_weight: e.target.value ? parseFloat(e.target.value) : null })}
                        placeholder={planned?.weight_lbs ? String(planned.weight_lbs) : "lb"}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2.5 text-base font-mono text-center text-white placeholder-zinc-700 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500" />
                </div>
                <div>
                    <label className="block text-xs text-zinc-600 mb-1">reps</label>
                    <input type="number" inputMode="numeric"
                        value={actual.actual_reps ?? ""}
                        onChange={(e) => upd({ actual_reps: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder={planned?.target_reps ? String(planned.target_reps) : "reps"}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2.5 text-base font-mono text-center text-white placeholder-zinc-700 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500" />
                </div>
                <div>
                    <label className="block text-xs text-zinc-600 mb-1">RIR</label>
                    <input type="number" inputMode="numeric" min="0" max="5"
                        value={actual.actual_rir ?? ""}
                        onChange={(e) => upd({ actual_rir: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder={planned?.rir_target != null ? String(planned.rir_target) : "RIR"}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2.5 text-base font-mono text-center text-white placeholder-zinc-700 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500" />
                </div>
                {/* Done button */}
                <div>
                    <label className="block text-xs text-zinc-600 mb-1">&nbsp;</label>
                    <button
                        onClick={() => {
                            upd({ completed: !actual.completed });
                            if (!actual.completed) onDone(); // trigger rest timer on marking done
                        }}
                        className={`w-full py-2.5 rounded-lg font-bold text-base transition-colors touch-manipulation ${actual.completed
                                ? "bg-emerald-600 text-white"
                                : "bg-zinc-800 border border-zinc-700 text-zinc-500"
                            }`}
                    >
                        {actual.completed ? "✓" : "○"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Exercise Accordion ──────────────────────────────────────────────────────

function ExerciseAccordion({ state, onToggle, onSetChange, onAddSet, onRemoveSet, onDuplicateSet, onRemoveExercise, onSwap, onSetComplete }: {
    state: ExerciseState;
    onToggle: () => void;
    onSetChange: (si: number, u: ActualSet) => void;
    onAddSet: () => void;
    onRemoveSet: (si: number) => void;
    onDuplicateSet: (si: number) => void;
    onRemoveExercise: () => void;
    onSwap: () => void;
    onSetComplete: (restSecs: number) => void;
}) {
    const { open, sets, plannedSets, lastSession } = state;
    const done = sets.filter((s) => s.completed).length;
    const total = sets.length;
    const allDone = done === total && total > 0;
    const defaultRestSecs = plannedSets[0]?.rest_seconds ?? 90;

    return (
        <div className={`rounded-xl border overflow-hidden ${allDone ? "border-emerald-600/50 bg-emerald-950/10" : "border-zinc-700/50 bg-zinc-800/50"}`}>
            <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-4 text-left touch-manipulation active:bg-zinc-700/20">
                <span className="text-xl flex-shrink-0">{state.is_anchor ? "🔴" : "⚪"}</span>
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
                <div className={`px-2.5 py-1 rounded-full text-sm font-bold flex-shrink-0 ${allDone ? "bg-emerald-600/30 text-emerald-400" : done > 0 ? "bg-violet-600/20 text-violet-300" : "bg-zinc-700/60 text-zinc-500"}`}>
                    {done}/{total}
                </div>
                <span className={`text-zinc-500 text-lg flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
            </button>

            {open && (
                <div className="px-4 pb-4 space-y-3">
                    <div className="flex gap-2">
                        <button onClick={onSwap} className="flex-1 py-2 text-sm rounded-lg bg-zinc-700/40 text-zinc-400 active:bg-violet-900/30 active:text-violet-300 touch-manipulation">🔄 Swap</button>
                        <button onClick={onRemoveExercise} className="flex-1 py-2 text-sm rounded-lg bg-zinc-700/40 text-zinc-400 active:bg-red-900/30 active:text-red-400 touch-manipulation">🗑️ Remove</button>
                    </div>
                    {state.notes && <p className="text-xs text-zinc-500 italic">💡 {state.notes}</p>}

                    <div className="space-y-3">
                        {sets.map((actual, i) => (
                            <SetCard
                                key={i}
                                index={i}
                                planned={plannedSets[i] ?? null}
                                actual={actual}
                                lastData={lastSession ? lastSession[i] ?? null : null}
                                onChange={(u) => onSetChange(i, u)}
                                onRemove={() => onRemoveSet(i)}
                                onDuplicate={() => onDuplicateSet(i)}
                                onComplete={() => onSetComplete(defaultRestSecs)}
                            />
                        ))}
                    </div>

                    <button onClick={onAddSet}
                        className="w-full py-3 rounded-xl border border-dashed border-zinc-700 text-zinc-500 text-sm active:border-violet-500 active:text-violet-400 touch-manipulation">
                        + Add set
                    </button>
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
    const [saving, setSaving] = useState(false);
    const [savedId, setSavedId] = useState<number | null>(null);
    const [toast, setToast] = useState("");
    const [showComplete, setShowComplete] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [nextDay, setNextDay] = useState<number | null>(null);
    const [swapFor, setSwapFor] = useState<string | null>(null);
    const [showAddExercise, setShowAddExercise] = useState(false);
    const [prs, setPrs] = useState<PrRecord[]>([]);
    // Rest timer: null = hidden, number = seconds remaining start value
    const [restTimer, setRestTimer] = useState<number | null>(null);
    const restDismissed = useRef(false);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

    useEffect(() => {
        api.getTodayPlan()
            .then((data) => {
                setPlan(data);
                setExercises(data.exercises.map((ex) => ({
                    name: ex.name, is_anchor: ex.is_anchor, notes: ex.notes,
                    plannedSets: ex.sets, sets: initSets(ex.sets),
                    open: false, lastSession: null,
                })));
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

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

    const addSet = (exIdx: number) =>
        setExercises((p) => p.map((e, i) => i === exIdx ? { ...e, sets: [...e.sets, newSet(e.sets.length)] } : e));

    const removeSet = (exIdx: number, si: number) =>
        setExercises((p) =>
            p.map((e, i) => i === exIdx
                ? { ...e, sets: e.sets.filter((_, j) => j !== si).map((s, j) => ({ ...s, index: j })) }
                : e)
        );

    const duplicateSet = (exIdx: number, si: number) =>
        setExercises((p) =>
            p.map((e, i) => {
                if (i !== exIdx) return e;
                const src = e.sets[si];
                const copy = { ...src, index: e.sets.length, completed: false };
                return { ...e, sets: [...e.sets, copy] };
            })
        );

    const removeExercise = (idx: number) => setExercises((p) => p.filter((_, i) => i !== idx));

    const addExercise = (name: string) => {
        setExercises((p) => [...p, { name, is_anchor: false, notes: "", plannedSets: [], sets: [newSet(0)], open: true, lastSession: [] }]);
        setShowAddExercise(false);
        showToast(`➕ Added ${name}`);
    };

    const swapExercise = (idx: number, alt: AlternativeExercise) => {
        setExercises((p) => p.map((e, i) => i === idx ? { ...e, name: alt.name, is_anchor: alt.is_anchor } : e));
        setSwapFor(null);
        showToast(`🔄 Swapped to ${alt.name}`);
    };

    const buildPayload = useCallback(() => {
        if (!plan) return null;
        const exEntries: ExerciseLogEntry[] = exercises
            .filter((e) => e.sets.some((s) => s.completed))
            .map((e) => ({ name: e.name, sets: e.sets.filter((s) => s.completed) }));
        return { day_name: plan.day_name, exercises: exEntries };
    }, [plan, exercises]);

    const save = useCallback(async (silent = false) => {
        const payload = buildPayload();
        if (!payload || payload.exercises.length === 0) { if (!silent) showToast("Complete at least one set first."); return; }
        if (!silent) setSaving(true);
        try {
            const res = await api.logToday(payload);
            setSavedId(res.workout_id);
            if (res.prs && res.prs.length > 0) {
                setPrs(res.prs);
            } else if (!silent) {
                showToast(`✅ Saved as Workout #${res.workout_id}`);
            }
        } catch { if (!silent) showToast("❌ Save failed."); }
        finally { if (!silent) setSaving(false); }
    }, [buildPayload]);

    const startRestTimer = (secs: number) => {
        restDismissed.current = false;
        setRestTimer(secs);
    };

    const totalSets = exercises.reduce((n, e) => n + e.sets.length, 0);
    const completedSets = exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0);
    const completedVolume = exercises.reduce(
        (n, e) => n + e.sets.filter((s) => s.completed && s.actual_weight && s.actual_reps)
            .reduce((v, s) => v + s.actual_weight! * s.actual_reps!, 0), 0
    );

    const swapIndex = swapFor !== null ? exercises.findIndex((e) => e.name === swapFor) : -1;

    if (loading) return (
        <div className="flex items-center justify-center h-64 gap-3 text-zinc-500">
            <div className="w-6 h-6 border-2 border-zinc-600 border-t-violet-500 rounded-full animate-spin" />
            Loading...
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
            <p className="text-amber-400 text-xl">⚠️ No plan found</p>
            <p className="text-zinc-500 text-sm">{error}</p>
            <a href="/" className="mt-2 px-6 py-3.5 bg-violet-600 text-white text-base font-semibold rounded-xl">→ Generate on Dashboard</a>
        </div>
    );

    if (completed) return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center gap-5 px-6">
            <div className="text-7xl">🎉</div>
            <h2 className="text-3xl font-bold text-white">Done!</h2>
            <p className="text-zinc-400 text-lg">Day advanced → Day {nextDay}</p>
            <a href="/" className="mt-2 px-8 py-4 bg-violet-600 text-white rounded-xl font-bold text-lg">Dashboard →</a>
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto pb-4">
            {/* Modals */}
            {swapFor !== null && swapIndex >= 0 && (
                <SwapModal exerciseName={swapFor} onClose={() => setSwapFor(null)} onSwap={(alt) => swapExercise(swapIndex, alt)} />
            )}
            {showComplete && savedId !== null && (
                <CompleteModal workoutId={savedId}
                    onComplete={(nd) => { setCompleted(true); setNextDay(nd); setShowComplete(false); }}
                    onClose={() => setShowComplete(false)} />
            )}
            {showAddExercise && <AddExerciseModal onAdd={addExercise} onClose={() => setShowAddExercise(false)} />}
            {prs.length > 0 && <PrBanner prs={prs} onDismiss={() => { setPrs([]); showToast(`✅ Saved as Workout #${savedId}`); }} />}
            {restTimer !== null && <RestTimer seconds={restTimer} onDismiss={() => setRestTimer(null)} />}

            {/* Header */}
            <div className="mb-4">
                <h1 className="text-2xl font-bold tracking-tight">Today</h1>
                <p className="text-zinc-500 text-sm mt-0.5">{plan!.day_name.replace(/_/g, " ")} · ~{plan!.estimated_duration_min} min</p>
            </div>

            {/* Progress bar */}
            <div className="mb-5">
                <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
                    <span>{completedSets}/{totalSets} sets</span>
                    <span>{totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0}%</span>
                </div>
                <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${totalSets > 0 ? (completedSets / totalSets) * 100 : 0}%` }} />
                </div>
            </div>

            {/* Action bar */}
            <div className="flex gap-2 mb-5">
                <button onClick={() => setShowAddExercise(true)}
                    className="flex-1 py-3 border border-zinc-700 text-zinc-300 font-semibold rounded-xl active:bg-zinc-800 touch-manipulation text-sm">
                    ➕ Exercise
                </button>
                <button onClick={() => save(false)} disabled={saving || completedSets === 0}
                    className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-indigo-500 text-white font-bold rounded-xl active:opacity-80 disabled:opacity-40 touch-manipulation text-sm">
                    {saving ? "Saving..." : `💾 Save (${completedSets})`}
                </button>
                {savedId !== null && (
                    <button onClick={() => setShowComplete(true)}
                        className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold rounded-xl active:opacity-80 touch-manipulation text-sm">
                        ✅ Done
                    </button>
                )}
            </div>

            {/* Exercises */}
            <div className="space-y-3">
                {exercises.length === 0 && (
                    <div className="text-center py-16 text-zinc-600">
                        <p className="text-lg mb-3">No exercises yet</p>
                        <button onClick={() => setShowAddExercise(true)} className="px-6 py-3 border border-zinc-700 rounded-xl text-zinc-400 touch-manipulation">➕ Add Exercise</button>
                    </div>
                )}
                {exercises.map((ex, i) => (
                    <ExerciseAccordion
                        key={`${ex.name}-${i}`}
                        state={ex}
                        onToggle={() => handleToggle(i)}
                        onSetChange={(si, u) => updateSet(i, si, u)}
                        onAddSet={() => addSet(i)}
                        onRemoveSet={(si) => removeSet(i, si)}
                        onDuplicateSet={(si) => duplicateSet(i, si)}
                        onRemoveExercise={() => removeExercise(i)}
                        onSwap={() => setSwapFor(ex.name)}
                        onSetComplete={(secs) => startRestTimer(secs)}
                    />
                ))}
            </div>

            {/* Summary */}
            {completedSets > 0 && (
                <div className="mt-6 p-5 bg-zinc-800/60 border border-zinc-700/50 rounded-2xl">
                    <h3 className="font-semibold text-zinc-300 mb-4">📊 Summary</h3>
                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div><p className="text-3xl font-bold text-white">{completedSets}</p><p className="text-xs text-zinc-500 mt-1">Sets</p></div>
                        <div><p className="text-3xl font-bold text-white">{exercises.filter((e) => e.sets.some((s) => s.completed)).length}</p><p className="text-xs text-zinc-500 mt-1">Exercises</p></div>
                        <div>
                            <p className="text-3xl font-bold text-white">
                                {completedVolume > 0 ? `${Math.round(completedVolume / 1000 * 10) / 10}k` : "—"}
                            </p>
                            <p className="text-xs text-zinc-500 mt-1">lbs vol</p>
                        </div>
                    </div>
                    {savedId && <p className="text-center text-xs text-emerald-400 mt-4">✅ Workout #{savedId}</p>}
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
