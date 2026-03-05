"use client";

import { useEffect, useState } from "react";
import { api, type WorkoutSummary, type WorkoutDetail } from "@/lib/api";

function WorkoutModal({
    workout,
    onClose,
}: {
    workout: WorkoutDetail | null;
    onClose: () => void;
}) {
    if (!workout) return null;

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-lg font-bold">
                            {workout.template_day_name?.replace(/_/g, " ") || `Workout #${workout.id}`}
                        </h2>
                        <p className="text-sm text-zinc-500">{workout.date}</p>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-2xl">
                        ×
                    </button>
                </div>

                {workout.notes && (
                    <p className="text-sm text-zinc-400 mb-4 italic">{workout.notes}</p>
                )}

                <div className="space-y-4">
                    {workout.exercises.map((ex, i) => (
                        <div key={i} className="bg-zinc-800/60 border border-zinc-700/40 rounded-lg p-3">
                            <p className="font-semibold mb-2">{ex.name}</p>
                            <div className="flex flex-wrap gap-2">
                                {ex.sets.map((s, j) => {
                                    const borderClass =
                                        s.set_type === "warmup"
                                            ? "border-l-2 border-l-red-400"
                                            : s.set_type === "drop"
                                                ? "border-l-2 border-l-red-400"
                                                : "border-l-2 border-l-red-500";
                                    return (
                                        <span
                                            key={j}
                                            className={`${borderClass} bg-zinc-900/70 px-2 py-1 rounded text-sm font-mono text-zinc-300`}
                                        >
                                            {s.weight || 0}lb × {s.reps || 0}
                                            {s.rir !== null && <span className="text-zinc-500"> RIR{s.rir}</span>}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function WorkoutsPage() {
    const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);
    const [selected, setSelected] = useState<WorkoutDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getWorkouts().then((w) => { setWorkouts(w); setLoading(false); });
    }, []);

    async function openWorkout(id: number) {
        const detail = await api.getWorkout(id);
        setSelected(detail);
    }

    return (
        <div>
            <h1 className="text-2xl font-bold tracking-tight mb-6">Workout Log</h1>

            {loading ? (
                <div className="flex items-center justify-center h-40 gap-3 text-zinc-500">
                    <div className="w-5 h-5 border-2 border-zinc-600 border-t-red-500 rounded-full animate-spin" />
                    Loading...
                </div>
            ) : workouts.length === 0 ? (
                <div className="text-center py-16 text-zinc-600">
                    <p className="text-lg mb-2">No workouts logged yet</p>
                    <p className="text-sm">Use <code className="text-red-400">/log</code> in Telegram to record your first workout!</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-800">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-zinc-900/80">
                                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Date</th>
                                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Template</th>
                                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Exercises</th>
                                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Sets</th>
                                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Duration</th>
                            </tr>
                        </thead>
                        <tbody>
                            {workouts.map((w) => (
                                <tr
                                    key={w.id}
                                    onClick={() => openWorkout(w.id)}
                                    className="border-b border-zinc-800/50 hover:bg-zinc-800/40 cursor-pointer transition-colors"
                                >
                                    <td className="px-4 py-3">{w.date}</td>
                                    <td className="px-4 py-3 text-zinc-400">{w.template_day_name?.replace(/_/g, " ") || "—"}</td>
                                    <td className="px-4 py-3 font-mono">{w.exercise_count}</td>
                                    <td className="px-4 py-3 font-mono">{w.total_sets}</td>
                                    <td className="px-4 py-3 text-zinc-400">{w.duration_min ? `${w.duration_min} min` : "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <WorkoutModal workout={selected} onClose={() => setSelected(null)} />
        </div>
    );
}
