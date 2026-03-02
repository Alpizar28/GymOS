"use client";

import { useEffect, useState } from "react";
import { api, type WeekDay, type PlanExercise } from "@/lib/api";

const LOCK_ICONS: Record<string, string> = {
    Push_Heavy: "🔴",
    Push_Light: "🟠",
    Pull_Heavy: "🔵",
    Pull_Light: "🟣",
    Legs_Heavy: "🟢",
    Legs_Light: "🟡",
};

function DayCard({ day, onGenerate, loading }: { day: WeekDay; onGenerate: () => void; loading: boolean }) {
    const [open, setOpen] = useState(false);
    const focusParts = day.focus.split(",").map((f) => f.trim());
    const icon = LOCK_ICONS[day.name] ?? "⚪";

    return (
        <div
            className={`rounded-xl border transition-all duration-200 ${day.has_plan
                    ? "border-zinc-700/50 bg-zinc-800/50"
                    : "border-zinc-800/40 bg-zinc-900/40"
                }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                    <span className="text-xl">{icon}</span>
                    <div>
                        <p className="font-semibold text-white">
                            Day {day.day_index} — {day.name.replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                            {focusParts.join(" · ")}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {day.has_plan ? (
                        <button
                            onClick={() => setOpen((o) => !o)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-700/60 text-zinc-300 hover:bg-zinc-700 transition"
                        >
                            {open ? "Hide" : "Show Plan"}
                        </button>
                    ) : (
                        <button
                            onClick={onGenerate}
                            disabled={loading}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600/20 text-violet-300 hover:bg-violet-600/40 transition disabled:opacity-50"
                        >
                            {loading ? "Generating..." : "⚡ Generate"}
                        </button>
                    )}
                </div>
            </div>

            {/* Plan preview */}
            {open && day.plan && (
                <div className="px-5 pb-4 border-t border-zinc-700/30 pt-3">
                    <div className="flex items-center gap-3 text-xs text-zinc-500 mb-3">
                        <span>⏱ ~{day.plan.estimated_duration_min} min</span>
                        <span>📊 {day.plan.total_sets} sets</span>
                        {day.plan.estimated_volume_lbs > 0 && (
                            <span>💪 ~{Math.round(day.plan.estimated_volume_lbs).toLocaleString()} lbs</span>
                        )}
                    </div>
                    <div className="space-y-1">
                        {day.plan.exercises.map((ex: PlanExercise, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-zinc-300">
                                <span>{ex.is_anchor ? "🔴" : "⚪"}</span>
                                <span className="font-medium">{ex.name}</span>
                                <span className="text-zinc-600">
                                    {ex.sets.length} sets
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function WeekPage() {
    const [week, setWeek] = useState<WeekDay[]>([]);
    const [loading, setLoading] = useState(true);
    const [generatingAll, setGeneratingAll] = useState(false);
    const [generatingDay, setGeneratingDay] = useState<number | null>(null);
    const [error, setError] = useState("");

    const load = () => {
        setLoading(true);
        api.getWeekPlan()
            .then(setWeek)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    async function handleGenerateAll() {
        setGeneratingAll(true);
        try {
            await api.generateWeek();
            load();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Generation failed");
        } finally {
            setGeneratingAll(false);
        }
    }

    async function handleGenerateDay(dayIndex: number) {
        setGeneratingDay(dayIndex);
        try {
            // generateToday generates the currently scheduled day; we need /generate-today
            // For individual day generation, use generateWeek and re-fetch
            await api.generateWeek();
            load();
        } catch {
        } finally {
            setGeneratingDay(null);
        }
    }

    const daysWithPlan = week.filter((d) => d.has_plan).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 gap-3 text-zinc-500">
                <div className="w-5 h-5 border-2 border-zinc-600 border-t-violet-500 rounded-full animate-spin" />
                Loading week plan...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64 text-red-400">
                ⚠️ {error}
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Week Plan</h1>
                    <p className="text-zinc-500 text-sm mt-1">
                        {daysWithPlan}/6 days generated
                    </p>
                </div>
                <button
                    onClick={handleGenerateAll}
                    disabled={generatingAll}
                    className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-violet-500/25 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
                >
                    {generatingAll ? "⏳ Generating..." : "⚡ Generate All 6 Days"}
                </button>
            </div>

            {/* Progress bar */}
            <div className="mb-6">
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-violet-500 to-indigo-400 rounded-full transition-all duration-500"
                        style={{ width: `${week.length > 0 ? (daysWithPlan / 6) * 100 : 0}%` }}
                    />
                </div>
            </div>

            {/* Day Cards */}
            <div className="space-y-3">
                {week.map((day) => (
                    <DayCard
                        key={day.day_index}
                        day={day}
                        onGenerate={() => handleGenerateDay(day.day_index)}
                        loading={generatingDay === day.day_index || generatingAll}
                    />
                ))}
            </div>
        </div>
    );
}
