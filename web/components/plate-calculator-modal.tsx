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

function plateHeight(plate: number): number {
  if (plate >= 45) return 68;
  if (plate >= 35) return 62;
  if (plate >= 25) return 56;
  if (plate >= 22) return 52;
  if (plate >= 10) return 44;
  if (plate >= 5) return 36;
  return 30;
}

function plateColor(plate: number): string {
  if (plate >= 45) return "bg-zinc-200";
  if (plate >= 35) return "bg-zinc-300";
  if (plate >= 25) return "bg-red-300";
  if (plate >= 22) return "bg-red-400";
  if (plate >= 10) return "bg-zinc-400";
  return "bg-zinc-500";
}

function PlateStack({ plates, side }: { plates: number[]; side: "left" | "right" }) {
  const maxVisible = 8;
  const visible = plates.slice(0, maxVisible);
  const hiddenCount = Math.max(0, plates.length - maxVisible);
  const sideClass = side === "left" ? "flex-row-reverse" : "flex-row";

  return (
    <div className={`flex items-end ${sideClass} gap-0.5 min-w-[68px]`}>
      {hiddenCount > 0 && (
        <span className="text-[10px] text-zinc-400 px-1">+{hiddenCount}</span>
      )}
      {visible.map((plate, idx) => (
        <div
          key={`${side}-${plate}-${idx}`}
          className={`w-3 sm:w-3.5 rounded-sm border border-zinc-800 ${plateColor(plate)}`}
          style={{ height: `${plateHeight(plate)}px` }}
          title={`${formatWeight(plate)} lb`}
        />
      ))}
    </div>
  );
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
  const [plateSizes, setPlateSizes] = useState<number[]>([...PLATE_OPTIONS]);
  const [plateCounts, setPlateCounts] = useState<Record<number, number>>({});
  const [customPlate, setCustomPlate] = useState<string>("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  const barWeight = useMemo(() => {
    if (barType === "standard") return 45;
    if (barType === "short") return shortBarWeight;
    if (barType === "ez") return 20;
    return 0;
  }, [barType, shortBarWeight]);

  const platesPerSideTotal = useMemo(
    () => Object.entries(plateCounts).reduce((sum, [plate, count]) => sum + Number(plate) * count, 0),
    [plateCounts]
  );

  const platesTotal = platesPerSideTotal * 2;

  const total = useMemo(() => roundToNearestHalf(initialWeight + barWeight + platesTotal), [initialWeight, barWeight, platesTotal]);

  const visualPerSide = useMemo(() => {
    const stack: number[] = [];
    const sorted = [...plateSizes].sort((a, b) => b - a);
    sorted.forEach((plate) => {
      const count = plateCounts[plate] ?? 0;
      for (let i = 0; i < count; i += 1) {
        stack.push(plate);
      }
    });
    return stack;
  }, [plateCounts, plateSizes]);

  function changePlateCount(plate: number, delta: number) {
    setPlateCounts((prev) => {
      const next = { ...prev };
      const current = next[plate] ?? 0;
      const updated = current + delta;
      if (updated <= 0) {
        delete next[plate];
      } else {
        next[plate] = updated;
      }
      return next;
    });
  }

  function clear() {
    setPlateCounts({});
    setShowCustomInput(false);
    setCustomPlate("");
    setBarType("standard");
  }

  function addCustomPlate() {
    const value = Number(customPlate);
    if (!Number.isFinite(value) || value <= 0) return;
    const rounded = roundToNearestHalf(value);
    setPlateSizes((prev) =>
      prev.includes(rounded) ? prev : [...prev, rounded].sort((a, b) => b - a)
    );
    changePlateCount(rounded, 1);
    setCustomPlate("");
    setShowCustomInput(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-2 sm:p-3">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-[#1c1c24]/98 shadow-2xl p-3 sm:p-4 animate-in slide-in-from-bottom-4 fade-in duration-200 max-h-[88vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <button onClick={clear} className="text-sm font-semibold text-red-400">
            Clear
          </button>
          <div className="text-center">
            <p className="text-sm sm:text-base font-semibold text-white">Plate Calculator</p>
            <p className="text-xs text-zinc-400 mt-0.5">Initial Weight: {formatWeight(initialWeight)} lbs</p>
          </div>
          <button onClick={() => onSave(total)} className="text-sm font-semibold text-red-300">
            Save
          </button>
        </div>

        <div className="mt-3 rounded-2xl border border-zinc-700 bg-[#17171f] p-3">
          <p className="text-center text-3xl sm:text-4xl font-bold text-white tabular-nums">{formatWeight(total)} lbs</p>
          <p className="text-center text-xs text-zinc-400 mt-1">
            Bar {formatWeight(barWeight)} + Plates {formatWeight(platesTotal)} + Initial {formatWeight(initialWeight)}
          </p>

          <div className="mt-3 flex items-center justify-center gap-1">
            <PlateStack plates={visualPerSide} side="left" />
            <div className="h-2 w-14 sm:w-20 rounded-full bg-zinc-400" />
            <div className="h-4 w-2.5 rounded bg-zinc-200" />
            <div className="h-2 w-14 sm:w-20 rounded-full bg-zinc-400" />
            <PlateStack plates={visualPerSide} side="right" />
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">Add Plates (+lbs per side)</p>
          <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory">
            {plateSizes.map((plate) => {
              const count = plateCounts[plate] ?? 0;
              return (
                <div
                  key={plate}
                  className="snap-start shrink-0 w-[132px] rounded-xl border border-zinc-700 bg-zinc-900/70 px-2 py-2"
                >
                  <div className="text-center mb-2">
                    <p className="text-sm font-semibold text-white">{formatWeight(plate)} lb</p>
                    <p className="text-xs text-zinc-400">{count} por lado</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => changePlateCount(plate, -1)}
                      className="h-10 rounded-lg border border-zinc-600 bg-zinc-800 text-lg font-bold text-zinc-200 active:scale-[0.98]"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => changePlateCount(plate, 1)}
                      className="h-10 rounded-lg border border-red-500/70 bg-red-500/20 text-lg font-bold text-red-200 active:scale-[0.98]"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setShowCustomInput((prev) => !prev)}
            className="mt-2 h-10 w-full rounded-xl border border-dashed border-zinc-600 text-zinc-400 text-sm font-semibold"
          >
            Add custom plate (+)
          </button>
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
                className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 h-10"
              >
                Add
              </button>
            </div>
          )}
        </div>

        <div className="mt-4">
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
                    ? "bg-red-600/80 border-red-500 text-white"
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
