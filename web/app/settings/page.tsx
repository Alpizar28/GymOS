"use client";

import { useEffect, useMemo, useState } from "react";
import {
  api,
  type CalendarDay,
  type ExerciseItem,
  type ManualExercise,
  type ManualWorkoutPayload,
  type ProtectionRule,
  type WorkoutDetail,
} from "@/lib/api";

const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const QUICK_TEMPLATES = [
  "Pecho_Hombro_Tricep",
  "Espalda_Biceps",
  "Pierna",
  "Brazo",
  "Pecho_Espalda",
  "Cuadriceps",
  "Femorales_Nalga",
];

const MUSCLE_FILTERS = [
  "all",
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
] as const;

const MUSCLE_LABEL: Record<string, string> = {
  all: "Todos",
  chest: "Pecho",
  lats: "Dorsales",
  upper_back: "Espalda",
  biceps: "Biceps",
  triceps: "Triceps",
  front_delts: "Deltoides front.",
  side_delts: "Deltoides lat.",
  rear_delts: "Deltoides post.",
  quads: "Cuadriceps",
  hamstrings: "Femorales",
  glutes: "Gluteos",
  calves: "Gemelos",
  core: "Core",
};

const MUSCLE_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
];

function formatDayName(name: string) {
  const map: Record<string, string> = {
    Pecho_Hombro_Tricep: "Pecho + Hombro + Tricep",
    Espalda_Biceps: "Espalda + Biceps",
    Pierna: "Pierna",
    Brazo: "Brazo",
    Pecho_Espalda: "Pecho + Espalda",
    Cuadriceps: "Cuadriceps",
    Femorales_Nalga: "Femorales + Nalga",
  };
  return map[name] ?? name.replace(/_/g, " ");
}

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, days: number) {
  const date = new Date(d);
  date.setDate(date.getDate() + days);
  return date;
}

function formatISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatLabel(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-20 gap-2 text-zinc-500 text-sm">
      <div className="w-4 h-4 border-2 border-zinc-600 border-t-red-500 rounded-full animate-spin" />
      Cargando...
    </div>
  );
}

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
            x
          </button>
        </div>

        {workout.notes && <p className="text-sm text-zinc-400 mb-4 italic">{workout.notes}</p>}

        <div className="space-y-4">
          {workout.exercises.map((ex, i) => (
            <div key={i} className="bg-zinc-800/60 border border-zinc-700/40 rounded-lg p-3">
              <p className="font-semibold mb-2">{ex.name}</p>
              <div className="flex flex-wrap gap-2">
                {ex.sets.map((s, j) => (
                  <span
                    key={j}
                    className="border-l-2 border-l-red-500 bg-zinc-900/70 px-2 py-1 rounded text-sm font-mono text-zinc-300"
                  >
                    {s.weight || 0}lb x {s.reps || 0}
                    {s.rir !== null && <span className="text-zinc-500"> RIR{s.rir}</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ManualWorkoutModal({
  date,
  onClose,
  onSaved,
}: {
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<"text" | "form">("text");
  const [dayName, setDayName] = useState("");
  const [notes, setNotes] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [exercises, setExercises] = useState<ManualExercise[]>([
    { name: "", sets: [{ weight: null, reps: null, rir: null, set_type: "normal" }] },
  ]);

  const updateExercise = (idx: number, ex: ManualExercise) =>
    setExercises((prev) => prev.map((e, i) => (i === idx ? ex : e)));

  const addExercise = () =>
    setExercises((prev) => [
      ...prev,
      { name: "", sets: [{ weight: null, reps: null, rir: null, set_type: "normal" }] },
    ]);

  const removeExercise = (idx: number) => setExercises((prev) => prev.filter((_, i) => i !== idx));

  const addSet = (idx: number) =>
    updateExercise(idx, {
      ...exercises[idx],
      sets: [...exercises[idx].sets, { weight: null, reps: null, rir: null, set_type: "normal" }],
    });

  const removeSet = (idx: number, si: number) =>
    updateExercise(idx, {
      ...exercises[idx],
      sets: exercises[idx].sets.filter((_, i) => i !== si),
    });

  async function save() {
    setSaving(true);
    setError("");
    try {
      const payload: ManualWorkoutPayload = {
        date,
        day_name: dayName.trim() || null,
        notes: notes.trim() || null,
      };

      if (tab === "text") {
        if (!text.trim()) {
          setError("Agrega al menos una linea de entrenamiento.");
          setSaving(false);
          return;
        }
        payload.text = text.trim();
      } else {
        const cleaned = exercises
          .filter((ex) => ex.name.trim())
          .map((ex) => ({
            name: ex.name.trim(),
            sets: ex.sets
              .filter((s) => s.weight !== null && s.reps !== null)
              .map((s) => ({
                weight: s.weight,
                reps: s.reps,
                rir: s.rir,
                set_type: s.set_type,
              })),
          }));

        if (cleaned.length === 0) {
          setError("Agrega al menos un ejercicio con sets.");
          setSaving(false);
          return;
        }
        payload.exercises = cleaned;
      }

      await api.createManualWorkout(payload);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save workout");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full sm:max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <p className="text-xs text-zinc-500">Agregar entrenamiento</p>
            <h2 className="text-lg font-bold">{date}</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 text-2xl">
            x
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            {QUICK_TEMPLATES.map((t) => (
              <button
                key={t}
                onClick={() => setDayName(t)}
                className="px-3 py-2 rounded-full text-xs font-semibold border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500"
              >
                {formatDayName(t)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-2">Dia</label>
              <input
                value={dayName}
                onChange={(e) => setDayName(e.target.value)}
                placeholder="Ej: Brazo"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-2">Notas</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opcional"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setTab("text")}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border ${
                tab === "text"
                  ? "bg-red-600/30 text-red-200 border-red-500/40"
                  : "bg-zinc-800 text-zinc-500 border-zinc-700/60"
              }`}
            >
              Texto
            </button>
            <button
              onClick={() => setTab("form")}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border ${
                tab === "form"
                  ? "bg-red-600/30 text-red-200 border-red-500/40"
                  : "bg-zinc-800 text-zinc-500 border-zinc-700/60"
              }`}
            >
              Formulario
            </button>
          </div>

          {tab === "text" ? (
            <div>
              <label className="block text-xs text-zinc-500 mb-2">Formato libre</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                placeholder={"Bench Press 185x6x3\nLateral Raise 20x12x4"}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-3 text-sm text-white"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {exercises.map((ex, i) => (
                <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <input
                      value={ex.name}
                      onChange={(e) => updateExercise(i, { ...ex, name: e.target.value })}
                      placeholder="Exercise name"
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
                    />
                    <button onClick={() => removeExercise(i)} className="ml-2 text-zinc-500 text-xl">
                      x
                    </button>
                  </div>
                  <div className="space-y-2">
                    {ex.sets.map((s, si) => (
                      <div key={si} className="grid grid-cols-4 gap-2">
                        <input
                          type="number"
                          placeholder="lb"
                          value={s.weight ?? ""}
                          onChange={(e) => {
                            const val = e.target.value ? parseFloat(e.target.value) : null;
                            const sets = ex.sets.map((ss, idx) =>
                              idx === si ? { ...ss, weight: val } : ss
                            );
                            updateExercise(i, { ...ex, sets });
                          }}
                          className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-xs text-white text-center"
                        />
                        <input
                          type="number"
                          placeholder="reps"
                          value={s.reps ?? ""}
                          onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value, 10) : null;
                            const sets = ex.sets.map((ss, idx) => (idx === si ? { ...ss, reps: val } : ss));
                            updateExercise(i, { ...ex, sets });
                          }}
                          className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-xs text-white text-center"
                        />
                        <input
                          type="number"
                          placeholder="RIR"
                          value={s.rir ?? ""}
                          onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value, 10) : null;
                            const sets = ex.sets.map((ss, idx) => (idx === si ? { ...ss, rir: val } : ss));
                            updateExercise(i, { ...ex, sets });
                          }}
                          className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-xs text-white text-center"
                        />
                        <button
                          onClick={() => removeSet(i, si)}
                          className="bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-500"
                        >
                          -
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => addSet(i)}
                    className="mt-3 w-full py-2 text-xs rounded-lg border border-dashed border-zinc-700 text-zinc-500"
                  >
                    + Add set
                  </button>
                </div>
              ))}
              <button
                onClick={addExercise}
                className="w-full py-2.5 rounded-xl border border-dashed border-zinc-700 text-zinc-500 text-sm"
              >
                + Add exercise
              </button>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            onClick={save}
            disabled={saving}
            className="w-full py-3.5 bg-gradient-to-r from-red-600 to-red-500 text-white font-bold rounded-xl"
          >
            {saving ? "Saving..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CalendarTab() {
  const [reference, setReference] = useState(() => new Date());
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutDetail | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const weekStart = useMemo(() => startOfWeek(reference), [reference]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  async function load() {
    setLoading(true);
    const from = formatISO(weekStart);
    const to = formatISO(weekEnd);
    try {
      const data = await api.getCalendar(from, to);
      setDays(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [weekStart.toISOString()]);

  async function openWorkout(id: number) {
    const detail = await api.getWorkout(id);
    setSelectedWorkout(detail);
  }

  const weekTotals = useMemo(() => {
    const totals = days.reduce(
      (acc, day) => {
        const daySets = day.workouts.reduce((n, w) => n + (w.total_sets || 0), 0);
        const dayVolume = day.workouts.reduce((n, w) => n + (w.total_volume_lbs || 0), 0);
        acc.sets += daySets;
        acc.volume += dayVolume;
        acc.sessions += day.workouts.length;
        acc.dayTotals.push({ sets: daySets, volume: dayVolume });
        return acc;
      },
      { sets: 0, volume: 0, sessions: 0, dayTotals: [] as { sets: number; volume: number }[] }
    );
    const maxVolume = Math.max(1, ...totals.dayTotals.map((d) => d.volume));
    return { ...totals, maxVolume };
  }, [days]);

  return (
    <div>
      <WorkoutModal workout={selectedWorkout} onClose={() => setSelectedWorkout(null)} />
      {selectedDay && (
        <ManualWorkoutModal
          date={selectedDay}
          onClose={() => setSelectedDay(null)}
          onSaved={() => {
            setSelectedDay(null);
            load();
          }}
        />
      )}

      <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900/70 p-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-zinc-400">
            {formatLabel(weekStart)} - {formatLabel(weekEnd)}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setReference(addDays(weekStart, -7))}
              className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400"
            >
              ◀
            </button>
            <button
              onClick={() => setReference(new Date())}
              className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400"
            >
              Hoy
            </button>
            <button
              onClick={() => setReference(addDays(weekStart, 7))}
              className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400"
            >
              ▶
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="text-xs text-zinc-500">Sesiones</p>
            <p className="text-lg font-bold text-white">{weekTotals.sessions}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="text-xs text-zinc-500">Sets</p>
            <p className="text-lg font-bold text-white">{weekTotals.sets}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="text-xs text-zinc-500">Volumen</p>
            <p className="text-lg font-bold text-white">{Math.round(weekTotals.volume).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {days.map((day, i) => {
            const dayTotalVolume = day.workouts.reduce((n, w) => n + (w.total_volume_lbs || 0), 0);
            const dayTotalSets = day.workouts.reduce((n, w) => n + (w.total_sets || 0), 0);
            const pct = Math.min(100, Math.round((dayTotalVolume / weekTotals.maxVolume) * 100));

            return (
              <div key={day.date} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-zinc-500">{WEEKDAY[i]}</p>
                    <p className="text-lg font-semibold">{day.date}</p>
                    <p className="text-xs text-zinc-600">
                      {dayTotalSets} sets - {Math.round(dayTotalVolume).toLocaleString()} lbs
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedDay(day.date)}
                    className="px-3 py-2 text-xs rounded-lg border border-zinc-700 text-zinc-400"
                  >
                    + Add
                  </button>
                </div>

                <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {day.workouts.length === 0 ? (
                  <p className="text-sm text-zinc-600">No workout logged</p>
                ) : (
                  <div className="space-y-2">
                    {day.workouts.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => openWorkout(w.id)}
                        className="w-full text-left rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-3"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-zinc-200">
                              {w.day_name?.replace(/_/g, " ") || "Workout"}
                            </p>
                            <p className="text-xs text-zinc-600">
                              {w.total_sets} sets - {Math.round(w.total_volume_lbs).toLocaleString()} lbs
                            </p>
                          </div>
                          {w.duration_min && <span className="text-xs text-zinc-500">{w.duration_min} min</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LibraryTab() {
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState<string>("all");
  const [anchorOnly, setAnchorOnly] = useState(false);

  useEffect(() => {
    api.getExercises().then(setExercises).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () =>
      exercises.filter((ex) => {
        if (anchorOnly && !ex.is_anchor) return false;
        if (muscle !== "all" && ex.primary_muscle !== muscle) return false;
        if (search) {
          const q = search.toLowerCase();
          return ex.name.toLowerCase().includes(q) || ex.primary_muscle.toLowerCase().includes(q);
        }
        return true;
      }),
    [exercises, search, muscle, anchorOnly]
  );

  if (loading) return <Spinner />;

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Buscar ejercicio..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all"
      />

      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {MUSCLE_FILTERS.map((m) => (
          <button
            key={m}
            onClick={() => setMuscle(m)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              muscle === m
                ? "bg-red-600/30 text-red-200 border-red-500/50"
                : "bg-zinc-800/60 text-zinc-500 border-zinc-700/50"
            }`}
          >
            {MUSCLE_LABEL[m] ?? m}
          </button>
        ))}
      </div>

      <button
        onClick={() => setAnchorOnly((v) => !v)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
          anchorOnly
            ? "bg-red-500/20 text-red-300 border-red-500/40"
            : "bg-zinc-800/60 text-zinc-500 border-zinc-700/50"
        }`}
      >
        Solo Anchors
      </button>

      <p className="text-xs text-zinc-600">{filtered.length} ejercicios</p>

      <div className="space-y-2">
        {filtered.map((ex) => (
          <div
            key={ex.id}
            className="bg-zinc-800/50 border border-zinc-700/40 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm truncate">{ex.name}</span>
                {ex.is_anchor && (
                  <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                    ANCHOR
                  </span>
                )}
                {ex.is_staple && (
                  <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                    STAPLE
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                {ex.primary_muscle} - {ex.type} - {ex.movement_pattern}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-mono font-semibold text-zinc-200">
                {ex.avg_weight.toFixed(0)}
                <span className="text-zinc-500 text-xs">lb</span>
              </p>
              <p className="text-xs text-zinc-600">max {ex.max_weight.toFixed(0)}lb</p>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-zinc-600 text-center py-6">Sin resultados.</p>}
      </div>
    </div>
  );
}

function ProtectionTab() {
  const [protections, setProtections] = useState<ProtectionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [muscle, setMuscle] = useState("chest");
  const [severity, setSeverity] = useState(5);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const load = () => {
    api
      .getProtections()
      .then(setProtections)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  async function handleAdd() {
    setAdding(true);
    try {
      await api.addProtection(muscle, severity);
      load();
      showToast(`Proteccion activada para ${muscle}`);
    } catch {
      showToast("No se pudo agregar proteccion");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(muscleGroup: string) {
    try {
      await api.removeProtection(muscleGroup);
      setProtections((prev) => prev.filter((p) => p.muscle_group !== muscleGroup));
      showToast(`Proteccion removida para ${muscleGroup}`);
    } catch {
      showToast("No se pudo remover proteccion");
    }
  }

  const severityLabel =
    severity >= 9
      ? "Extremo"
      : severity >= 7
        ? "Alto"
        : severity >= 5
          ? "Medio"
          : severity >= 3
            ? "Bajo"
            : "Minimo";

  return (
    <div className="space-y-4">
      {loading ? (
        <Spinner />
      ) : protections.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-zinc-600 font-semibold">Activas</p>
          {protections.map((p) => {
            const color =
              p.severity >= 8
                ? "border-red-600/50 bg-red-950/30 text-red-300"
                : p.severity >= 5
                  ? "border-red-600/50 bg-red-950/30 text-red-300"
                  : "border-red-600/50 bg-red-950/30 text-red-300";

            return (
              <div key={p.muscle_group} className={`flex items-center justify-between p-4 rounded-xl border ${color}`}>
                <div>
                  <p className="font-semibold capitalize">{p.muscle_group}</p>
                  <p className="text-xs opacity-70 mt-0.5">
                    Severidad {p.severity}/10 - Volumen x{p.factor} ({Math.round(p.factor * 100)}%)
                  </p>
                </div>
                <button
                  onClick={() => handleRemove(p.muscle_group)}
                  className="px-3 py-1.5 rounded-lg bg-black/20 text-xs hover:bg-red-900/40 hover:text-red-300 transition"
                >
                  Quitar
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-zinc-800 text-zinc-600 text-sm text-center">
          Sin protecciones activas
        </div>
      )}

      <div className="bg-zinc-800/50 border border-zinc-700/40 rounded-xl p-4 space-y-4">
        <p className="text-sm font-semibold text-zinc-300">Agregar proteccion</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wide mb-1.5 block">Musculo</label>
            <select
              value={muscle}
              onChange={(e) => setMuscle(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500 capitalize"
            >
              {MUSCLE_GROUPS.map((m) => (
                <option key={m} value={m} className="capitalize">
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wide mb-1.5 block">
              Severidad: {severity}/10
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={severity}
              onChange={(e) => setSeverity(parseInt(e.target.value, 10))}
              className="w-full accent-red-500 mt-2"
            />
          </div>
        </div>

        <p className="text-xs text-zinc-500 italic">
          {severityLabel} (volumen x{Math.round(Math.max(0.2, 1 - (severity / 10) * 0.8) * 100)}%)
        </p>

        <button
          onClick={handleAdd}
          disabled={adding}
          className="w-full py-2.5 bg-gradient-to-r from-red-600 to-red-500 text-white font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50"
        >
          {adding ? "Agregando..." : `Proteger ${muscle}`}
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-zinc-800 border border-zinc-600 rounded-xl shadow-2xl text-sm font-medium text-white whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  );
}

type TabId = "calendar" | "library" | "protection";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "calendar", label: "Calendario", icon: "🗓️" },
  { id: "library", label: "Biblioteca", icon: "📚" },
  { id: "protection", label: "Proteccion", icon: "🛡️" },
];

export default function SettingsPage() {
  const [active, setActive] = useState<TabId>("calendar");

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-5 rounded-2xl border border-zinc-700/50 bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.16),_transparent_55%)] bg-zinc-900/80 p-5 shadow-[0_0_40px_rgba(239,68,68,0.12)]">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">GymOS</p>
        <h1 className="text-2xl font-bold tracking-tight">Historial</h1>
        <p className="text-sm text-zinc-500 mt-1">Tu calendario, biblioteca y protecciones</p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-5 no-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              active === tab.id
                ? "bg-red-600/25 text-red-200 border-red-500/40"
                : "bg-zinc-800/60 text-zinc-500 border-zinc-700/50 hover:text-zinc-300"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="animate-in fade-in duration-200">
        {active === "calendar" && <CalendarTab />}
        {active === "library" && <LibraryTab />}
        {active === "protection" && <ProtectionTab />}
      </div>
    </div>
  );
}
