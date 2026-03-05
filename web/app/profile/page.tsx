"use client";

import { useEffect, useMemo, useState } from "react";
import {
  api,
  type DashboardData,
  type ExerciseItem,
  type DayOption,
  type PersonalProfile,
  type ProtectionRule,
  type CalendarDay,
  type WorkoutDetail,
} from "@/lib/api";

// ─── helpers ──────────────────────────────────────────────────────────────────

function addDays(d: Date, n: number) {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}
function formatISO(d: Date) {
  return d.toISOString().slice(0, 10);
}
function formatDayLabel(name: string) {
  const map: Record<string, string> = {
    Pecho_Hombro_Tricep: "Pecho + Hombro + Tricep",
    Espalda_Biceps: "Espalda + Biceps",
    Pierna: "Pierna",
    Brazo: "Brazo",
    Pecho_Espalda: "Pecho + Espalda",
    Cuadriceps: "Cuadriceps",
    Femorales_Nalga: "Femorales + Nalga",
    Push_Heavy: "Push Heavy",
    Pull_Heavy: "Pull Heavy",
    Quads_Heavy: "Quads Heavy",
    Upper_Complement: "Upper Complement",
    Arms_Shoulders: "Arms & Shoulders",
    Posterior_Heavy: "Posterior Heavy",
  };
  return map[name] ?? name.replace(/_/g, " ");
}

const MUSCLE_GROUPS = [
  "chest", "back", "shoulders", "biceps", "triceps",
  "quads", "hamstrings", "glutes", "calves", "core",
];

const SECTIONS = [
  { id: "personal",   label: "Datos",      icon: "👤" },
  { id: "stats",      label: "Stats",      icon: "📊" },
  { id: "templates",  label: "Plantillas", icon: "📋" },
  { id: "library",    label: "Ejercicios", icon: "📚" },
  { id: "protection", label: "Protección", icon: "🛡️" },
] as const;

type SectionId = typeof SECTIONS[number]["id"];

// ─── sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center h-20 gap-2 text-zinc-500 text-sm">
      <div className="w-4 h-4 border-2 border-zinc-600 border-t-red-500 rounded-full animate-spin" />
      Cargando...
    </div>
  );
}

