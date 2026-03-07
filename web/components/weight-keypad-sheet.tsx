"use client";

import { useState } from "react";

import { BackspaceIcon, BarbellIcon, CalculatorIcon } from "@/components/icons";
import type { WeightUnit } from "@/lib/units";

function formatWeight(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

export function WeightKeypadSheet({
  initialValue,
  mode,
  weightUnit = "lb",
  activeTargetLabel,
  onChange,
  onClose,
  onOpenPlateCalculator,
}: {
  initialValue: number | null;
  mode: "weight" | "count";
  weightUnit?: WeightUnit;
  activeTargetLabel?: string;
  onChange: (value: number | null) => void;
  onClose: () => void;
  onOpenPlateCalculator?: () => void;
}) {
  const [raw, setRaw] = useState(initialValue === null ? "" : formatWeight(initialValue));
  const displayValue = raw === "" ? "" : raw;

  function haptic() {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(8);
    }
  }

  function applyRaw(nextRaw: string) {
    const trimmed = nextRaw.slice(0, 8);
    setRaw(trimmed);
    if (trimmed === "") {
      onChange(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return;
    const next = clampNonNegative(parsed);
    onChange(mode === "count" ? Math.floor(next) : next);
  }

  function appendToken(token: string) {
    haptic();
    if (mode === "count" && token === ".") return;
    if (mode === "weight" && weightUnit === "kg" && token === ".") return;
    if (token === ".") {
      if (raw.includes(".")) return;
      if (raw === "") {
        applyRaw("0.");
        return;
      }
    }

    if (token !== "." && raw === "0") {
      applyRaw(token);
      return;
    }

    applyRaw(`${raw}${token}`);
  }

  function backspace() {
    if (!raw) return;
    haptic();
    applyRaw(raw.slice(0, -1));
  }

  function step(delta: number) {
    haptic();
    const base = Number(raw);
    const safeBase = Number.isFinite(base) ? base : 0;
    const next = clampNonNegative(Math.round((safeBase + delta) * 100) / 100);
    applyRaw(formatWeight(next));
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="today-keypad-overlay fixed inset-0 z-[55] bg-black/25 flex items-end" onClick={onClose}>
      <div
        className="today-keypad-panel w-full rounded-t-3xl border-t border-zinc-700 bg-[#12121a]/96 p-3 pb-[calc(12px+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-6 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-xs uppercase tracking-wide text-zinc-500 font-semibold">Weight Input</p>
          <button
            onClick={() => {
              haptic();
              onClose();
            }}
            className="text-xs font-semibold text-zinc-300"
          >
            Done
          </button>
        </div>

        <p className="text-[11px] text-zinc-500 mb-2 px-1">
          Editing value directly on active input
          {activeTargetLabel ? (
            <span className="ml-1 text-red-300 font-semibold">- {activeTargetLabel}</span>
          ) : null}
        </p>

        <div className="mb-3 rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-h-7 flex items-center font-mono text-2xl text-zinc-100 tracking-tight">
              <span>{displayValue}</span>
              <span className="inline-block w-[2px] h-6 ml-0.5 bg-red-400 animate-pulse" aria-hidden="true" />
            </div>
            <button
              type="button"
              onClick={() => applyRaw("")}
              className="h-8 px-3 rounded-lg border border-zinc-600 bg-zinc-800 text-xs font-semibold text-zinc-200 active:bg-red-500/20 active:border-red-400"
            >
              Clear
            </button>
          </div>
          <p className="mt-1 text-[10px] text-zinc-500">Typing starts at the end of the current value.</p>
        </div>

        <div className="grid grid-cols-[1fr_112px] gap-2">
          <div className="grid grid-cols-3 gap-2">
            {keys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => appendToken(key)}
                className="today-keypad-key h-14 rounded-xl border border-zinc-700 bg-zinc-900 text-white text-2xl font-semibold transition-transform duration-100 active:scale-[0.98] active:bg-red-500/20 active:border-red-400"
              >
                {key}
              </button>
            ))}
            <button
              type="button"
              onClick={() => appendToken(".")}
              disabled={mode === "count" || (mode === "weight" && weightUnit === "kg")}
              className="today-keypad-key h-14 rounded-xl border border-zinc-700 bg-zinc-900 text-white text-2xl font-semibold transition-transform duration-100 active:scale-[0.98] active:bg-red-500/20 active:border-red-400 disabled:opacity-30 disabled:active:scale-100 disabled:active:bg-zinc-900 disabled:active:border-zinc-700"
            >
              .
            </button>
            <button
              type="button"
              onClick={() => appendToken("0")}
              className="today-keypad-key h-14 rounded-xl border border-zinc-700 bg-zinc-900 text-white text-2xl font-semibold transition-transform duration-100 active:scale-[0.98] active:bg-red-500/20 active:border-red-400"
            >
              0
            </button>
            <button
              type="button"
              onClick={backspace}
              className="h-14 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-200 text-xl font-semibold transition-transform duration-100 active:scale-[0.98] active:bg-red-500/20 active:border-red-400"
            >
              <span className="flex items-center justify-center">
                <span className="h-9 w-9 rounded-full border border-zinc-600 bg-zinc-800/70 flex items-center justify-center text-red-200">
                  <BackspaceIcon className="h-5 w-5" />
                </span>
              </span>
            </button>
          </div>

          <div className="grid grid-rows-[56px_56px_1fr] gap-2">
            <button
              type="button"
              onClick={() => step(mode === "count" ? 1 : weightUnit === "kg" ? 1 : 2.5)}
              className="rounded-xl border border-red-500/80 bg-red-500/20 text-red-200 text-lg font-bold transition-transform duration-100 active:scale-[0.98]"
            >
              {mode === "count" ? "+1" : weightUnit === "kg" ? "+1" : "+2.5"}
            </button>
            <button
              type="button"
              onClick={() => step(mode === "count" ? -1 : weightUnit === "kg" ? -1 : -2.5)}
              className="rounded-xl border border-zinc-600 bg-zinc-900 text-zinc-200 text-lg font-bold transition-transform duration-100 active:scale-[0.98]"
            >
              {mode === "count" ? "-1" : weightUnit === "kg" ? "-1" : "-2.5"}
            </button>
            {mode === "weight" && onOpenPlateCalculator && (
              <button
                type="button"
                onClick={() => {
                  haptic();
                  onOpenPlateCalculator();
                }}
                className="rounded-2xl border border-red-500/70 bg-red-500/14 text-left px-3 py-2 transition-transform duration-100 active:scale-[0.99]"
              >
                <div className="flex items-center gap-2">
                  <span className="h-8 w-8 rounded-full border border-red-500/60 bg-red-500/18 flex items-center justify-center">
                    <BarbellIcon className="h-[18px] w-[18px] text-red-200" />
                  </span>
                  <span className="text-zinc-500 text-xs">+</span>
                  <span className="h-8 w-8 rounded-full border border-red-500/60 bg-red-500/18 flex items-center justify-center">
                    <CalculatorIcon className="h-[18px] w-[18px] text-red-200" />
                  </span>
                </div>
                <p className="text-[11px] text-red-200 font-semibold mt-1">Plate Calculator</p>
                <p className="text-[10px] text-zinc-300 mt-0.5">Open calculator</p>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
