// Shared data types for B.AI. Every type is a zod schema first, so data loaded from disk
// (network.json, corrections.json) and data coming from the AI can be validated at runtime.
import { z } from "zod";

// ---------------------------------------------------------------------------
// Basics
// ---------------------------------------------------------------------------

/** Ride modes. Walking is not a "mode" of a route, only of a leg. */
export const ModeSchema = z.enum(["train", "bus", "jeep", "uv"]);
export type Mode = z.infer<typeof ModeSchema>;

export const LegModeSchema = z.union([ModeSchema, z.literal("walk")]);
export type LegMode = z.infer<typeof LegModeSchema>;

/** [lat, lon], rounded to 5 decimals (~1 m) in network.json. */
export const LatLonSchema = z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]);
export type LatLon = z.infer<typeof LatLonSchema>;

const Index = z.number().int().nonnegative();

// ---------------------------------------------------------------------------
// Network (the build output in data/generated/network.json)
// ---------------------------------------------------------------------------

export const StopSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  lat: z.number(),
  lon: z.number(),
});
export type Stop = z.infer<typeof StopSchema>;

/**
 * A pattern is one route ridden in one direction: an ordered list of stops.
 * The router may only ride a pattern forward (from a lower to a higher stop position).
 * A GTFS route with both directions becomes two patterns.
 */
export const PatternSchema = z.object({
  /** Unique id. Same as the GTFS route_id when the route has one direction, else `${routeId}:${n}`. */
  id: z.string().min(1),
  routeId: z.string().min(1),
  mode: ModeSchema,
  /** Train line label, e.g. "LRT-1". Only for trains. */
  line: z.string().optional(),
  /** Cleaned signboard text, e.g. "Baclaran – Blumentritt". For trains, the line endpoints. */
  name: z.string().min(1),
  /** The "via …" part of the signboard, if any. */
  via: z.string().optional(),
  /** The name exactly as it appears in the source, kept for fuzzy matching. */
  rawName: z.string(),
  /** The two signboard ends, when the name could be split. */
  endpoints: z.tuple([z.string(), z.string()]).optional(),
  /** Which endpoint this direction heads to ("papuntang …"). Missing when it couldn't be worked out. */
  towards: z.string().optional(),
  /** Indices into `network.stops`, in riding order. */
  stops: z.array(Index).min(2),
  /** Cumulative distance in metres at each stop (same length as `stops`, never decreasing). */
  dist: z.array(Index),
  /** Detailed line for the map, when the source has a shape. Otherwise draw stop to stop. */
  shape: z.array(LatLonSchema).optional(),
  /** For each stop, the index of its point in `shape` (same length as `stops`). */
  shapeIdx: z.array(Index).optional(),
  /** True when the pattern starts and ends at (almost) the same place. */
  loop: z.boolean(),
  source: z.enum(["gtfs", "corrections"]),
});
export type Pattern = z.infer<typeof PatternSchema>;

/** A walking link between two nearby stops: [stopIndexA, stopIndexB, metres], with A < B. Usable both ways. */
export const TransferSchema = z.tuple([Index, Index, Index]);
export type Transfer = z.infer<typeof TransferSchema>;

export const NetworkSchema = z
  .object({
    version: z.literal(1),
    builtAt: z.string(),
    feed: z.object({ name: z.string(), note: z.string() }),
    params: z.object({ transferRadiusM: z.number() }),
    stops: z.array(StopSchema),
    patterns: z.array(PatternSchema),
    transfers: z.array(TransferSchema),
  })
  .superRefine((net, ctx) => {
    const n = net.stops.length;
    net.patterns.forEach((p, i) => {
      const at = (msg: string) => ctx.addIssue({ code: "custom", path: ["patterns", i], message: `${p.id}: ${msg}` });
      if (p.dist.length !== p.stops.length) at("dist and stops lengths differ");
      if (p.stops.some((s) => s >= n)) at("stop index out of range");
      if (p.dist.some((d, k) => k > 0 && d < (p.dist[k - 1] ?? 0))) at("dist decreases");
      if (p.shape && p.shapeIdx?.length !== p.stops.length) at("shapeIdx length differs from stops");
      if (p.shape && p.shapeIdx?.some((k) => k >= (p.shape?.length ?? 0))) at("shapeIdx out of range");
    });
    net.transfers.forEach(([a, b], i) => {
      if (a >= b || b >= n) ctx.addIssue({ code: "custom", path: ["transfers", i], message: "bad transfer indices" });
    });
  });
export type Network = z.infer<typeof NetworkSchema>;

// ---------------------------------------------------------------------------
// Router output (Phase 2 fills these; the UI and AI read them)
// ---------------------------------------------------------------------------

export const PlaceRefSchema = z.object({
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  /** Set when the place is a stop in the network. */
  stopId: z.string().optional(),
});
export type PlaceRef = z.infer<typeof PlaceRefSchema>;

