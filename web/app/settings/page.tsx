"use client";

import { useEffect, useMemo, useState } from "react";
import {
  api,
  type CalendarDay,
  type CreateExercisePayload,
  type ExerciseItem,
  type ManualExercise,
  type ManualWorkoutPayload,
  type ProtectionRule,
  type TrainingType,
  type WeeklyCompareResponse,
  type WorkoutDetail,
} from "@/lib/api";
import { FlameIcon } from "@/components/icons";

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

const TRAINING_TYPE_FILTERS: { value: TrainingType; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "push", label: "Push" },
  { value: "pull", label: "Pull" },
  { value: "legs", label: "Legs" },
  { value: "custom", label: "Custom" },
];

const HISTORY_PREFS_KEY = "gymos:history:prefs";

function readHistoryPrefs(): { mode?: "summary" | "detail"; trainingType?: TrainingType; selectedDate?: string } {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(HISTORY_PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as {
      mode?: "summary" | "detail";
      trainingType?: TrainingType;
      selectedDate?: string;
    };
    return parsed;
  } catch {
    return {};
  }
}

function writeHistoryPrefs(prefs: {
  mode: "summary" | "detail";
  trainingType: TrainingType;
  selectedDate: string;
}) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HISTORY_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    return;
  }
}

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
                    <button onClick={() => removeExercise(i)} className="ml-2 text-zinc-500 text-xl">
                      x
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
                          <option value="unknown">unknown</option>
                          {MUSCLE_FILTERS.filter((m) => m !== "all").map((m) => <option key={m} value={m}>{m}</option>)}
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

function localDateFromKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function dayDiff(a: Date, b: Date) {
  const ms = 1000 * 60 * 60 * 24;
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ua - ub) / ms);
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(year, month, 1)
  );
}

function buildMonthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const lead = first.getDay();
  const cells: (Date | null)[] = [];

  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let day = 1; day <= totalDays; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function calendarDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function computeStreaks(workoutKeys: string[], today: Date) {
  const dates = [...new Set(workoutKeys)].sort().map(localDateFromKey);
  if (dates.length === 0) {
    return { current: 0, longest: 0 };
  }

  let current = 0;
  const last = dates[dates.length - 1];
  if (dayDiff(today, last) <= 2) {
    current = 1;
    for (let i = dates.length - 1; i > 0; i -= 1) {
      const gap = dayDiff(dates[i], dates[i - 1]);
      if (gap <= 3) current += 1;
      else break;
    }
  }

  let run = 1;
  let longest = 1;
  for (let i = 1; i < dates.length; i += 1) {
    const gap = dayDiff(dates[i], dates[i - 1]);
    if (gap <= 3) run += 1;
    else run = 1;
    if (run > longest) longest = run;
  }

  return { current, longest };
}

