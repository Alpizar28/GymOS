"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { api, type PersonalProfile } from "@/lib/api";
import { displayFromLbs, formatWeight, lbsFromDisplay, unitLabel } from "@/lib/units";

const EQUIPMENT_OPTIONS = [
  "full_gym",
  "home_basic",
  "dumbbells_only",
  "machines_only",
  "bodyweight_only",
  "bands",
  "barbell_only",
];

const EMPTY_PROFILE: PersonalProfile = {
  full_name: "",
  photo_url: null,
  age: null,
  sex: null,
  height_cm: null,
  weight_unit: "lb",
  weight_lbs: null,
  body_fat_pct: null,
  primary_goal: null,
  goal_detail: null,
  target_weight_lbs: null,
  timeline_weeks: null,
  training_years: null,
  days_per_week: null,
  session_duration_min: null,
  preferred_split: null,
  preferred_short_bar_lbs: 35,
  equipment_access: [],
  injuries: [],
  limitations: null,
  exercise_likes: [],
  exercise_dislikes: [],
  sleep_hours: null,
  stress_level: null,
  activity_level: null,
  nutrition_notes: null,
  goal: null,
  notes: null,
};

function parseCsvList(text: string): string[] {
  return text
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 100);
}

export default function OnboardingPage() {
  const router = useRouter();
  const [data, setData] = useState<PersonalProfile>(EMPTY_PROFILE);
  const [likesInput, setLikesInput] = useState("");
  const [dislikesInput, setDislikesInput] = useState("");
  const [injuryArea, setInjuryArea] = useState("");
  const [injurySeverity, setInjurySeverity] = useState<"low" | "medium" | "high">("low");
  const [injuryNotes, setInjuryNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getPersonalProfile()
      .then((profile) => {
        setData({ ...EMPTY_PROFILE, ...profile });
        setLikesInput((profile.exercise_likes ?? []).join(", "));
        setDislikesInput((profile.exercise_dislikes ?? []).join(", "));
      })
      .finally(() => setLoading(false));
  }, []);

  const canSubmit = useMemo(() => {
    return !saving && data.full_name.trim().length > 0;
  }, [data.full_name, saving]);

  function update<K extends keyof PersonalProfile>(key: K, value: PersonalProfile[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function updateWeightInput(raw: string) {
    const parsed = raw ? Number(raw) : null;
    const valueLbs = lbsFromDisplay(parsed, data.weight_unit);
    update("weight_lbs", valueLbs);
  }

  function toggleEquipment(value: string) {
    setData((prev) => {
      const exists = prev.equipment_access.includes(value);
      const next = exists
        ? prev.equipment_access.filter((v) => v !== value)
        : [...prev.equipment_access, value];
      return { ...prev, equipment_access: next };
    });
  }

  function addInjury() {
    if (!injuryArea.trim()) return;
    setData((prev) => ({
      ...prev,
      injuries: [
        ...prev.injuries,
        { area: injuryArea.trim(), severity: injurySeverity, notes: injuryNotes.trim() || null },
      ].slice(0, 30),
    }));
    setInjuryArea("");
    setInjurySeverity("low");
    setInjuryNotes("");
  }

  function removeInjury(index: number) {
    setData((prev) => ({
      ...prev,
      injuries: prev.injuries.filter((_, i) => i !== index),
    }));
  }

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const payload: Partial<PersonalProfile> = {
        ...data,
        full_name: data.full_name.trim(),
        exercise_likes: parseCsvList(likesInput),
        exercise_dislikes: parseCsvList(dislikesInput),
      };

      await api.completeOnboarding(payload);
      router.replace("/today");
    } catch {
      setError("No se pudo completar onboarding. Revisa campos e intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-sm text-zinc-500">
        Cargando onboarding...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
        <img src="/logo-wordmark.svg" alt="GymOS" className="mb-3 h-8 w-auto" />
        <h1 className="text-xl font-bold">Completa tu perfil</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Esto mejora recomendaciones, progresion y personalizacion de rutinas.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200">Datos base</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <select
            value={data.weight_unit}
            onChange={(e) => update("weight_unit", (e.target.value === "kg" ? "kg" : "lb"))}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm"
          >
            <option value="lb">US (lb)</option>
            <option value="kg">LATAM / Metrico (kg)</option>
          </select>
          <input
            placeholder="Nombre completo"
            value={data.full_name}
            onChange={(e) => update("full_name", e.target.value)}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm"
          />
          <input
            placeholder="Edad"
            type="number"
            value={data.age ?? ""}
            onChange={(e) => update("age", e.target.value ? Number(e.target.value) : null)}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm"
          />
          <input
            placeholder="Estatura (cm)"
            type="number"
            value={data.height_cm ?? ""}
            onChange={(e) => update("height_cm", e.target.value ? Number(e.target.value) : null)}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm"
          />
          <input
            placeholder={`Peso (${unitLabel(data.weight_unit, true)})`}
            type="number"
            value={(() => {
              const display = displayFromLbs(data.weight_lbs, data.weight_unit);
              return display === null ? "" : formatWeight(display);
            })()}
            onChange={(e) => updateWeightInput(e.target.value)}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200">Objetivos y entrenamiento</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <select
            value={data.primary_goal ?? ""}
            onChange={(e) => update("primary_goal", (e.target.value || null) as PersonalProfile["primary_goal"])}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm"
          >
            <option value="">Objetivo principal</option>
            <option value="fat_loss">Perder grasa</option>
            <option value="muscle_gain">Ganar musculo</option>
            <option value="recomp">Recomposicion</option>
            <option value="strength">Fuerza</option>
            <option value="performance">Rendimiento</option>
            <option value="health">Salud general</option>
          </select>
          <input
            placeholder="Dias por semana"
            type="number"
            value={data.days_per_week ?? ""}
            onChange={(e) => update("days_per_week", e.target.value ? Number(e.target.value) : null)}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm"
          />
          <input
            placeholder="Duracion por sesion (min)"
            type="number"
            value={data.session_duration_min ?? ""}
            onChange={(e) => update("session_duration_min", e.target.value ? Number(e.target.value) : null)}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm"
          />
          <input
            placeholder="Anos entrenando"
            type="number"
            value={data.training_years ?? ""}
            onChange={(e) => update("training_years", e.target.value ? Number(e.target.value) : null)}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm"
          />
        </div>
        <textarea
          placeholder="Detalle del objetivo"
          value={data.goal_detail ?? ""}
          onChange={(e) => update("goal_detail", e.target.value || null)}
          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm min-h-[90px]"
        />
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200">Equipo y limitaciones</h2>
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT_OPTIONS.map((option) => {
            const active = data.equipment_access.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => toggleEquipment(option)}
                className={`px-3 py-1.5 rounded-lg border text-xs ${
                  active
                    ? "border-red-500 bg-red-500/15 text-red-300"
                    : "border-zinc-700 text-zinc-400"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>

        <div className="grid sm:grid-cols-3 gap-2">
          <input
            placeholder="Lesion / zona"
            value={injuryArea}
            onChange={(e) => setInjuryArea(e.target.value)}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={injurySeverity}
            onChange={(e) => setInjurySeverity(e.target.value as "low" | "medium" | "high")}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
          >
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
          </select>
          <button
            type="button"
            onClick={addInjury}
            className="rounded-lg border border-zinc-700 text-zinc-300 text-sm"
          >
            Agregar lesion
          </button>
        </div>
        <input
          placeholder="Notas lesion"
          value={injuryNotes}
          onChange={(e) => setInjuryNotes(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
        />

        {data.injuries.length > 0 ? (
          <div className="space-y-2">
            {data.injuries.map((injury, idx) => (
              <div key={`${injury.area}-${idx}`} className="flex items-center justify-between text-xs bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
                <span>
                  {injury.area} ({injury.severity}) {injury.notes ? `- ${injury.notes}` : ""}
                </span>
                <button type="button" onClick={() => removeInjury(idx)} className="text-zinc-400 hover:text-red-400">
                  Quitar
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200">Preferencias y estilo de vida</h2>
        <input
          placeholder="Ejercicios que te gustan (separados por coma)"
          value={likesInput}
          onChange={(e) => setLikesInput(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm"
        />
        <input
          placeholder="Ejercicios que no te gustan (separados por coma)"
          value={dislikesInput}
          onChange={(e) => setDislikesInput(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm"
        />
        <div className="grid sm:grid-cols-3 gap-3">
          <input
            placeholder="Horas de sueno"
            type="number"
            value={data.sleep_hours ?? ""}
            onChange={(e) => update("sleep_hours", e.target.value ? Number(e.target.value) : null)}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm"
          />
          <select
            value={data.stress_level ?? ""}
            onChange={(e) => update("stress_level", (e.target.value || null) as PersonalProfile["stress_level"])}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm"
          >
            <option value="">Estres</option>
            <option value="low">Bajo</option>
            <option value="medium">Medio</option>
            <option value="high">Alto</option>
          </select>
          <select
            value={data.activity_level ?? ""}
            onChange={(e) => update("activity_level", (e.target.value || null) as PersonalProfile["activity_level"])}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm"
          >
            <option value="">Actividad diaria</option>
            <option value="sedentary">Sedentario</option>
            <option value="light">Ligera</option>
            <option value="moderate">Moderada</option>
            <option value="high">Alta</option>
            <option value="athlete">Atleta</option>
          </select>
        </div>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="flex justify-end pb-8">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="px-5 py-2.5 rounded-lg bg-red-600 text-white font-semibold disabled:opacity-40"
        >
          {saving ? "Guardando..." : "Guardar y continuar"}
        </button>
      </div>
    </div>
  );
}
