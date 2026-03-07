"use client";

import { useMemo, useState } from "react";

import { displayFromLbs, formatWeight, lbsFromDisplay, type WeightUnit } from "@/lib/units";

type BarType = "standard" | "short" | "ez" | "none";
type PlateMode = "double_side" | "single_side";

const PLATE_OPTIONS = [45, 35, 25, 22, 10, 5, 2.5] as const;

function roundToNearestHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function plateHeight(plate: number): number {
  if (plate >= 45) return 64;
  if (plate >= 35) return 58;
  if (plate >= 25) return 52;
  if (plate >= 22) return 48;
  if (plate >= 10) return 40;
  if (plate >= 5) return 32;
  return 28;
}

function plateColor(plate: number): string {
  if (plate >= 45) return "bg-zinc-200";
  if (plate >= 35) return "bg-zinc-300";
  if (plate >= 25) return "bg-red-300";
  if (plate >= 22) return "bg-red-400";
  if (plate >= 10) return "bg-zinc-400";
  return "bg-zinc-500";
}

function PlateStack({ plates, side, unit }: { plates: number[]; side: "left" | "right"; unit: WeightUnit }) {
  const maxVisible = 7;
  const visible = plates.slice(0, maxVisible);
  const hiddenCount = Math.max(0, plates.length - maxVisible);
  const sideClass = side === "left" ? "flex-row-reverse" : "flex-row";

  return (
    <div className={`flex items-end ${sideClass} gap-0.5 min-w-[58px]`}>
      {hiddenCount > 0 && <span className="text-[10px] text-zinc-400 px-1">+{hiddenCount}</span>}
      {visible.map((plate, idx) => (
        
        <div
          key={`${side}-${plate}-${idx}`}
          className={`w-3 rounded-sm border border-zinc-800 ${plateColor(plate)}`}
          style={{ height: `${plateHeight(plate)}px` }}
          title={`${formatWeight(displayFromLbs(plate, unit) ?? plate)} ${unit}`}
        />
      ))}
    </div>
  );
}

