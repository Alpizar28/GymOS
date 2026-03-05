"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  api,
  type ExerciseItem,
  type RoutineDetail,
  type RoutineExerciseTemplate,
  type RoutineSetTemplate,
} from "@/lib/api";
import { TrashIcon } from "@/components/icons";

const SET_TYPE_OPTIONS = [
  { value: "warmup", label: "W" },
  { value: "approach", label: "A" },
  { value: "working", label: "E" },
] as const;

function normalizeSetType(setType: string) {
  if (setType === "normal") return "working";
  return setType;
}

function setLabel(sets: RoutineSetTemplate[], index: number) {
  const setType = normalizeSetType(sets[index]?.set_type || "working");
  if (setType === "warmup") return "W";
  if (setType === "approach") return "A";
  let workingIndex = 0;
  for (let i = 0; i <= index; i += 1) {
    if (normalizeSetType(sets[i]?.set_type || "working") === "working") {
      workingIndex += 1;
    }
  }
  return `E${workingIndex}`;
}

export default function RoutineDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const routineId = Number(params.id);

  const [routine, setRoutine] = useState<RoutineDetail | null>(null);
  const [draft, setDraft] = useState<RoutineDetail | null>(null);
  const [library, setLibrary] = useState<ExerciseItem[]>([]);
  const [selectedExerciseName, setSelectedExerciseName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [toast, setToast] = useState("");

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  async function load() {
    setLoading(true);
    try {
      const [detail, exercises] = await Promise.all([
        api.getRoutine(routineId),
        api.getExercises(),
      ]);
      setRoutine(detail);
      setDraft(detail);
      setLibrary(exercises);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!Number.isFinite(routineId)) return;
    void load();
  }, [routineId]);

  const muscles = useMemo(() => draft?.muscles ?? [], [draft]);

  function updateSet(exIdx: number, setIdx: number, next: Partial<RoutineSetTemplate>) {
    if (!draft) return;
    const exercises = draft.exercises.map((ex, i) => {
      if (i !== exIdx) return ex;
      return {
        ...ex,
        sets: ex.sets.map((set, j) => (j === setIdx ? { ...set, ...next } : set)),
      };
    });
    setDraft({ ...draft, exercises });
  }

  function moveExercise(idx: number, direction: -1 | 1) {
    if (!draft) return;
    const next = idx + direction;
    if (next < 0 || next >= draft.exercises.length) return;
    const exercises = [...draft.exercises];
    [exercises[idx], exercises[next]] = [exercises[next], exercises[idx]];
    setDraft({ ...draft, exercises });
  }

  function addSet(exIdx: number, type: "warmup" | "approach" | "working") {
    if (!draft) return;
    const exercises = draft.exercises.map((ex, i) => {
      if (i !== exIdx) return ex;
      return {
        ...ex,
        sets: [
          ...ex.sets,
          {
            set_index: ex.sets.length,
            set_type: type,
            target_weight_lbs: null,
            target_reps: type === "warmup" ? 10 : 8,
            rir_target: type === "warmup" ? 4 : type === "approach" ? 3 : 2,
          },
        ],
      };
    });
    setDraft({ ...draft, exercises });
  }

  function removeSet(exIdx: number, setIdx: number) {
    if (!draft) return;
    const exercises = draft.exercises.map((ex, i) => {
      if (i !== exIdx) return ex;
      const nextSets = ex.sets
        .filter((_, j) => j !== setIdx)
        .map((set, j) => ({ ...set, set_index: j }));
      return { ...ex, sets: nextSets };
    });
    setDraft({ ...draft, exercises });
  }

  function moveSet(exIdx: number, setIdx: number, direction: -1 | 1) {
    if (!draft) return;
    const exercises = draft.exercises.map((ex, i) => {
      if (i !== exIdx) return ex;
      const nextIdx = setIdx + direction;
      if (nextIdx < 0 || nextIdx >= ex.sets.length) return ex;
      const sets = [...ex.sets];
      [sets[setIdx], sets[nextIdx]] = [sets[nextIdx], sets[setIdx]];
      return {
        ...ex,
        sets: sets.map((set, idx) => ({ ...set, set_index: idx })),
      };
    });
    setDraft({ ...draft, exercises });
  }

  function copyFromPreviousSet(exIdx: number, setIdx: number) {
    if (!draft || setIdx === 0) return;
    const exercises = draft.exercises.map((ex, i) => {
      if (i !== exIdx) return ex;
      const previous = ex.sets[setIdx - 1];
      if (!previous) return ex;
      const sets = ex.sets.map((set, idx) => {
        if (idx !== setIdx) return set;
        return {
          ...set,
          target_weight_lbs: previous.target_weight_lbs,
          target_reps: previous.target_reps,
          rir_target: previous.rir_target,
        };
      });
      return { ...ex, sets };
    });
    setDraft({ ...draft, exercises });
  }

  function removeExercise(exIdx: number) {
    if (!draft) return;
    const exercises = draft.exercises.filter((_, i) => i !== exIdx);
    setDraft({ ...draft, exercises });
  }

  function addExercise() {
    if (!draft || !selectedExerciseName) return;
    const item = library.find((ex) => ex.name === selectedExerciseName);
    if (!item) return;

    const nextExercise: RoutineExerciseTemplate = {
      name: item.name,
      exercise_id: item.id,
      rest_seconds: 90,
      notes: null,
      primary_muscle: item.primary_muscle,
      is_anchor: item.is_anchor,
      sets: [
        {
          set_index: 0,
          set_type: "normal",
          target_weight_lbs: null,
          target_reps: 8,
          rir_target: 2,
        },
      ],
    };

    setDraft({ ...draft, exercises: [...draft.exercises, nextExercise] });
    setSelectedExerciseName("");
  }

  async function startRoutine() {
    setStarting(true);
    try {
      await api.startRoutine(routineId);
      router.push("/today");
    } finally {
      setStarting(false);
    }
  }

  async function shareRoutine() {
    const data = await api.shareRoutine(routineId);
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    showToast("JSON copiado al portapapeles");
  }

  async function saveRoutine() {
    if (!draft) return;
    setSaving(true);
    try {
      const payload = {
        name: draft.name,
        subtitle: draft.subtitle,
        notes: draft.notes,
        exercises: draft.exercises.map((ex) => ({
          name: ex.name,
          exercise_id: ex.exercise_id,
          rest_seconds: ex.rest_seconds,
          notes: ex.notes,
          sets: ex.sets.map((set) => ({
            set_type: normalizeSetType(set.set_type),
            target_weight_lbs: set.target_weight_lbs,
            target_reps: set.target_reps,
            rir_target: set.rir_target,
          })),
        })),
      };
      const updated = await api.updateRoutine(routineId, payload);
      setRoutine(updated);
      setDraft(updated);
      setEditMode(false);
      showToast("Rutina guardada");
    } catch {
      showToast("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !draft) {
    return <div className="text-sm text-zinc-500 py-10 text-center">Cargando rutina...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto overflow-x-hidden">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.push("/routines")} className="w-10 h-10 rounded-full border border-zinc-800">
          ←
        </button>
        <h1 className="text-xl font-bold truncate px-3">{draft.name}</h1>
        <button onClick={() => void load()} className="w-10 h-10 rounded-full border border-zinc-800">
          ⟳
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 mb-4">
        <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Overview</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-center text-xs text-zinc-500">Body Front</div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-center text-xs text-zinc-500">Body Back</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {muscles.length > 0 ? (
            muscles.map((muscle) => (
              <span key={muscle} className="px-2 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-200 text-xs">
                {muscle}
              </span>
            ))
          ) : (
            <span className="text-xs text-zinc-600">Sin grupos musculares detectados.</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
        <button
          onClick={() => void startRoutine()}
          disabled={starting}
          className="py-3 rounded-xl bg-red-600 text-white text-sm font-bold disabled:opacity-40"
        >
          {starting ? "Iniciando..." : "Start Routine"}
        </button>
        <button
          onClick={() => setEditMode((v) => !v)}
          className="py-3 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-semibold"
        >
          Edit Routine
        </button>
        <button
          onClick={() => void shareRoutine()}
          className="py-3 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-semibold"
        >
          Share Routine
        </button>
      </div>

      {editMode && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3 mb-4 space-y-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 min-w-0">
            <select
              value={selectedExerciseName}
              onChange={(e) => setSelectedExerciseName(e.target.value)}
              className="min-w-0 w-full px-3 py-2.5 rounded-lg bg-zinc-950 border border-zinc-700 text-sm"
            >
              <option value="">Agregar ejercicio desde biblioteca...</option>
              {library.map((ex) => (
                <option key={ex.id} value={ex.name}>
                  {ex.name}
                </option>
              ))}
            </select>
            <button
              onClick={addExercise}
              disabled={!selectedExerciseName}
              className="px-3 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-40"
            >
              + Add
            </button>
          </div>
          <button
            onClick={() => void saveRoutine()}
            disabled={saving}
            className="w-full py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm font-semibold disabled:opacity-40"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-400">Workout Content</h2>
        {draft.exercises.map((exercise, exIdx) => (
          <div key={`${exercise.name}-${exIdx}`} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-sm">{exercise.name}</p>
              {editMode && (
                <div className="flex gap-1">
                  <button onClick={() => moveExercise(exIdx, -1)} className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-400">↑</button>
                  <button onClick={() => moveExercise(exIdx, 1)} className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-400">↓</button>
                  <button onClick={() => removeExercise(exIdx)} className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-400">×</button>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <div className="grid grid-cols-5 gap-2 px-3 py-2 bg-zinc-950 text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">
                <span>Set</span>
                <span>Prev</span>
                <span>LBS</span>
                <span>Reps</span>
                <span>RIR</span>
              </div>
              {exercise.sets.map((set, setIdx) => (
                <div key={setIdx} className="grid grid-cols-5 gap-2 px-3 py-2 border-t border-zinc-800 text-sm items-center">
                  <span className="font-mono text-zinc-300">{setLabel(exercise.sets, setIdx)}</span>
                  <span className="text-zinc-600">-</span>
                  {editMode ? (
                    <input
                      type="number"
                      value={set.target_weight_lbs ?? ""}
                      onChange={(e) =>
                        updateSet(exIdx, setIdx, {
                          target_weight_lbs: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-sm"
                    />
                  ) : (
                    <span>{set.target_weight_lbs ?? "-"}</span>
                  )}
                  {editMode ? (
                    <input
                      type="number"
                      value={set.target_reps ?? ""}
                      onChange={(e) =>
                        updateSet(exIdx, setIdx, {
                          target_reps: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-sm"
                    />
                  ) : (
                    <span>{set.target_reps ?? "-"}</span>
                  )}
                  {editMode ? (
                    <input
                      type="number"
                      value={set.rir_target ?? ""}
                      onChange={(e) =>
                        updateSet(exIdx, setIdx, {
                          rir_target: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-sm"
                    />
                  ) : (
                    <span>{set.rir_target ?? "-"}</span>
                  )}
                  {editMode && (
                    <div className="col-span-5 flex items-center justify-between mt-1 gap-2">
                      <select
                        value={normalizeSetType(set.set_type)}
                        onChange={(e) =>
                          updateSet(exIdx, setIdx, {
                            set_type: e.target.value,
                          })
                        }
                        className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-xs"
                      >
                        {SET_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyFromPreviousSet(exIdx, setIdx)}
                          disabled={setIdx === 0}
                          className="px-2 py-1 rounded bg-zinc-800 text-zinc-400 text-xs disabled:opacity-30"
                        >
                          ⧉
                        </button>
                        <button
                          onClick={() => moveSet(exIdx, setIdx, -1)}
                          disabled={setIdx === 0}
                          className="px-2 py-1 rounded bg-zinc-800 text-zinc-400 text-xs disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveSet(exIdx, setIdx, 1)}
                          disabled={setIdx === exercise.sets.length - 1}
                          className="px-2 py-1 rounded bg-zinc-800 text-zinc-400 text-xs disabled:opacity-30"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => removeSet(exIdx, setIdx)}
                          className="px-2 py-1 rounded bg-zinc-800 text-zinc-400 text-xs"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {editMode && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                <button
                  onClick={() => addSet(exIdx, "warmup")}
                  className="py-2 text-xs rounded-lg border border-dashed border-zinc-700 text-zinc-400"
                >
                  + W
                </button>
                <button
                  onClick={() => addSet(exIdx, "approach")}
                  className="py-2 text-xs rounded-lg border border-dashed border-zinc-700 text-zinc-400"
                >
                  + A
                </button>
                <button
                  onClick={() => addSet(exIdx, "working")}
                  className="py-2 text-xs rounded-lg border border-dashed border-zinc-700 text-zinc-400"
                >
                  + E
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {toast && (
        <div className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:w-auto z-50 px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-white text-center">
          {toast}
        </div>
      )}
    </div>
  );
}
