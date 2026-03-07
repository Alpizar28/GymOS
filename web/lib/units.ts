export type WeightUnit = "lb" | "kg";

const LB_PER_KG = 2.2046226218;

export function lbToKg(value: number): number {
  return value / LB_PER_KG;
}

export function kgToLb(value: number): number {
  return value * LB_PER_KG;
}

export function roundToStep(value: number, step = 0.5): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value / step) * step;
}

export function formatWeight(value: number, digits = 1): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

export function displayFromLbs(valueLbs: number | null, unit: WeightUnit): number | null {
  if (valueLbs === null || valueLbs === undefined) return null;
  if (unit === "lb") return valueLbs;
  return Math.round(lbToKg(valueLbs));
}

export function lbsFromDisplay(value: number | null, unit: WeightUnit): number | null {
  if (value === null || value === undefined) return null;
  if (unit === "lb") return value;
  return kgToLb(Math.round(value));
}

export function unitLabel(unit: WeightUnit, short = false): string {
  if (unit === "kg") return short ? "kg" : "kilogramos";
  return short ? "lb" : "libras";
}