export function PlateCalculatorModal({
  shortBarWeight,
  unit,
  onUnitChange,
  onClose,
  onSave,
}: {
  shortBarWeight: number;
  unit: WeightUnit;
  onUnitChange: (unit: WeightUnit) => void;
  onClose: () => void;
  onSave: (weight: number) => void;
}) {
  const [barType, setBarType] = useState<BarType>("standard");
  const [plateMode, setPlateMode] = useState<PlateMode>("double_side");
  const [plateCounts, setPlateCounts] = useState<Record<number, number>>({});
  const [customPlateSizes, setCustomPlateSizes] = useState<number[]>([]);
  const [customPlate, setCustomPlate] = useState<string>("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  const barWeightLbs = useMemo(() => {
    if (barType === "standard") return 45;
    if (barType === "short") return shortBarWeight;
    if (barType === "ez") return 20;
    return 0;
  }, [barType, shortBarWeight]);

  const selectablePlates = useMemo(() => [...PLATE_OPTIONS, ...customPlateSizes], [customPlateSizes]);

  const platesPerSideTotal = useMemo(
    () => Object.entries(plateCounts).reduce((sum, [plate, count]) => sum + Number(plate) * count, 0),
    [plateCounts]
  );

  const platesTotal = plateMode === "double_side" ? platesPerSideTotal * 2 : platesPerSideTotal;

  const totalLbs = useMemo(() => roundToNearestHalf(barWeightLbs + platesTotal), [barWeightLbs, platesTotal]);

  const barWeightDisplay = useMemo(() => displayFromLbs(barWeightLbs, unit) ?? 0, [barWeightLbs, unit]);
  const platesTotalDisplay = useMemo(() => displayFromLbs(platesTotal, unit) ?? 0, [platesTotal, unit]);
  const totalDisplay = useMemo(() => displayFromLbs(totalLbs, unit) ?? 0, [totalLbs, unit]);

  const visualPerSide = useMemo(() => {
    const stack: number[] = [];
    const sorted = [...selectablePlates].sort((a, b) => b - a);
    sorted.forEach((plate) => {
      const count = plateCounts[plate] ?? 0;
      for (let i = 0; i < count; i += 1) stack.push(plate);
    });
    return stack;
  }, [plateCounts, selectablePlates]);

  function changePlateCount(plate: number, delta: number) {
    setPlateCounts((prev) => {
      const next = { ...prev };
      const current = next[plate] ?? 0;
      const updated = current + delta;
      if (updated <= 0) delete next[plate];
      else next[plate] = updated;
      return next;
    });
  }

  function clear() {
    setPlateCounts({});
    setCustomPlateSizes([]);
    setShowCustomInput(false);
    setCustomPlate("");
    setBarType("standard");
    setPlateMode("double_side");
  }

  function addCustomPlate() {
    const value = Number(customPlate);
    if (!Number.isFinite(value) || value <= 0) return;
    const normalizedLbs = lbsFromDisplay(value, unit);
    if (normalizedLbs === null) return;
    const rounded = roundToNearestHalf(normalizedLbs);
    if (!PLATE_OPTIONS.includes(rounded as (typeof PLATE_OPTIONS)[number])) {
      setCustomPlateSizes((prev) =>
        prev.includes(rounded) ? prev : [...prev, rounded].sort((a, b) => b - a)
      );
    }
    changePlateCount(rounded, 1);
    setCustomPlate("");
    setShowCustomInput(false);
  }

  return (
    <div className="today-plate-overlay fixed inset-0 z-50 bg-black/25 flex items-end sm:items-center justify-center p-1 sm:p-3">
      <div className="today-plate-panel w-full max-w-lg rounded-2xl border border-zinc-700 bg-[#1c1c24]/98 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-200 h-[88dvh] sm:h-auto sm:max-h-[82vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between gap-3 px-3 pt-3 pb-2 sm:px-4 sm:pt-4 sm:pb-3 border-b border-zinc-800 bg-[#1c1c24]/98 sticky top-0 z-10">
          <button onClick={clear} className="text-sm font-semibold text-red-400">
            Clear
          </button>
          <div className="text-center">
            <p className="text-sm sm:text-base font-semibold text-white">Plate Calculator</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Starts at Standard Bar ({formatWeight(displayFromLbs(45, unit) ?? 45)} {unit})
            </p>
          </div>
          <button onClick={() => onSave(totalLbs)} className="text-sm font-semibold text-red-300">
            Save
          </button>
        </div>

        <div className="overflow-y-auto px-3 pb-4 sm:px-4 sm:pb-5">
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onUnitChange("lb")}
              className={`rounded-full px-3 py-2 text-xs font-semibold border ${unit === "lb" ? "bg-red-600/80 border-red-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-300"}`}
            >
              lb
            </button>
            <button
              type="button"
              onClick={() => onUnitChange("kg")}
              className={`rounded-full px-3 py-2 text-xs font-semibold border ${unit === "kg" ? "bg-red-600/80 border-red-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-300"}`}
            >
              kg
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPlateMode("double_side")}
              className={`rounded-full px-3 py-2 text-xs font-semibold border ${plateMode === "double_side" ? "bg-red-600/80 border-red-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-300"}`}
            >
              Incluir dos platos
            </button>
            <button
              type="button"
              onClick={() => setPlateMode("single_side")}
              className={`rounded-full px-3 py-2 text-xs font-semibold border ${plateMode === "single_side" ? "bg-red-600/80 border-red-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-300"}`}
            >
              Solo uno
            </button>
          </div>

          <div className="mt-3 rounded-2xl border border-zinc-700 bg-[#17171f] p-3">
            <p className="text-center text-3xl sm:text-4xl font-bold text-white tabular-nums">{formatWeight(totalDisplay)} {unit}</p>
            <p className="text-center text-xs text-zinc-400 mt-1">
              Bar {formatWeight(barWeightDisplay)} + Plates {formatWeight(platesTotalDisplay)}
            </p>

            <div className="mt-3 flex items-center justify-center gap-1">
              {plateMode === "double_side" ? <PlateStack plates={visualPerSide} side="left" unit={unit} /> : null}
              <div className="h-2 w-14 sm:w-20 rounded-full bg-zinc-400" />
              <div className="h-4 w-2.5 rounded bg-zinc-200" />
              <div className="h-2 w-14 sm:w-20 rounded-full bg-zinc-400" />
              <PlateStack plates={visualPerSide} side="right" unit={unit} />
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">
              Add Plates (+{unit} {plateMode === "double_side" ? "per side" : "total"})
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory">
              {selectablePlates.map((plate) => {
                const count = plateCounts[plate] ?? 0;
                const plateDisplay = displayFromLbs(plate, unit) ?? plate;
                return (
                  <div key={plate} className="snap-start shrink-0 w-[124px] rounded-xl border border-zinc-700 bg-zinc-900/70 px-2 py-2">
                    <div className="text-center mb-2">
                      <p className="text-sm font-semibold text-white">{formatWeight(plateDisplay)} {unit}</p>
                      <p className="text-xs text-zinc-400">{count} {plateMode === "double_side" ? "por lado" : "total"}</p>
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

              <button
                type="button"
                onClick={() => setShowCustomInput((prev) => !prev)}
                className="snap-start shrink-0 w-[124px] h-[92px] rounded-xl border border-dashed border-zinc-600 text-zinc-400 text-sm font-semibold bg-zinc-900/60"
              >
                Add custom
              </button>
            </div>

            {showCustomInput && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  step={unit === "kg" ? 1 : 0.5}
                  min={unit === "kg" ? 1 : 0.5}
                  value={customPlate}
                  onChange={(e) => setCustomPlate(e.target.value)}
                  placeholder={`Custom plate (${unit})`}
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
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">Bar Type ({unit})</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: "standard" as const, label: `Standard Bar (${formatWeight(displayFromLbs(45, unit) ?? 45)} ${unit})` },
                { type: "short" as const, label: `Short Bar (${formatWeight(displayFromLbs(shortBarWeight, unit) ?? shortBarWeight)} ${unit})` },
                { type: "ez" as const, label: `EZ Bar (${formatWeight(displayFromLbs(20, unit) ?? 20)} ${unit})` },
                { type: "none" as const, label: `None (0 ${unit})` },
              ].map((option) => {
                const active = barType === option.type;
                return (
                  <button
                    key={option.type}
                    type="button"
                    onClick={() => setBarType(option.type)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold border ${
                      active ? "bg-red-600/80 border-red-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-300"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        <div className="border-t border-zinc-800 bg-[#1c1c24]/98 px-3 py-3 pb-[calc(30px+env(safe-area-inset-bottom))] sm:px-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 rounded-xl border border-zinc-500 bg-zinc-900 text-zinc-50 text-sm font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.42)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
