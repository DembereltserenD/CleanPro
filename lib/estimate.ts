// ============================================================
// lib/estimate.ts
// The hybrid brain: AI describes -> this decides instant vs manual.
// ============================================================
import {
  PRICE,
  STAIN_SURCHARGE,
  CONFIDENCE_THRESHOLD,
  RANGE_SPREAD,
  normalizeSeats,
  type Material,
  type StainLevel,
} from "../config/pricing";

export type Analysis = {
  material: Material;
  seats: number;
  stain_level: StainLevel;
  confidence: number; // 0..1
  description?: string;
};

export type EstimateResult =
  | { mode: "instant"; min: number; max: number }
  | { mode: "manual"; reason: string };

export function buildEstimate(a: Analysis): EstimateResult {
  const material = (a.material ?? "unknown") as Material;
  const seats = normalizeSeats(a.seats);
  const stain = (a.stain_level ?? "none") as StainLevel;

  const base = PRICE[material]?.[seats];

  if (material === "unknown" || base == null) {
    return { mode: "manual", reason: "Material/size could not be priced automatically." };
  }
  if (typeof a.confidence !== "number" || a.confidence < CONFIDENCE_THRESHOLD) {
    return { mode: "manual", reason: "AI confidence too low for an instant quote." };
  }

  const surcharge = STAIN_SURCHARGE[stain] ?? 0;
  const mid = base + surcharge;
  const min = Math.round((mid * (1 - RANGE_SPREAD)) / 1000) * 1000;
  const max = Math.round((mid * (1 + RANGE_SPREAD)) / 1000) * 1000;

  return { mode: "instant", min, max };
}
