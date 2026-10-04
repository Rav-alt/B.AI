// Router constants. All guesses are written down here so they're easy to find and tune.
// None of this comes from the data: the GTFS feed has no timetables, so times are estimates.
import type { Mode, Prefs } from "@/lib/types";

/** Average walking speed, metres per minute (≈ 4.8 km/h). */
export const WALK_M_PER_MIN = 80;
/** Streets aren't straight lines: walking distance ≈ straight-line distance × this. */
export const WALK_DETOUR = 1.3;

/** Walking radius (metres of walking) to look for stops near the origin/destination… */
export const WALK_RADIUS_M = 600;
/** …and the wider radius tried when the first one finds no itinerary. */
export const WALK_RADIUS_WIDE_M = 1000;
/** A trip this short (metres of walking) is also offered as "just walk". */
export const WALK_ONLY_MAX_M = 1200;

/**
 * Average door-to-door speeds in km/h, including stops and Metro Manila traffic.
 * Rough on purpose: answers say "mga 25 minuto", never a precise time.
 */
export const SPEED_KMH: Record<Mode, number> = { train: 30, bus: 15, jeep: 12, uv: 20 };

/** Shortest ride worth taking, metres. Shorter "hops" are walked instead. */
export const MIN_RIDE_M = 500;

/** An answer with rides may walk at most this share of what walking straight there would take. */
export const MAX_WALK_SHARE = 0.6;

/** Most rides a trip may use (2 transfers). */
export const MAX_RIDES = 3;

/** Cost weights. Cost is in "minutes of riding" units. */
export interface Weights {
  /** Multiplier for walking minutes. */
  walk: number;
  /** Added for every ride, first one included: waiting and getting on. Stops 500 m "hop" rides from looking cheap. */
  board: number;
  /** Penalty for each transfer (boarding after the first ride), minutes. */
  transfer: number;
}

export const DEFAULT_WEIGHTS: Weights = { walk: 2, board: 3, transfer: 8 };

export function weightsFor(prefs: Prefs = {}): Weights {
  return {
    walk: prefs.lessWalking ? 4 : DEFAULT_WEIGHTS.walk,
    board: DEFAULT_WEIGHTS.board,
    transfer: prefs.fewestTransfers ? 25 : DEFAULT_WEIGHTS.transfer,
  };
}

/** Which modes may be ridden under these preferences. */
export function modeAllowed(mode: Mode, prefs: Prefs = {}): boolean {
  if (prefs.trainsOnly) return mode === "train";
  if (prefs.avoidTrains) return mode !== "train";
  return true;
}

export const walkMetersFromStraight = (straightM: number): number => Math.round(straightM * WALK_DETOUR);
export const walkMinutes = (walkM: number): number => walkM / WALK_M_PER_MIN;
export const rideMinutes = (mode: Mode, meters: number): number => meters / 1000 / SPEED_KMH[mode] * 60;
