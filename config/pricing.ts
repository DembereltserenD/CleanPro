// ============================================================
// config/pricing.ts
// YOUR real prices live here. The AI never invents prices —
// it only describes the sofa; this file turns that into money.
// Edit these numbers to match your actual business.
// Currency: MNT (₮). Adjust freely.
// ============================================================

export type Material = "fabric" | "leather" | "suede" | "microfiber" | "unknown";
export type StainLevel = "none" | "light" | "moderate" | "heavy";

// Base price by material and seat count.
// seats key: 1, 2, 3, 4, 5+ (use 5 for 5-or-more)
export const PRICE: Record<Material, Record<number, number | undefined>> = {
  fabric:     { 1: 25000, 2: 40000, 3: 55000, 4: 70000, 5: 90000 },
  microfiber: { 1: 28000, 2: 45000, 3: 60000, 4: 78000, 5: 100000 },
  leather:    { 1: 35000, 2: 55000, 3: 75000, 4: 95000, 5: 120000 },
  suede:      { 1: 40000, 2: 62000, 3: 85000, 4: 110000, 5: 140000 },
  unknown:    {}, // unknown material => always manual review
};

// Extra charge added on top of base, by how dirty it is.
export const STAIN_SURCHARGE: Record<StainLevel, number> = {
  none:     0,
  light:    8000,
  moderate: 18000,
  heavy:    35000,
};

// Below this AI confidence we don't show an auto price — route to manual review.
export const CONFIDENCE_THRESHOLD = 0.7;

// How wide the shown range is around the computed midpoint (±15%).
export const RANGE_SPREAD = 0.15;

// Normalize "5+" or weird seat numbers into our table keys.
export function normalizeSeats(seats: number): number {
  if (!Number.isFinite(seats) || seats < 1) return 3; // sane default
  return Math.min(Math.max(Math.round(seats), 1), 5);
}
