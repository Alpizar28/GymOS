"use client";

import { useState } from "react";

import { BackspaceIcon, BarbellIcon, CalculatorIcon } from "@/components/icons";

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
  onChange,
  onClose,
  onOpenPlateCalculator,
}: {
  initialValue: number | null;
  onChange: (value: number | null) => void;
  onClose: () => void;
  onOpenPlateCalculator: () => void;
}) {
  const [raw, setRaw] = useState(initialValue === null ? "" : formatWeight(initialValue));

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
    onChange(clampNonNegative(parsed));
  }

  function appendToken(token: string) {
    haptic();
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
    <div className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm flex items-end" onClick={onClose}>
      <div
        className="w-full rounded-t-3xl border-t border-zinc-700 bg-[#12121a] p-3 pb-[calc(12px+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-6 fade-in duration-200"
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

        <div className="mb-3 rounded-xl border border-zinc-700 bg-zinc-900/70 px-4 py-3 text-center">
          <p className="text-3xl font-bold tabular-nums text-white">{raw || "0"}</p>
          <p className="text-xs text-zinc-500 mt-1">lbs</p>
        </div>

        <div className="grid grid-cols-[1fr_112px] gap-2">
          <div className="grid grid-cols-3 gap-2">
            {keys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => appendToken(key)}
                className="h-14 rounded-xl border border-zinc-700 bg-zinc-900 text-white text-2xl font-semibold transition-transform duration-100 active:scale-[0.98] active:bg-[#4da3ff]/20 active:border-[#4da3ff]"
              >
                {key}
              </button>
            ))}
            <button
              type="button"
              onClick={() => appendToken(".")}
              className="h-14 rounded-xl border border-zinc-700 bg-zinc-900 text-white text-2xl font-semibold transition-transform duration-100 active:scale-[0.98] active:bg-[#4da3ff]/20 active:border-[#4da3ff]"
            >
              .
            </button>
            <button
              type="button"
              onClick={() => appendToken("0")}
              className="h-14 rounded-xl border border-zinc-700 bg-zinc-900 text-white text-2xl font-semibold transition-transform duration-100 active:scale-[0.98] active:bg-[#4da3ff]/20 active:border-[#4da3ff]"
            >
              0
            </button>
            <button
              type="button"
              onClick={backspace}
              className="h-14 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-200 text-xl font-semibold transition-transform duration-100 active:scale-[0.98] active:bg-[#4da3ff]/20 active:border-[#4da3ff]"
            >
              <span className="flex items-center justify-center">
                <span className="h-9 w-9 rounded-full border border-zinc-600 bg-zinc-800/70 flex items-center justify-center">
                  <BackspaceIcon className="h-5 w-5" />
                </span>
              </span>
            </button>
          </div>

          <div className="grid grid-rows-[56px_56px_1fr] gap-2">
            <button
              type="button"
              onClick={() => step(2.5)}
              className="rounded-xl border border-[#4da3ff]/80 bg-[#4da3ff]/20 text-[#9ecbff] text-lg font-bold transition-transform duration-100 active:scale-[0.98]"
            >
              +2.5
            </button>
            <button
              type="button"
              onClick={() => step(-2.5)}
              className="rounded-xl border border-zinc-600 bg-zinc-900 text-zinc-200 text-lg font-bold transition-transform duration-100 active:scale-[0.98]"
            >
              -2.5
            </button>
            <button
              type="button"
              onClick={() => {
                haptic();
                onOpenPlateCalculator();
              }}
              className="rounded-2xl border border-[#4da3ff]/70 bg-[#4da3ff]/16 text-left px-3 py-2 transition-transform duration-100 active:scale-[0.99]"
            >
              <div className="flex items-center gap-2">
                <span className="h-8 w-8 rounded-full border border-[#4da3ff]/60 bg-[#4da3ff]/18 flex items-center justify-center">
                  <BarbellIcon className="h-[18px] w-[18px] text-[#9ecbff]" />
                </span>
                <span className="text-zinc-500 text-xs">+</span>
                <span className="h-8 w-8 rounded-full border border-[#4da3ff]/60 bg-[#4da3ff]/18 flex items-center justify-center">
                  <CalculatorIcon className="h-[18px] w-[18px] text-[#9ecbff]" />
                </span>
              </div>
              <p className="text-[11px] text-[#9ecbff] font-semibold mt-1">Plate Calculator</p>
              <p className="text-[10px] text-zinc-300 mt-0.5">Open calculator</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
