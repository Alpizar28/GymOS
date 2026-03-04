"use client";

import { useEffect, useState } from "react";
import { api, type DashboardData, type PlanData, type PlanExercise } from "@/lib/api";

function StatCard({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 border border-zinc-700/50 rounded-xl p-5 card-glow transition-all duration-300">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">{title}</p>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
      <p className="text-sm text-zinc-400 mt-1">{sub}</p>
    </div>
  );
}

function PlanExerciseCard({ exercise }: { exercise: PlanExercise }) {
  return (
    <div className="bg-zinc-800/60 border border-zinc-700/40 rounded-lg p-4 card-glow transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold">
          {exercise.is_anchor ? "🔴" : "⚪"} {exercise.name}
        </span>
        {exercise.is_anchor && (
          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-500/15 text-red-400">
            ANCHOR
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {exercise.sets.map((s, i) => {
          const borderClass =
            s.set_type === "warmup"
              ? "border-l-2 border-l-amber-400"
              : s.set_type === "drop"
                ? "border-l-2 border-l-red-400"
                : "border-l-2 border-l-violet-500";
          return (
            <span
              key={i}
              className={`${borderClass} bg-zinc-900/70 px-2.5 py-1 rounded text-sm font-mono text-zinc-300`}
            >
              {s.weight_lbs}lb × {s.target_reps}
              {s.rir_target !== undefined && s.rir_target !== null && (
                <span className="text-zinc-500"> RIR{s.rir_target}</span>
              )}
              {s.rest_seconds ? (
                <span className="text-zinc-600"> · {s.rest_seconds}s</span>
              ) : null}
            </span>
          );
        })}
      </div>
      {exercise.notes && (
        <p className="text-xs text-zinc-500 italic mt-2">💡 {exercise.notes}</p>
      )}
    </div>
  );
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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatingRec, setGeneratingRec] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getDashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const plan = await api.generateToday();
      // Refresh dashboard
      const fresh = await api.getDashboard();
      setData(fresh);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateRecommended() {
    if (!data?.recommendation?.day_name) return;
    setGeneratingRec(true);
    try {
      await api.generateDay(data.recommendation.day_name);
      const fresh = await api.getDashboard();
      setData(fresh);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGeneratingRec(false);
    }
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-2">⚠️ Connection Error</p>
          <p className="text-zinc-500 text-sm">{error}</p>
          <p className="text-zinc-600 text-xs mt-4">Make sure the API is running on port 8000</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-zinc-500">
        <div className="w-5 h-5 border-2 border-zinc-600 border-t-violet-500 rounded-full animate-spin" />
        Loading...
      </div>
    );
  }

  const plan = data.last_plan;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 rounded-2xl border border-zinc-700/50 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_55%)] bg-zinc-900/80 p-5 shadow-[0_0_40px_rgba(16,185,129,0.12)]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">GymOS</p>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-zinc-500 mt-1">Tu resumen semanal y plan del dia</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {data.recommendation?.day_name && (
              <button
                onClick={handleGenerateRecommended}
                disabled={generatingRec}
                className="px-4 py-2.5 bg-emerald-600/20 text-emerald-300 font-semibold rounded-lg border border-emerald-500/30 hover:bg-emerald-600/30 transition-all duration-200 disabled:opacity-50"
              >
                {generatingRec
                  ? "⏳ Generating..."
                  : `✅ ${formatDayName(data.recommendation.day_name)}`}
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-violet-500/25 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
            >
              {generating ? "⏳ Generating..." : "⚡ Generate Today"}
            </button>
          </div>
        </div>
      </div>

      {data.recommendation?.day_name && (
        <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-sm text-emerald-300 font-semibold">
            Recomendado hoy: {formatDayName(data.recommendation.day_name)}
          </p>
          {data.recommendation.reason && (
            <p className="text-xs text-emerald-200/70 mt-1">{data.recommendation.reason}</p>
          )}
        </div>
      )}

      {/* State Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          title="Next Day"
          value={data.state.next_day_name.replace(/_/g, " ")}
          sub={`Day ${data.state.next_day_index}`}
        />
        <StatCard
          title="Fatigue"
          value={data.state.fatigue_score.toFixed(1)}
          sub="/10"
        />
        <StatCard
          title="Week Sessions"
          value={String(data.weekly_stats.workouts || 0)}
          sub={`${(data.weekly_stats.total_volume_lbs || 0).toLocaleString()} lbs volume`}
        />
      </div>

      {/* Latest Routine */}
      <h2 className="text-lg font-semibold text-zinc-400 mb-4">Latest Routine</h2>
      {plan && plan.exercises ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm text-zinc-500 mb-2">
            <span>🏋️ {plan.day_name?.replace(/_/g, " ")}</span>
            <span>⏱ ~{plan.estimated_duration_min} min</span>
            <span>📊 {plan.total_sets} sets</span>
            {plan.estimated_volume_lbs > 0 && (
              <span>💪 ~{Math.round(plan.estimated_volume_lbs).toLocaleString()} lbs</span>
            )}
          </div>
          {plan.exercises.map((ex, i) => (
            <PlanExerciseCard key={i} exercise={ex} />
          ))}
          {plan.note && (
            <p className="text-sm text-amber-400 mt-2">⚠️ {plan.note}</p>
          )}
        </div>
      ) : (
        <div className="text-center py-16 text-zinc-600">
          <p className="text-lg mb-2">No plan generated yet</p>
          <p className="text-sm">Click &quot;Generate Today&quot; to create your first plan!</p>
        </div>
      )}
    </div>
  );
}