function PersonalSection() {
  const [data, setData] = useState<PersonalProfile | null>(null);
  const [draft, setDraft] = useState<PersonalProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    api.getPersonalProfile().then((profile) => {
      setData(profile);
      setDraft(profile);
    }).catch(() => {});
  }, []);

  if (!data || !draft) return <Spinner />;

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const updated = await api.updatePersonalProfile({ ...draft });
      setData(updated);
      setDraft(updated);
      setEditing(false);
      setToast("Datos actualizados");
      setTimeout(() => setToast(""), 2000);
    } catch {
      setToast("No se pudo guardar");
      setTimeout(() => setToast(""), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">Información personal</p>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 text-xs"
            >
              Editar
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDraft(data);
                  setEditing(false);
                }}
                className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold disabled:opacity-40"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-zinc-500 block mb-1">Nombre</label>
            {editing ? (
              <input
                value={draft.full_name}
                onChange={(e) => setDraft((prev) => prev ? { ...prev, full_name: e.target.value } : prev)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm"
              />
            ) : (
              <p className="text-sm text-zinc-200">{data.full_name || "-"}</p>
            )}
          </div>

          <div>
            <label className="text-xs text-zinc-500 block mb-1">Edad</label>
            {editing ? (
              <input
                type="number"
                value={draft.age ?? ""}
                onChange={(e) => setDraft((prev) => prev ? { ...prev, age: e.target.value ? Number(e.target.value) : null } : prev)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm"
              />
            ) : (
              <p className="text-sm text-zinc-200">{data.age ?? "-"}</p>
            )}
          </div>

          <div>
            <label className="text-xs text-zinc-500 block mb-1">Estatura (cm)</label>
            {editing ? (
              <input
                type="number"
                value={draft.height_cm ?? ""}
                onChange={(e) => setDraft((prev) => prev ? { ...prev, height_cm: e.target.value ? Number(e.target.value) : null } : prev)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm"
              />
            ) : (
              <p className="text-sm text-zinc-200">{data.height_cm ?? "-"}</p>
            )}
          </div>

          <div>
            <label className="text-xs text-zinc-500 block mb-1">Peso (lb)</label>
            {editing ? (
              <input
                type="number"
                value={draft.weight_lbs ?? ""}
                onChange={(e) => setDraft((prev) => prev ? { ...prev, weight_lbs: e.target.value ? Number(e.target.value) : null } : prev)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm"
              />
            ) : (
              <p className="text-sm text-zinc-200">{data.weight_lbs ?? "-"}</p>
            )}
          </div>

          <div>
            <label className="text-xs text-zinc-500 block mb-1">Objetivo</label>
            {editing ? (
              <input
                value={draft.goal ?? ""}
                onChange={(e) => setDraft((prev) => prev ? { ...prev, goal: e.target.value || null } : prev)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm"
              />
            ) : (
              <p className="text-sm text-zinc-200">{data.goal ?? "-"}</p>
            )}
          </div>

          <div className="col-span-2">
            <label className="text-xs text-zinc-500 block mb-1">Notas</label>
            {editing ? (
              <textarea
                value={draft.notes ?? ""}
                onChange={(e) => setDraft((prev) => prev ? { ...prev, notes: e.target.value || null } : prev)}
                rows={3}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm"
              />
            ) : (
              <p className="text-sm text-zinc-300 whitespace-pre-wrap">{data.notes ?? "-"}</p>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:w-auto z-50 px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-white text-center">
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function StatsSection() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.getDashboard().then(setData).catch(() => {});
  }, []);

  if (!data) return <Spinner />;

  const { state, weekly_stats } = data;

  const cards = [
    { label: "Siguiente día",   value: formatDayLabel(state.next_day_name), sub: `Día ${state.next_day_index}` },
    { label: "Fatiga",          value: state.fatigue_score.toFixed(1),       sub: "/ 10" },
    { label: "Sesiones semana", value: String(weekly_stats.workouts ?? 0),   sub: "esta semana" },
    { label: "Volumen semana",  value: `${((weekly_stats.total_volume_lbs ?? 0) / 1000).toFixed(1)}k`, sub: "lbs totales" },
    { label: "Sets semana",     value: String(weekly_stats.total_sets ?? 0), sub: "sets realizados" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-zinc-800/60 border border-zinc-700/40 rounded-xl p-4"
        >
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{c.label}</p>
          <p className="text-2xl font-bold tracking-tight">{c.value}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ── Mini-calendar ─────────────────────────────────────────────────────────────

const DAY_INITIALS = ["L", "M", "X", "J", "V", "S", "D"];

function splitLabel(name: string | null): string {
  if (!name) return "";
  const n = name.toLowerCase();
  if (n.includes("push") || n.includes("pecho")) return "Push";
  if (n.includes("pull") || n.includes("espalda")) return "Pull";
  if (n.includes("leg") || n.includes("pierna") || n.includes("quad") || n.includes("femoral")) return "Legs";
  if (n.includes("arm") || n.includes("brazo")) return "Brazo";
  return name.replace(/_/g, " ").slice(0, 5);
}

function MiniCalendarSection() {
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WorkoutDetail | null>(null);

  // Build 14-day window ending today, padded to full weeks (Mon–Sun)
  const { cells, from, to } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // End: today; start: 13 days ago
    const start = addDays(today, -13);

    // Pad backwards to Monday of that week
    const startDow = (start.getDay() + 6) % 7; // 0=Mon
    const gridStart = addDays(start, -startDow);

    // Pad forwards to Sunday
    const endDow = (today.getDay() + 6) % 7; // 0=Mon
    const gridEnd = addDays(today, 6 - endDow);

    const cellDates: Date[] = [];
    let cur = new Date(gridStart);
    while (cur <= gridEnd) {
      cellDates.push(new Date(cur));
      cur = addDays(cur, 1);
    }

    return {
      cells: cellDates,
      from: formatISO(start),
      to: formatISO(today),
    };
  }, []);

  useEffect(() => {
    api.getCalendar(from, to)
      .then(setDays)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [from, to]);

  const workoutByDate = useMemo(() => {
    const map: Record<string, CalendarDay["workouts"]> = {};
    days.forEach((d) => { map[d.date] = d.workouts; });
    return map;
  }, [days]);

  const today = formatISO(new Date());

  async function openWorkout(id: number) {
    const detail = await api.getWorkout(id);
    setSelected(detail);
  }

  if (loading) return <Spinner />;

  const weeks: Date[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div>
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_INITIALS.map((d) => (
          <div key={d} className="text-center text-xs text-zinc-600 font-semibold py-1">{d}</div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
          {week.map((date) => {
            const iso = formatISO(date);
            const workouts = workoutByDate[iso] ?? [];
            const isToday = iso === today;
            const inRange = iso >= from && iso <= today;
            const hasWorkout = workouts.length > 0;
            const label = hasWorkout ? splitLabel(workouts[0].day_name) : "";

            return (
              <button
                key={iso}
                onClick={() => hasWorkout && openWorkout(workouts[0].id)}
                disabled={!hasWorkout}
                className={`
                  relative flex flex-col items-center justify-start rounded-lg py-2 px-0.5 min-h-[56px] transition-all
                  ${isToday ? "ring-1 ring-red-500" : ""}
                  ${hasWorkout
                    ? "bg-red-500/15 border border-red-500/30 active:bg-red-500/25"
                    : inRange
                      ? "bg-zinc-800/40 border border-zinc-800/60"
                      : "bg-transparent border border-transparent opacity-30"
                  }
                `}
              >
                <span className={`text-xs font-semibold ${isToday ? "text-red-400" : inRange ? "text-zinc-300" : "text-zinc-600"}`}>
                  {date.getDate()}
                </span>
                {hasWorkout && (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-0.5" />
                    <span className="text-[9px] text-red-300 mt-0.5 leading-tight text-center px-0.5 truncate w-full">
                      {label}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      ))}

      {/* Workout detail modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[70vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div>
                <p className="font-bold">{selected.template_day_name?.replace(/_/g, " ") ?? `Workout #${selected.id}`}</p>
                <p className="text-xs text-zinc-500">{selected.date}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-zinc-400 text-2xl leading-none">×</button>
            </div>
            <div className="p-4 space-y-3">
              {selected.exercises.map((ex, i) => (
                <div key={i} className="bg-zinc-800/50 border border-zinc-700/40 rounded-lg p-3">
                  <p className="font-semibold text-sm mb-2">{ex.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ex.sets.map((s, j) => (
                      <span key={j} className="border-l-2 border-red-500 bg-zinc-900/70 px-2 py-0.5 rounded text-xs font-mono text-zinc-300">
                        {s.weight}lb × {s.reps}
                        {s.rir !== null && <span className="text-zinc-500"> RIR{s.rir}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Templates ─────────────────────────────────────────────────────────────────

function TemplatesSection() {
  const [options, setOptions] = useState<DayOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [planByTemplate, setPlanByTemplate] = useState<Record<string, { exercises: { name: string; sets: { set_type: string; weight_lbs: number | null; target_reps: number | null; rir_target?: number | null }[] }[] }>>({});
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [planErrors, setPlanErrors] = useState<Record<string, string>>({});
  const [templateSearch, setTemplateSearch] = useState("");
  const [showSetPreview, setShowSetPreview] = useState(false);

  useEffect(() => {
    api.getDayOptions().then(setOptions).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("profile:templates:showPreview");
    setShowSetPreview(saved === "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("profile:templates:showPreview", showSetPreview ? "1" : "0");
  }, [showSetPreview]);

  if (loading) return <Spinner />;
  if (options.length === 0)
    return <p className="text-sm text-zinc-600 text-center py-6">No hay plantillas configuradas.</p>;

  const SPLIT_COLORS: Record<string, string> = {
    push: "bg-red-500/15 text-red-300 border-red-500/30",
    pull: "bg-red-500/15 text-red-300 border-red-500/30",
    leg: "bg-red-500/15 text-red-300 border-red-500/30",
    arm: "bg-red-500/15 text-red-300 border-red-500/30",
  };

  function splitColor(name: string) {
    const n = name.toLowerCase();
    if (n.includes("push") || n.includes("pecho")) return SPLIT_COLORS.push;
    if (n.includes("pull") || n.includes("espalda")) return SPLIT_COLORS.pull;
    if (n.includes("leg") || n.includes("pierna") || n.includes("quad") || n.includes("femoral")) return SPLIT_COLORS.leg;
    if (n.includes("arm") || n.includes("brazo")) return SPLIT_COLORS.arm;
    return "bg-zinc-700/30 text-zinc-300 border-zinc-600/40";
  }

  async function loadTemplatePreview(templateName: string) {
    setPlanErrors((prev) => {
      const next = { ...prev };
      delete next[templateName];
      return next;
    });
    setLoadingPlan(templateName);
    try {
      const plan = await api.generateDay(templateName);
      setPlanByTemplate((prev) => ({
        ...prev,
        [templateName]: {
          exercises: plan.exercises.map((ex) => ({
            name: ex.name,
            sets: ex.sets,
          })),
        },
      }));
    } catch {
      setPlanErrors((prev) => ({
        ...prev,
        [templateName]: "No se pudo cargar el detalle de sets de esta plantilla.",
      }));
    } finally {
      setLoadingPlan((prev) => (prev === templateName ? null : prev));
    }
  }

  async function handleToggleTemplate(templateName: string, isCurrentlyOpen: boolean) {
    if (isCurrentlyOpen) {
      setOpen(null);
      return;
    }

    setOpen(templateName);
    if (showSetPreview && !planByTemplate[templateName]) {
      await loadTemplatePreview(templateName);
    }
  }

  const filteredOptions = options.filter((opt) => {
    const q = templateSearch.trim().toLowerCase();
    if (!q) return true;
    return [opt.name, opt.focus, ...(opt.exercises ?? [])].join(" ").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 space-y-3">
        <input
          type="text"
          placeholder="Buscar plantilla o ejercicio..."
          value={templateSearch}
          onChange={(e) => setTemplateSearch(e.target.value)}
          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-red-500/40"
        />
        <button
          onClick={() => setShowSetPreview((v) => !v)}
          className={`w-full px-3 py-2 rounded-lg border text-sm font-semibold transition ${
            showSetPreview
              ? "border-red-500/40 bg-red-500/20 text-red-200"
              : "border-zinc-700 bg-zinc-800 text-zinc-300"
          }`}
        >
          {showSetPreview ? "Ocultar preview de sets" : "Mostrar preview de sets"}
        </button>
      </div>

      {filteredOptions.length === 0 && (
        <p className="text-sm text-zinc-600 text-center py-6">No hay plantillas que coincidan.</p>
      )}

      {filteredOptions.map((opt) => {
        const isOpen = open === opt.name;
        const color = splitColor(opt.name);
        const focuses = opt.focus.split(",").map((f) => f.trim()).filter(Boolean);
        const templateExercises = (opt.exercises ?? []).filter((e) => e.trim().length > 0);
        const preview = planByTemplate[opt.name];
        const previewExerciseCount = preview?.exercises?.length ?? 0;
        const previewSetCount = preview?.exercises?.reduce((n, ex) => n + ex.sets.length, 0) ?? 0;

        return (
          <div key={opt.name} className={`rounded-xl border ${color} overflow-hidden transition-all`}>
            <button
              className="w-full flex items-center justify-between px-4 py-3.5 text-left"
              onClick={() => handleToggleTemplate(opt.name, isOpen)}
            >
              <div>
                <p className="font-semibold text-sm">{formatDayLabel(opt.name)}</p>
                <p className="text-xs opacity-60 mt-0.5">{focuses.join(" · ")}</p>
              </div>
              <span className="text-lg opacity-60">{isOpen ? "▲" : "▼"}</span>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 pt-1 border-t border-current/10">
                <div className="flex flex-wrap gap-2 mt-2">
                  {focuses.map((f) => (
                    <span key={f} className="px-2.5 py-1 rounded-full text-xs font-medium bg-black/20 border border-current/20">
                      {f}
                    </span>
                  ))}
                </div>

                <details className="mt-3 rounded-lg border border-current/20 bg-black/20 px-3 py-2">
                  <summary className="text-xs font-semibold cursor-pointer">Ejercicios de la plantilla</summary>
                  {templateExercises.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {templateExercises.map((exercise) => (
                        <p key={exercise} className="text-xs opacity-90">- {exercise}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs opacity-70">No hay ejercicios definidos en anchors.</p>
                  )}
                </details>

                {showSetPreview && (
                  <details className="mt-3 rounded-lg border border-current/20 bg-black/20 px-3 py-2" open>
                    <summary className="text-xs font-semibold cursor-pointer">Plan de sets (preview)</summary>
                    {loadingPlan === opt.name ? (
                      <p className="mt-2 text-xs opacity-70">Cargando sets...</p>
                    ) : planErrors[opt.name] ? (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs text-red-300">{planErrors[opt.name]}</p>
                        <button
                          onClick={() => loadTemplatePreview(opt.name)}
                          className="px-2.5 py-1 rounded-lg border border-red-500/30 bg-red-500/15 text-red-200 text-xs"
                        >
                          Reintentar
                        </button>
                      </div>
                    ) : previewExerciseCount > 0 ? (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs opacity-80">{previewExerciseCount} ejercicios · {previewSetCount} sets</p>
                        {preview.exercises.map((exercise) => (
                          <details key={exercise.name} className="rounded-lg border border-current/20 p-2">
                            <summary className="text-xs font-semibold cursor-pointer">{exercise.name}</summary>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {exercise.sets.map((set, setIndex) => {
                                const label = set.set_type === "warmup" ? "W" : set.set_type === "drop" ? "D" : `S${setIndex + 1}`;
                                const weight = set.weight_lbs ?? "-";
                                const reps = set.target_reps ?? "-";
                                const rir = set.rir_target ?? "-";
                                return (
                                  <span key={`${exercise.name}-${setIndex}`} className="px-2 py-1 rounded-md text-[11px] border border-current/25 bg-black/20">
                                    {label} · {weight}lb · {reps}r · RIR {rir}
                                  </span>
                                );
                              })}
                            </div>
                          </details>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs opacity-70">Sin preview de sets disponible.</p>
                        <button
                          onClick={() => loadTemplatePreview(opt.name)}
                          className="px-2.5 py-1 rounded-lg border border-current/30 bg-black/20 text-xs"
                        >
                          Cargar preview
                        </button>
                      </div>
                    )}
                  </details>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Library ───────────────────────────────────────────────────────────────────

const MUSCLE_FILTERS = [
  "all", "chest", "lats", "upper_back", "biceps", "triceps",
  "front_delts", "side_delts", "rear_delts", "quads", "hamstrings", "glutes", "calves", "core",
] as const;

const MUSCLE_LABEL: Record<string, string> = {
  all: "Todos", chest: "Pecho", lats: "Dorsales", upper_back: "Espalda",
  biceps: "Bíceps", triceps: "Tríceps", front_delts: "Deltoides", side_delts: "Laterales",
  rear_delts: "Posteriores", quads: "Cuádriceps", hamstrings: "Femorales",
  glutes: "Glúteos", calves: "Gemelos", core: "Core",
};

function LibrarySection() {
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState<string>("all");
  const [anchorOnly, setAnchorOnly] = useState(false);

  useEffect(() => {
    api.getExercises().then(setExercises).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() =>
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
      {/* Search */}
      <input
        type="text"
        placeholder="Buscar ejercicio..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all"
      />

      {/* Muscle filter pills */}
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

      {/* Anchor toggle */}
      <button
        onClick={() => setAnchorOnly((v) => !v)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
          anchorOnly
            ? "bg-red-500/20 text-red-300 border-red-500/40"
            : "bg-zinc-800/60 text-zinc-500 border-zinc-700/50"
        }`}
      >
        🔴 Solo Anchors
      </button>

      {/* Count */}
      <p className="text-xs text-zinc-600">{filtered.length} ejercicios</p>

      {/* List */}
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
                {ex.primary_muscle} · {ex.type} · {ex.movement_pattern}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-mono font-semibold text-zinc-200">{ex.avg_weight.toFixed(0)}<span className="text-zinc-500 text-xs">lb</span></p>
              <p className="text-xs text-zinc-600">max {ex.max_weight.toFixed(0)}lb</p>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-zinc-600 text-center py-6">Sin resultados.</p>
        )}
      </div>
    </div>
  );
}

// ── Protection ────────────────────────────────────────────────────────────────

function ProtectionSection() {
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
    api.getProtections().then(setProtections).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function handleAdd() {
    setAdding(true);
    try {
      await api.addProtection(muscle, severity);
      load();
      showToast(`🛡️ Protección activada para ${muscle}`);
    } catch {
      showToast("❌ Error al añadir protección");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(m: string) {
    try {
      await api.removeProtection(m);
      setProtections((prev) => prev.filter((p) => p.muscle_group !== m));
      showToast(`✅ Protección eliminada para ${m}`);
    } catch {
      showToast("❌ Error al eliminar protección");
    }
  }

  const severityLabel =
    severity >= 9 ? "Extremo — casi sin volumen"
    : severity >= 7 ? "Alto — reducción significativa"
    : severity >= 5 ? "Medio — reducción moderada"
    : severity >= 3 ? "Bajo — reducción leve"
    : "Mínimo";

  const volFactor = Math.round(Math.max(0.2, 1 - (severity / 10) * 0.8) * 100);

  return (
    <div className="space-y-4">
      {/* Active protections */}
      {loading ? <Spinner /> : protections.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-zinc-600 font-semibold">Activas</p>
          {protections.map((p) => {
            const color =
              p.severity >= 8 ? "border-red-600/50 bg-red-950/30 text-red-300"
              : p.severity >= 5 ? "border-red-600/50 bg-red-950/30 text-red-300"
              : "border-red-600/50 bg-red-950/30 text-red-300";
            return (
              <div key={p.muscle_group} className={`flex items-center justify-between p-4 rounded-xl border ${color}`}>
                <div>
                  <p className="font-semibold capitalize">{p.muscle_group}</p>
                  <p className="text-xs opacity-70 mt-0.5">
                    Severidad {p.severity}/10 · Volumen ×{p.factor} ({Math.round(p.factor * 100)}%)
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
          🟢 Sin protecciones activas — todo al 100%
        </div>
      )}

      {/* Add */}
      <div className="bg-zinc-800/50 border border-zinc-700/40 rounded-xl p-4 space-y-4">
        <p className="text-sm font-semibold text-zinc-300">Añadir protección</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wide mb-1.5 block">Músculo</label>
            <select
              value={muscle}
              onChange={(e) => setMuscle(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500 capitalize"
            >
              {MUSCLE_GROUPS.map((m) => (
                <option key={m} value={m} className="capitalize">{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wide mb-1.5 block">
              Severidad: {severity}/10
            </label>
            <input
              type="range" min={1} max={10} value={severity}
              onChange={(e) => setSeverity(parseInt(e.target.value))}
              className="w-full accent-red-500 mt-2"
            />
          </div>
        </div>

        <p className="text-xs text-zinc-500 italic">{severityLabel} (volumen ×{volFactor}%)</p>

        <button
          onClick={handleAdd}
          disabled={adding}
          className="w-full py-2.5 bg-gradient-to-r from-red-600 to-red-500 text-white font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50"
        >
          {adding ? "Añadiendo..." : `🛡️ Proteger ${muscle}`}
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

// ─── main page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [active, setActive] = useState<SectionId>("personal");

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-5 rounded-2xl border border-zinc-700/50 bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.16),_transparent_55%)] bg-zinc-900/80 p-5 shadow-[0_0_40px_rgba(239,68,68,0.12)]">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">GymOS</p>
        <h1 className="text-2xl font-bold tracking-tight">Perfil</h1>
        <p className="text-sm text-zinc-500 mt-1">Tu historial, ejercicios y configuración</p>
      </div>

      {/* Section tab bar */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-5 no-scrollbar">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              active === s.id
                ? "bg-red-600/25 text-red-200 border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.2)]"
                : "bg-zinc-800/60 text-zinc-500 border-zinc-700/50 hover:text-zinc-300"
            }`}
          >
            <span>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="animate-in fade-in duration-200">
        {active === "personal"   && <PersonalSection />}
        {active === "stats"      && <StatsSection />}
        {active === "templates"  && <TemplatesSection />}
        {active === "library"    && <LibrarySection />}
        {active === "protection" && <ProtectionSection />}
      </div>
    </div>
  );
}