export const RideLegSchema = z.object({
  mode: ModeSchema,
  patternId: z.string(),
  /** Signboard text (or train line endpoints). */
  routeName: z.string(),
  line: z.string().optional(),
  via: z.string().optional(),
  towards: z.string().optional(),
  boardStop: PlaceRefSchema,
  alightStop: PlaceRefSchema,
  /** Number of stops ridden (alight index − board index). */
  stopCount: z.number().int().positive(),
  distanceKm: z.number().nonnegative(),
  estMinutes: z.number().nonnegative(),
  polyline: z.array(LatLonSchema).min(2),
});
export type RideLeg = z.infer<typeof RideLegSchema>;

export const WalkLegSchema = z.object({
  mode: z.literal("walk"),
  from: PlaceRefSchema,
  to: PlaceRefSchema,
  meters: z.number().nonnegative(),
  estMinutes: z.number().nonnegative(),
  polyline: z.array(LatLonSchema).min(2),
});
export type WalkLeg = z.infer<typeof WalkLegSchema>;

export const LegSchema = z.discriminatedUnion("mode", [
  RideLegSchema.extend({ mode: z.literal("train") }),
  RideLegSchema.extend({ mode: z.literal("bus") }),
  RideLegSchema.extend({ mode: z.literal("jeep") }),
  RideLegSchema.extend({ mode: z.literal("uv") }),
  WalkLegSchema,
]);
export type Leg = z.infer<typeof LegSchema>;

export const ItinerarySchema = z.object({
  legs: z.array(LegSchema).min(1),
  totalMinutes: z.number().nonnegative(),
  transfers: z.number().int().nonnegative(),
  walkMeters: z.number().nonnegative(),
});
export type Itinerary = z.infer<typeof ItinerarySchema>;

// ---------------------------------------------------------------------------
// Router input and results (Phase 2)
// ---------------------------------------------------------------------------

/** Rider preferences, as parsed from the question (all optional). */
export const PrefsSchema = z.object({
  fewestTransfers: z.boolean().optional(),
  lessWalking: z.boolean().optional(),
  trainsOnly: z.boolean().optional(),
  avoidTrains: z.boolean().optional(),
});
export type Prefs = z.infer<typeof PrefsSchema>;

/**
 * Outcome of planTrip().
 * - ok: at least one itinerary
 * - no_stops_near_origin / no_stops_near_destination: nothing within the widest walking radius
 * - no_route: stops exist at both ends but no ride connects them within 2 transfers
 */
export const PlanStatusSchema = z.enum(["ok", "no_stops_near_origin", "no_stops_near_destination", "no_route"]);
export type PlanStatus = z.infer<typeof PlanStatusSchema>;

export const PlanResultSchema = z.object({
  status: PlanStatusSchema,
  /** Best first, at most 3, each using a different set of signboards. */
  itineraries: z.array(ItinerarySchema).max(3),
  /** The walking radius (metres of walking) that produced the result: 600, or 1000 when widened. */
  walkRadiusM: z.number().positive(),
});
export type PlanResult = z.infer<typeof PlanResultSchema>;

export const CandidateSchema = z.object({
  mode: ModeSchema.optional(),
  signboard: z.string().min(1),
});
export type Candidate = z.infer<typeof CandidateSchema>;

/**
 * Why a candidate got its verdict (the AI turns this into words).
 * - passes_both: boards near the origin and later reaches the destination → yes
 * - wrong_direction: passes both places, but reaches the destination first (the other direction might work)
 * - ride_too_short: right direction, but the ride would be shorter than the walking around it (not worth it)
 * - origin_only: passes near the origin but never near the destination afterwards
 * - destination_only: passes near the destination but not near the origin
 * - passes_neither: the route exists but goes nowhere near either place
 * - no_such_route: no route in the data has that signboard (and mode)
 */
export const CheckReasonSchema = z.enum([
  "passes_both",
  "wrong_direction",
  "ride_too_short",
  "origin_only",
  "destination_only",
  "passes_neither",
  "no_such_route",
]);
export type CheckReason = z.infer<typeof CheckReasonSchema>;

export const CandidateVerdictSchema = z.object({
  candidate: CandidateSchema,
  verdict: z.enum(["yes", "no"]),
  reason: CheckReasonSchema,
  /** Signboards in the data that matched, best first (at most 5), each with its own reason. */
  matchedRoutes: z
    .array(
      z.object({
        patternId: z.string(),
        mode: ModeSchema,
        routeName: z.string(),
        towards: z.string().optional(),
        reason: CheckReasonSchema,
      }),
    )
    .max(5),
  /** For a yes: walk → ride → walk on the best matching route. */
  itinerary: ItinerarySchema.optional(),
});
export type CandidateVerdict = z.infer<typeof CandidateVerdictSchema>;

export const CheckResultSchema = z.object({
  verdicts: z.array(CandidateVerdictSchema),
  /** Only when no candidate is a yes: the best planTrip() result instead. */
  alternative: PlanResultSchema.optional(),
  walkRadiusM: z.number().positive(),
});
export type CheckResult = z.infer<typeof CheckResultSchema>;