function StreakTab() {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<CalendarDay[]>([]);

  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const seasonStart = useMemo(() => new Date(today.getFullYear(), 0, 1), [today]);
  const seasonEnd = useMemo(() => new Date(today.getFullYear(), today.getMonth() + 1, 0), [today]);

  useEffect(() => {
    api
      .getCalendar(calendarDateKey(seasonStart), calendarDateKey(seasonEnd))
      .then(setDays)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [seasonStart, seasonEnd]);

  const workoutSet = useMemo(() => {
    const set = new Set<string>();
    for (const day of days) {
      if (day.workouts.length > 0) set.add(day.date);
    }
    return set;
  }, [days]);

  const streak = useMemo(() => computeStreaks([...workoutSet], today), [workoutSet, today]);

  const months = useMemo(() => {
    const result: { key: string; label: string; cells: (Date | null)[] }[] = [];
    for (let month = 0; month <= today.getMonth(); month += 1) {
      result.push({
        key: `${today.getFullYear()}-${month}`,
        label: monthLabel(today.getFullYear(), month),
        cells: buildMonthCells(today.getFullYear(), month),
      });
    }
    return result;
  }, [today]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-500/25 bg-gradient-to-br from-red-600/25 to-red-500/10 p-5">
        <div className="flex items-start justify-between">
          <p className="text-6xl leading-none font-black text-white">{streak.current}</p>
          <FlameIcon className="h-8 w-8 text-red-300" />
        </div>
        <p className="text-base font-semibold mt-2 text-red-100">current streak</p>
        <p className="text-xs text-red-200/80 mt-1">Longest: {streak.longest}</p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
        <h2 className="text-sm font-semibold mb-3">Season Calendar</h2>

        {loading ? (
          <div className="py-10 text-center text-zinc-500 text-sm">Loading season...</div>
        ) : (
          <div className="space-y-4 max-h-[62vh] overflow-y-auto pr-1">
            {months.map((month) => (
              <div key={month.key} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-xs font-semibold text-zinc-300 mb-2">{month.label}</p>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                    <p key={`${month.key}-${day}`} className="text-[10px] text-zinc-500 text-center">
                      {day}
                    </p>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {month.cells.map((cell, idx) => {
                    if (!cell) return <div key={`${month.key}-empty-${idx}`} className="h-8" />;

                    const key = calendarDateKey(cell);
                    const isWorkout = workoutSet.has(key);
                    const isToday = dayDiff(cell, today) === 0;
                    const isFuture = dayDiff(cell, today) > 0;

                    let className = "h-8 w-8 rounded-full flex items-center justify-center text-[11px] border ";
                    let content: string = String(cell.getDate());

                    if (isWorkout && isToday) {
                      className += "bg-red-500 border-red-300 text-red-950 ring-2 ring-red-300/60";
                      content = "•";
                    } else if (isWorkout) {
                      className += "bg-red-500/80 border-red-400 text-red-950";
                      content = "•";
                    } else if (isToday) {
                      className += "bg-zinc-900 border-red-500 text-red-300";
                    } else if (isFuture) {
                      className += "bg-zinc-900 border-zinc-800 text-zinc-600";
                    } else {
                      className += "bg-zinc-800 border-zinc-700 text-zinc-300";
                    }

                    return (
                      <div key={`${month.key}-${key}`} className="flex items-center justify-center">
                        <span className={className}>{content}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UnifiedHistoryTab() {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [mode, setMode] = useState<"summary" | "detail">(() => readHistoryPrefs().mode ?? "summary");
  const [trainingType, setTrainingType] = useState<TrainingType>(() => readHistoryPrefs().trainingType ?? "all");
  const [selectedDate, setSelectedDate] = useState<string>(() => readHistoryPrefs().selectedDate ?? calendarDateKey(new Date()));
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutDetail | null>(null);
  const [weeklyCompare, setWeeklyCompare] = useState<WeeklyCompareResponse | null>(null);
  const [weeklyCompareLoading, setWeeklyCompareLoading] = useState(true);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState("");

  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const seasonStart = useMemo(() => new Date(today.getFullYear(), 0, 1), [today]);
  const seasonEnd = useMemo(() => new Date(today.getFullYear(), today.getMonth() + 1, 0), [today]);

  useEffect(() => {
    api
      .getCalendar(calendarDateKey(seasonStart), calendarDateKey(seasonEnd), trainingType)
      .then((data) => {
        setDays(data);
        const todayKey = calendarDateKey(today);
        const todayEntry = data.find((d) => d.date === todayKey);
        if (!todayEntry || todayEntry.workouts.length === 0) {
          const latest = data.filter((d) => d.workouts.length > 0).slice(-1)[0];
          if (latest) setSelectedDate(latest.date);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [seasonStart, seasonEnd, today, trainingType]);

  useEffect(() => {
    api
      .getWeeklyCompare(calendarDateKey(today), trainingType)
      .then((data) => setWeeklyCompare(data))
      .catch(() => setWeeklyCompare(null))
      .finally(() => setWeeklyCompareLoading(false));
  }, [trainingType, today]);

  useEffect(() => {
    writeHistoryPrefs({ mode, trainingType, selectedDate });
  }, [mode, trainingType, selectedDate]);

  useEffect(() => {
    if (!backfillMessage) return;
    const timer = window.setTimeout(() => setBackfillMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [backfillMessage]);

  const dayByDate = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const d of days) map.set(d.date, d);
    return map;
  }, [days]);

  const selectedDay = dayByDate.get(selectedDate) ?? null;

  const workoutSet = useMemo(() => {
    const set = new Set<string>();
    for (const day of days) {
      if (day.workouts.length > 0) set.add(day.date);
    }
    return set;
  }, [days]);

  const streak = useMemo(() => computeStreaks([...workoutSet], today), [workoutSet, today]);

  const months = useMemo(() => {
    const result: { key: string; label: string; cells: (Date | null)[]; month: number }[] = [];
    for (let month = 0; month <= today.getMonth(); month += 1) {
      result.push({
        key: `${today.getFullYear()}-${month}`,
        label: monthLabel(today.getFullYear(), month),
        cells: buildMonthCells(today.getFullYear(), month),
        month,
      });
    }
    return result;
  }, [today]);

  const monthSessions = useMemo(() => {
    return days.filter((d) => {
      const dt = localDateFromKey(d.date);
      return dt.getMonth() === today.getMonth() && d.workouts.length > 0;
    });
  }, [days, today]);

  const monthVolume = useMemo(
    () => monthSessions.reduce((sum, day) => sum + day.workouts.reduce((n, w) => n + (w.total_volume_lbs || 0), 0), 0),
    [monthSessions]
  );

  const maxDayVolume = useMemo(() => {
    let max = 1;
    for (const d of days) {
      const v = d.workouts.reduce((n, w) => n + (w.total_volume_lbs || 0), 0);
      if (v > max) max = v;
    }
    return max;
  }, [days]);

  const monthTimeline = useMemo(
    () =>
      [...monthSessions]
        .reverse()
        .map((d) => {
          const sets = d.workouts.reduce((n, w) => n + (w.total_sets || 0), 0);
          const volume = d.workouts.reduce((n, w) => n + (w.total_volume_lbs || 0), 0);
          return { date: d.date, sets, volume, workouts: d.workouts };
        }),
    [monthSessions]
  );

  const intensityLegend = useMemo(() => {
    const low = Math.round(maxDayVolume * 0.35);
    const mid = Math.round(maxDayVolume * 0.7);
    return { low, mid };
  }, [maxDayVolume]);

  const formatDelta = (value: number, pct: number | null) => {
    const sign = value > 0 ? "+" : "";
    if (pct === null) return `${sign}${value}`;
    const pctSign = pct > 0 ? "+" : "";
    return `${sign}${value} (${pctSign}${pct.toFixed(1)}%)`;
  };

  async function openWorkout(id: number) {
    const detail = await api.getWorkout(id);
    setSelectedWorkout(detail);
  }

  async function runTrainingTypeBackfill() {
    setBackfillLoading(true);
    setBackfillMessage("");
    try {
      const result = await api.backfillHistoryTrainingType();
      setBackfillMessage(
        `Backfill listo: ${result.updated}/${result.workouts_scanned} sesiones actualizadas`
      );

      const [calendarData, weeklyData] = await Promise.all([
        api.getCalendar(calendarDateKey(seasonStart), calendarDateKey(seasonEnd), trainingType),
        api.getWeeklyCompare(calendarDateKey(today), trainingType),
      ]);
      setDays(calendarData);
      setWeeklyCompare(weeklyData);
    } catch {
      setBackfillMessage("No se pudo ejecutar backfill");
    } finally {
      setBackfillLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <WorkoutModal workout={selectedWorkout} onClose={() => setSelectedWorkout(null)} />

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-[11px] text-zinc-500">Racha</p>
          <p className="text-xl font-bold">{streak.current}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-[11px] text-zinc-500">Sesiones mes</p>
          <p className="text-xl font-bold">{monthSessions.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-[11px] text-zinc-500">Volumen mes</p>
          <p className="text-xl font-bold">{Math.round(monthVolume).toLocaleString()}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-zinc-300">Esta semana vs semana pasada</p>
          <span className="text-[11px] text-zinc-500 uppercase tracking-wide">{trainingType}</span>
        </div>
        {weeklyCompareLoading ? (
          <p className="text-sm text-zinc-500">Calculando comparativa...</p>
        ) : weeklyCompare ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-[11px] text-zinc-500">Sesiones</p>
              <p className="text-lg font-bold text-white">{weeklyCompare.current_week.sessions}</p>
              <p className={`text-xs mt-1 ${weeklyCompare.delta.sessions >= 0 ? "text-red-300" : "text-zinc-400"}`}>
                {formatDelta(weeklyCompare.delta.sessions, weeklyCompare.delta_pct.sessions)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-[11px] text-zinc-500">Sets</p>
              <p className="text-lg font-bold text-white">{weeklyCompare.current_week.sets}</p>
              <p className={`text-xs mt-1 ${weeklyCompare.delta.sets >= 0 ? "text-red-300" : "text-zinc-400"}`}>
                {formatDelta(weeklyCompare.delta.sets, weeklyCompare.delta_pct.sets)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-[11px] text-zinc-500">Volumen</p>
              <p className="text-lg font-bold text-white">{Math.round(weeklyCompare.current_week.volume).toLocaleString()}</p>
              <p className={`text-xs mt-1 ${weeklyCompare.delta.volume >= 0 ? "text-red-300" : "text-zinc-400"}`}>
                {formatDelta(Math.round(weeklyCompare.delta.volume), weeklyCompare.delta_pct.volume)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No se pudo cargar la comparativa semanal.</p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setMode("summary")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold border ${
            mode === "summary"
              ? "bg-red-600/25 text-red-200 border-red-500/40"
              : "bg-zinc-800/60 text-zinc-500 border-zinc-700/50"
          }`}
        >
          Resumen
        </button>
        <button
          onClick={() => setMode("detail")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold border ${
            mode === "detail"
              ? "bg-red-600/25 text-red-200 border-red-500/40"
              : "bg-zinc-800/60 text-zinc-500 border-zinc-700/50"
          }`}
        >
          Detalle
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TRAINING_TYPE_FILTERS.map((item) => (
          <button
            key={item.value}
            onClick={() => {
              setLoading(true);
              setWeeklyCompareLoading(true);
              setTrainingType(item.value);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
              trainingType === item.value
                ? "bg-red-600/25 text-red-200 border-red-500/40"
                : "bg-zinc-800/60 text-zinc-500 border-zinc-700/50"
            }`}
          >
            {item.label}
          </button>
        ))}
        <button
          onClick={() => void runTrainingTypeBackfill()}
          disabled={backfillLoading}
          className="px-3 py-1.5 rounded-full text-xs font-semibold border border-zinc-700/50 bg-zinc-950 text-zinc-300 disabled:opacity-40"
        >
          {backfillLoading ? "Reclasificando..." : "Reclasificar historial"}
        </button>
      </div>

      {backfillMessage ? <p className="text-xs text-zinc-400">{backfillMessage}</p> : null}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
        {loading ? (
          <div className="py-10 text-center text-zinc-500 text-sm">Loading season...</div>
        ) : (
          <div className="space-y-4 max-h-[52vh] overflow-y-auto pr-1">
            {months.map((month) => (
              <div key={month.key} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-xs font-semibold text-zinc-300 mb-2">{month.label}</p>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                    <p key={`${month.key}-${day}`} className="text-[10px] text-zinc-500 text-center">
                      {day}
                    </p>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {month.cells.map((cell, idx) => {
                    if (!cell) return <div key={`${month.key}-empty-${idx}`} className="h-8" />;

                    const key = calendarDateKey(cell);
                    const day = dayByDate.get(key);
                    const dayVolume = day ? day.workouts.reduce((n, w) => n + (w.total_volume_lbs || 0), 0) : 0;
                    const isWorkout = !!day && day.workouts.length > 0;
                    const isToday = dayDiff(cell, today) === 0;
                    const isFuture = dayDiff(cell, today) > 0;
                    const isSelected = selectedDate === key;

                    let className = "h-8 w-8 rounded-full flex items-center justify-center text-[11px] border transition-all ";

                    if (isWorkout) {
                      if (mode === "detail") {
                        const alpha = Math.min(0.9, Math.max(0.25, dayVolume / maxDayVolume));
                        className += `text-red-100 border-red-500/50 bg-red-500/${Math.round(alpha * 100)}`;
                      } else {
                        className += "text-red-950 border-red-400 bg-red-500/90";
                      }
                    } else if (isToday) {
                      className += "bg-zinc-900 border-red-500 text-red-300";
                    } else if (isFuture) {
                      className += "bg-zinc-900 border-zinc-800 text-zinc-600";
                    } else {
                      className += "bg-zinc-800 border-zinc-700 text-zinc-300";
                    }

                    if (isSelected) className += " ring-2 ring-red-300/60";

                    return (
                      <button
                        key={`${month.key}-${key}`}
                        onClick={() => setSelectedDate(key)}
                        className="flex items-center justify-center"
                      >
                        <span className={className}>{cell.getDate()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-zinc-300">{selectedDate}</p>
          {selectedDay?.workouts?.length ? (
            <p className="text-xs text-zinc-500">{selectedDay.workouts.length} sesiones</p>
          ) : null}
        </div>

        {!selectedDay || selectedDay.workouts.length === 0 ? (
          <p className="text-sm text-zinc-600">Sin entrenamiento en este dia.</p>
        ) : (
          <div className="space-y-2">
            {selectedDay.workouts.map((w) => (
              <button
                key={w.id}
                onClick={() => void openWorkout(w.id)}
                className="w-full text-left rounded-xl border border-zinc-800 bg-zinc-950/80 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{w.day_name?.replace(/_/g, " ") || "Workout"}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {w.total_sets} sets · {Math.round(w.total_volume_lbs).toLocaleString()} lbs
                    </p>
                  </div>
                  <span className="text-xs text-zinc-500">{w.duration_min || 0} min</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {mode === "detail" && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-sm font-semibold text-zinc-300 mb-2">Leyenda de intensidad</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg border border-zinc-700 bg-zinc-950/70 p-2 text-zinc-400">
              <p>Baja</p>
              <p className="text-zinc-500">0 - {intensityLegend.low.toLocaleString()} lbs</p>
            </div>
            <div className="rounded-lg border border-zinc-700 bg-zinc-950/70 p-2 text-zinc-300">
              <p>Media</p>
              <p className="text-zinc-500">{(intensityLegend.low + 1).toLocaleString()} - {intensityLegend.mid.toLocaleString()} lbs</p>
            </div>
            <div className="rounded-lg border border-zinc-700 bg-zinc-950/70 p-2 text-red-200">
              <p>Alta</p>
              <p className="text-zinc-500">{(intensityLegend.mid + 1).toLocaleString()}+ lbs</p>
            </div>
          </div>
        </div>
      )}

      {mode === "detail" && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h3 className="text-sm font-semibold mb-3">Timeline del mes</h3>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {monthTimeline.length === 0 ? (
              <p className="text-sm text-zinc-600">Sin sesiones en este mes.</p>
            ) : (
              monthTimeline.map((entry) => (
                <button
                  key={entry.date}
                  onClick={() => setSelectedDate(entry.date)}
                  className="w-full text-left rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-zinc-200">{entry.date}</p>
                    <p className="text-xs text-zinc-500">{entry.sets} sets · {Math.round(entry.volume).toLocaleString()} lbs</p>
                  </div>
                </button>
              ))
            )}
          </div>
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

      <div className="flex flex-wrap gap-1.5 pb-1">
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
        <div className="fixed bottom-24 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 px-5 py-3 bg-zinc-800 border border-zinc-600 rounded-xl shadow-2xl text-sm font-medium text-white text-center break-words">
          {toast}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto overflow-x-hidden">
      <div className="mb-5 rounded-2xl border border-zinc-700/50 bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.16),_transparent_55%)] bg-zinc-900/80 p-5 shadow-[0_0_40px_rgba(239,68,68,0.12)]">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">GymOS</p>
        <h1 className="text-2xl font-bold tracking-tight">Historial</h1>
        <p className="text-sm text-zinc-500 mt-1">Calendario, rachas y detalle en una vista</p>
      </div>

      <div className="animate-in fade-in duration-200">
        <UnifiedHistoryTab />
      </div>
    </div>
  );
}
