"use client";

import { useMemo, useState } from "react";

type BarType = "standard" | "short" | "ez" | "none";

const PLATE_OPTIONS = [45, 35, 25, 22, 10, 5, 2.5] as const;

function roundToNearestHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function formatWeight(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

export function PlateCalculatorModal({
  initialWeight,
  shortBarWeight,
  onClose,
  onSave,
}: {
  initialWeight: number;
  shortBarWeight: number;
  onClose: () => void;
  onSave: (weight: number) => void;
}) {
  const [barType, setBarType] = useState<BarType>("standard");
  const [selectedPlates, setSelectedPlates] = useState<number[]>([]);
  const [customPlate, setCustomPlate] = useState<string>("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [manualOffset, setManualOffset] = useState(0);

  const barWeight = useMemo(() => {
    if (barType === "standard") return 45;
    if (barType === "short") return shortBarWeight;
    if (barType === "ez") return 20;
    return 0;
  }, [barType, shortBarWeight]);

  const platesTotal = useMemo(
    () => selectedPlates.reduce((sum, p) => sum + p, 0) * 2,
    [selectedPlates]
  );

  const total = useMemo(
    () => roundToNearestHalf(initialWeight + barWeight + platesTotal + manualOffset),
    [initialWeight, barWeight, platesTotal, manualOffset]
  );

  function togglePlate(plate: number) {
    setSelectedPlates((prev) =>
      prev.includes(plate) ? prev.filter((value) => value !== plate) : [...prev, plate]
    );
  }

  function clear() {
    setSelectedPlates([]);
    setShowCustomInput(false);
    setCustomPlate("");
    setManualOffset(0);
    setBarType("standard");
  }

  function addCustomPlate() {
    const value = Number(customPlate);
    if (!Number.isFinite(value) || value <= 0) return;
    const rounded = roundToNearestHalf(value);
    if (!selectedPlates.includes(rounded)) {
      setSelectedPlates((prev) => [...prev, rounded]);
    }
    setCustomPlate("");
    setShowCustomInput(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-[#1c1c24] shadow-2xl p-4 sm:p-5 animate-in slide-in-from-bottom-4 fade-in duration-200">
        <div className="flex items-start justify-between gap-3">
          <button onClick={clear} className="text-sm font-semibold text-red-400">
            Clear
          </button>
          <div className="text-center">
            <p className="text-base font-semibold text-white">Plate Calculator</p>
            <p className="text-xs text-zinc-400 mt-0.5">Initial Weight: {formatWeight(initialWeight)} lbs</p>
          </div>
          <button onClick={() => onSave(total)} className="text-sm font-semibold text-blue-400">
            Save
          </button>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_auto] gap-3 items-center">
          <input
            type="range"
            min={0}
            max={400}
            step={2.5}
            value={manualOffset}
            onChange={(e) => setManualOffset(Number(e.target.value))}
            className="w-full accent-blue-400"
          />
          <p className="text-3xl font-bold text-white tabular-nums">{formatWeight(total)} lbs</p>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">Add Plates (+lbs)</p>
          <div className="flex flex-wrap gap-2">
            {PLATE_OPTIONS.map((plate) => {
              const active = selectedPlates.includes(plate);
              return (
                <button
                  key={plate}
                  type="button"
                  onClick={() => togglePlate(plate)}
                  className={`h-10 min-w-10 rounded-full border px-3 text-xs font-semibold ${active
                    ? "bg-[#4da3ff] border-[#4da3ff] text-white"
                    : "bg-zinc-800 border-zinc-700 text-zinc-300"
                    }`}
                >
                  {formatWeight(plate)}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowCustomInput((prev) => !prev)}
              className="h-10 w-10 rounded-full border border-dashed border-zinc-600 text-zinc-400 text-lg leading-none"
            >
              +
            </button>
          </div>
          {showCustomInput && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                step={0.5}
                min={0.5}
                value={customPlate}
                onChange={(e) => setCustomPlate(e.target.value)}
                placeholder="Custom plate"
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={addCustomPlate}
                className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200"
              >
                Add
              </button>
            </div>
          )}
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">Bar Type (lbs)</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { type: "standard" as const, label: "Standard Bar (45 lbs)" },
              { type: "short" as const, label: `Short Bar (${formatWeight(shortBarWeight)} lbs)` },
              { type: "ez" as const, label: "EZ Bar (20 lbs)" },
              { type: "none" as const, label: "None (0 lbs)" },
            ].map((option) => {
              const active = barType === option.type;
              return (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => setBarType(option.type)}
                  className={`rounded-full px-3 py-2 text-xs font-semibold border ${active
                    ? "bg-[#4da3ff] border-[#4da3ff] text-white"
                    : "bg-zinc-800 border-zinc-700 text-zinc-300"
                    }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-sm"
        >
          Close
        </button>
      </div>
    </div>
  );
}
