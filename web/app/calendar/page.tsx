"use client";

import { useEffect, useMemo, useState } from "react";
import {
  api,
  type CalendarDay,
  type CreateExercisePayload,
  type ExerciseItem,
  type ManualExercise,
  type ManualWorkoutPayload,
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

const MUSCLE_OPTIONS = [
  "unknown",
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
                {ex.sets.map((s, j) => (
                  <span
                    key={j}
                    className="border-l-2 border-l-red-500 bg-zinc-900/70 px-2 py-1 rounded text-sm font-mono text-zinc-300"
                  >
                    {s.weight || 0}lb × {s.reps || 0}
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
  const [library, setLibrary] = useState<ExerciseItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [detailForm, setDetailForm] = useState<CreateExercisePayload>({
    name: "",
    primary_muscle: "unknown",
    type: "unknown",
    movement_pattern: "unknown",
    is_anchor: false,
    is_staple: false,
  });
  const [exercises, setExercises] = useState<ManualExercise[]>([
    { name: "", sets: [{ weight: null, reps: null, rir: null, set_type: "normal" }] },
  ]);

  useEffect(() => {
    api
      .getExercises()
      .then(setLibrary)
      .catch(() => {})
      .finally(() => setLibraryLoading(false));
  }, []);

  const updateExercise = (idx: number, ex: ManualExercise) =>
    setExercises((prev) => prev.map((e, i) => (i === idx ? ex : e)));

  const addExercise = () =>
    setExercises((prev) => [
      ...prev,
      { name: "", sets: [{ weight: null, reps: null, rir: null, set_type: "normal" }] },
    ]);

  const moveExercise = (idx: number, direction: -1 | 1) =>
    setExercises((prev) => {
      const next = idx + direction;
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });

  const removeExercise = (idx: number) =>
    setExercises((prev) => prev.filter((_, i) => i !== idx));

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

  const selectFromLibrary = (idx: number, item: ExerciseItem) => {
    updateExercise(idx, { ...exercises[idx], name: item.name });
  };

  const createQuickExercise = async (idx: number) => {
    const name = exercises[idx].name.trim();
    if (!name) {
      setError("Escribe un nombre para crear el ejercicio.");
      return;
    }
    setCreatingExercise(true);
    setError("");
    try {
      const created = await api.createExercise({ name });
      setLibrary((prev) => [created, ...prev]);
      updateExercise(idx, { ...exercises[idx], name: created.name });
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("409")) {
        const existing = library.find((it) => it.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          updateExercise(idx, { ...exercises[idx], name: existing.name });
          setCreatingExercise(false);
          return;
        }
      }
      setError("No se pudo crear el ejercicio.");
    } finally {
      setCreatingExercise(false);
    }
  };

  const createDetailedExercise = async () => {
    if (detailIndex === null) return;
    const name = detailForm.name?.trim() || exercises[detailIndex].name.trim();
    if (!name) {
      setError("El nombre del ejercicio es obligatorio.");
      return;
    }
    setCreatingExercise(true);
    setError("");
    try {
      const created = await api.createExercise({ ...detailForm, name });
      setLibrary((prev) => [created, ...prev]);
      updateExercise(detailIndex, { ...exercises[detailIndex], name: created.name });
      setDetailIndex(null);
    } catch {
      setError("No se pudo crear el ejercicio con detalles.");
    } finally {
      setCreatingExercise(false);
    }
  };

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
          <button onClick={onClose} className="text-zinc-500 text-2xl">×</button>
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
                placeholder="Bench Press 185x6x3\nLateral Raise 20x12x4"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-3 text-sm text-white"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {exercises.map((ex, i) => (
                <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex gap-1 mr-2">
                      <button onClick={() => moveExercise(i, -1)} className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-500">↑</button>
                      <button onClick={() => moveExercise(i, 1)} className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-500">↓</button>
                    </div>
                    <input
                      value={ex.name}
                      onChange={(e) => updateExercise(i, { ...ex, name: e.target.value })}
                      placeholder="Exercise name"
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
                    />
                    <button
                      onClick={() => removeExercise(i)}
                      className="ml-2 text-zinc-500 text-xl"
                    >
                      ×
                    </button>
                  </div>

                  {ex.name.trim() && (
                    <div className="mb-3 space-y-2">
                      {libraryLoading ? (
                        <p className="text-xs text-zinc-600">Cargando biblioteca...</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {library
                            .filter((it) => it.name.toLowerCase().includes(ex.name.toLowerCase().trim()))
                            .slice(0, 6)
                            .map((it) => (
                              <button
                                key={it.id}
                                onClick={() => selectFromLibrary(i, it)}
                                className="px-2 py-1 rounded-full border border-zinc-700 text-xs text-zinc-400"
                              >
                                {it.name}
                              </button>
                            ))}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => createQuickExercise(i)}
                          disabled={creatingExercise || !ex.name.trim()}
                          className="py-2 rounded-lg bg-red-600 text-white text-xs font-semibold disabled:opacity-40"
                        >
                          Crear rapido
                        </button>
                        <button
                          onClick={() => {
                            setDetailIndex(i);
                            setDetailForm((prev) => ({ ...prev, name: ex.name }));
                          }}
                          className="py-2 rounded-lg border border-zinc-700 text-zinc-300 text-xs font-semibold"
                        >
                          Crear con detalles
                        </button>
                      </div>
                    </div>
                  )}

                  {detailIndex === i && (
                    <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 space-y-2">
                      <input
                        value={detailForm.name || ""}
                        onChange={(e) => setDetailForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Nombre"
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <select value={detailForm.primary_muscle} onChange={(e) => setDetailForm((p) => ({ ...p, primary_muscle: e.target.value }))} className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-2 text-xs text-white">
                          {MUSCLE_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select value={detailForm.type} onChange={(e) => setDetailForm((p) => ({ ...p, type: e.target.value }))} className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-2 text-xs text-white">
                          {EXERCISE_TYPE_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select value={detailForm.movement_pattern} onChange={(e) => setDetailForm((p) => ({ ...p, movement_pattern: e.target.value }))} className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-2 text-xs text-white">
                          {MOVEMENT_PATTERN_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-3 text-xs text-zinc-400">
                        <label className="flex items-center gap-1"><input type="checkbox" checked={Boolean(detailForm.is_anchor)} onChange={(e) => setDetailForm((p) => ({ ...p, is_anchor: e.target.checked }))} /> Anchor</label>
                        <label className="flex items-center gap-1"><input type="checkbox" checked={Boolean(detailForm.is_staple)} onChange={(e) => setDetailForm((p) => ({ ...p, is_staple: e.target.checked }))} /> Staple</label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setDetailIndex(null)} className="py-2 rounded-lg border border-zinc-700 text-zinc-400 text-xs">Cancelar</button>
                        <button onClick={createDetailedExercise} disabled={creatingExercise} className="py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs disabled:opacity-40">Guardar</button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {ex.sets.map((s, si) => (
                      <div key={si} className="grid grid-cols-4 gap-2">
                        <input
                          type="number"
                          placeholder="lb"
                          value={s.weight ?? ""}
                          onChange={(e) => {
                            const val = e.target.value ? parseFloat(e.target.value) : null;
                            const sets = ex.sets.map((ss, idx) => (idx === si ? { ...ss, weight: val } : ss));
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
                          −
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

          {error && <p className="text-xs text-red-400">Error: {error}</p>}

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

export default function CalendarPage() {
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
    <div className="max-w-2xl mx-auto overflow-x-hidden">
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

      <div className="mb-6 rounded-2xl border border-zinc-700/50 bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.16),_transparent_55%)] bg-zinc-900/80 p-5 shadow-[0_0_40px_rgba(239,68,68,0.14)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">GymOS</p>
            <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
            <p className="text-sm text-zinc-500 mt-1">
              {formatLabel(weekStart)} – {formatLabel(weekEnd)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setReference(addDays(weekStart, -7))}
              className="px-3 py-2 rounded-lg border border-zinc-700 text-zinc-400"
            >
              ◀
            </button>
            <button
              onClick={() => setReference(new Date())}
              className="px-3 py-2 rounded-lg border border-zinc-700 text-zinc-400"
            >
              Today
            </button>
            <button
              onClick={() => setReference(addDays(weekStart, 7))}
              className="px-3 py-2 rounded-lg border border-zinc-700 text-zinc-400"
            >
              ▶
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="text-xs text-zinc-500">Sesiones</p>
            <p className="text-xl font-bold text-white">{weekTotals.sessions}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="text-xs text-zinc-500">Sets</p>
            <p className="text-xl font-bold text-white">{weekTotals.sets}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="text-xs text-zinc-500">Volumen</p>
            <p className="text-xl font-bold text-white">
              {Math.round(weekTotals.volume).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 gap-3 text-zinc-500">
          <div className="w-5 h-5 border-2 border-zinc-600 border-t-red-500 rounded-full animate-spin" />
          Loading...
        </div>
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
                      {dayTotalSets} sets · {Math.round(dayTotalVolume).toLocaleString()} lbs
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
                              {w.total_sets} sets · {Math.round(w.total_volume_lbs).toLocaleString()} lbs
                            </p>
                          </div>
                          {w.duration_min && (
                            <span className="text-xs text-zinc-500">{w.duration_min} min</span>
                          )}
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
