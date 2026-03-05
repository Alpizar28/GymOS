"use client";

import { useEffect, useRef, useState } from "react";
import { api, type AnchorProgress } from "@/lib/api";

// Dynamic import to avoid SSR issues with Chart.js
let Chart: typeof import("chart.js/auto").default;

function AnchorCard({ anchor }: { anchor: AnchorProgress }) {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<InstanceType<typeof Chart> | null>(null);

    const statusColors: Record<string, string> = {
        active: "bg-red-500/15 text-red-400",
        deload: "bg-red-500/15 text-red-400",
        consolidate: "bg-red-500/15 text-red-400",
    };

    useEffect(() => {
        if (!chartRef.current || anchor.history.length === 0 || !Chart) return;

        if (chartInstance.current) chartInstance.current.destroy();

        const labels = anchor.history.map((h) => h.date);
        const weights = anchor.history.map((h) => h.weight);
        const e1rm = anchor.history.map((h) => h.estimated_1rm);

        chartInstance.current = new Chart(chartRef.current, {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: "Weight (lbs)",
                        data: weights,
                        borderColor: "#8b5cf6",
                        backgroundColor: "rgba(139, 92, 246, 0.08)",
                        fill: true,
                        tension: 0.3,
                        pointRadius: 2,
                        pointHoverRadius: 6,
                    },
                    {
                        label: "Est. 1RM",
                        data: e1rm,
                        borderColor: "#06b6d4",
                        borderDash: [5, 5],
                        tension: 0.3,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                    legend: { labels: { color: "#71717a", font: { size: 11 } } },
                },
                scales: {
                    x: {
                        ticks: { color: "#52525b", maxTicksLimit: 10, font: { size: 10 } },
                        grid: { color: "rgba(63, 63, 70, 0.3)" },
                    },
                    y: {
                        ticks: { color: "#52525b", font: { size: 10 } },
                        grid: { color: "rgba(63, 63, 70, 0.3)" },
                    },
                },
            },
        });

        return () => {
            chartInstance.current?.destroy();
        };
    }, [anchor.history]);

    return (
        <div className="bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 border border-zinc-700/50 rounded-xl p-5 card-glow transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h3 className="text-lg font-bold">{anchor.exercise}</h3>
                    <div className="flex items-center gap-3 mt-1">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusColors[anchor.status] || "bg-zinc-700 text-zinc-400"}`}>
                            {anchor.status.toUpperCase()}
                        </span>
                        <span className="text-sm text-zinc-400">
                            Streak: {anchor.streak}{anchor.streak > 0 ? " 🔥" : ""}
                        </span>
                        {anchor.last_rir !== null && (
                            <span className="text-sm text-zinc-500">Last RIR: {anchor.last_rir}</span>
                        )}
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-bold font-mono text-red-400">
                        {anchor.target_weight}lb
                    </p>
                    <p className="text-sm text-zinc-500">× {anchor.reps_range}</p>
                </div>
            </div>

            {anchor.history.length > 0 ? (
                <div className="relative h-60 mt-4">
                    <canvas ref={chartRef} />
                </div>
            ) : (
                <p className="text-sm text-zinc-600 italic mt-2">No workout data yet</p>
            )}
        </div>
    );
}

export default function ProgressPage() {
    const [anchors, setAnchors] = useState<AnchorProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [chartLoaded, setChartLoaded] = useState(false);

    useEffect(() => {
        // Dynamically import Chart.js
        import("chart.js/auto").then((mod) => {
            Chart = mod.default;
            setChartLoaded(true);
        });

        api.getProgress().then((data) => {
            setAnchors(data);
            setLoading(false);
        });
    }, []);

    return (
        <div>
            <h1 className="text-2xl font-bold tracking-tight mb-6">Anchor Progress</h1>

            {loading ? (
                <div className="flex items-center justify-center h-40 gap-3 text-zinc-500">
                    <div className="w-5 h-5 border-2 border-zinc-600 border-t-red-500 rounded-full animate-spin" />
                    Loading...
                </div>
            ) : anchors.length === 0 ? (
                <div className="text-center py-16 text-zinc-600">
                    <p className="text-lg mb-2">No anchor data yet</p>
                    <p className="text-sm">Log workouts with anchor exercises to see progress here.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {anchors.map((a) => (
                        <AnchorCard key={a.exercise_id} anchor={a} />
                    ))}
                </div>
            )}
        </div>
    );
}
