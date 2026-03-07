"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import type { WeightUnit } from "@/lib/units";

const STORAGE_KEY = "gymos:weight-unit";

type WeightUnitContextValue = {
  unit: WeightUnit;
  setUnit: (unit: WeightUnit) => void;
};

const WeightUnitContext = createContext<WeightUnitContextValue | null>(null);

function readStoredUnit(): WeightUnit {
  if (typeof window === "undefined") return "lb";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "kg" ? "kg" : "lb";
}

export function WeightUnitProvider({ children }: { children: React.ReactNode }) {
  const [unit, setUnitState] = useState<WeightUnit>(() => readStoredUnit());

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, unit);
  }, [unit]);

  useEffect(() => {
    let cancelled = false;
    api
      .getPersonalProfile()
      .then((profile) => {
        if (cancelled) return;
        const next = profile.weight_unit === "kg" ? "kg" : "lb";
        setUnitState(next);
        window.localStorage.setItem(STORAGE_KEY, next);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      unit,
      setUnit: (nextUnit: WeightUnit) => {
        setUnitState(nextUnit);
        window.localStorage.setItem(STORAGE_KEY, nextUnit);
        void api.updatePersonalProfile({ weight_unit: nextUnit }).catch(() => {});
      },
    }),
    [unit]
  );

  return <WeightUnitContext.Provider value={value}>{children}</WeightUnitContext.Provider>;
}

export function useWeightUnit() {
  const context = useContext(WeightUnitContext);
  if (!context) {
    throw new Error("useWeightUnit must be used within WeightUnitProvider");
  }
  return context;
}
