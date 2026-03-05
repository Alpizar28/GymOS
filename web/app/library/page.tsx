"use client";

import { useEffect, useState } from "react";
import { api, type ExerciseItem } from "@/lib/api";

export default function LibraryPage() {
    const [exercises, setExercises] = useState<ExerciseItem[]>([]);
    const [filter, setFilter] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getExercises().then((data) => {
            setExercises(data);
            setLoading(false);
        });
    }, []);

    const filtered = exercises.filter(
        (ex) =>
            ex.name.toLowerCase().includes(filter.toLowerCase()) ||
            ex.primary_muscle.toLowerCase().includes(filter.toLowerCase()) ||
            ex.movement_pattern.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div>
            <h1 className="text-2xl font-bold tracking-tight mb-6">Exercise Library</h1>

            {/* Search */}
            <input
                type="text"
                placeholder="Search exercises, muscles, or patterns..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-500 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all mb-4"
            />

            {loading ? (
                <div className="flex items-center justify-center h-40 gap-3 text-zinc-500">
                    <div className="w-5 h-5 border-2 border-zinc-600 border-t-red-500 rounded-full animate-spin" />
                    Loading...
                </div>
            ) : (
                <>
                    <p className="text-sm text-zinc-500 mb-3">
                        {filtered.length} exercises {filter && `matching "${filter}"`}
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-zinc-800">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-zinc-900/80">
                                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Exercise</th>
                                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Muscle</th>
                                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Type</th>
                                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Pattern</th>
                                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Avg Wt</th>
                                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Max</th>
                                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Sets</th>
                                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-zinc-500 font-semibold">Tags</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((ex) => (
                                    <tr key={ex.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors">
                                        <td className="px-4 py-3 font-semibold">{ex.name}</td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-xs">
                                                {ex.primary_muscle}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-zinc-400">{ex.type}</td>
                                        <td className="px-4 py-3 text-zinc-400">{ex.movement_pattern}</td>
                                        <td className="px-4 py-3 font-mono text-zinc-300">{ex.avg_weight.toFixed(0)} lb</td>
                                        <td className="px-4 py-3 font-mono text-zinc-300">{ex.max_weight.toFixed(0)} lb</td>
                                        <td className="px-4 py-3 font-mono">{ex.total_sets}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1.5">
                                                {ex.is_anchor && (
                                                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-500/15 text-red-400">
                                                        Anchor
                                                    </span>
                                                )}
                                                {ex.is_staple && (
                                                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-500/15 text-red-400">
                                                        Staple
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
