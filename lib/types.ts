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
  /**
   * When no stop is within walking distance of one end: the nearest stop in the data on that side
   * (up to NEAREST_STOP_MAX_M away), so B.AI can say "the nearest stop is ~1.4 km away" and offer a
   * route from/to it.
   */
  nearest: z.object({ side: z.enum(["origin", "destination"]), stop: PlaceRefSchema, meters: z.number().nonnegative() }).optional(),
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

// ---------------------------------------------------------------------------
// Geocoding results (Phase 3)
// ---------------------------------------------------------------------------

/** A place the geocoder resolved, and where the answer came from. */
export const GeoPlaceSchema = PlaceRefSchema.extend({
  source: z.enum(["landmark", "stop", "nominatim", "device"]),
  /** Short area label to tell similar names apart, e.g. "Taguig City". */
  area: z.string().optional(),
});
export type GeoPlace = z.infer<typeof GeoPlaceSchema>;

/**
 * - found: one place
 * - ambiguous: 2–5 places far apart that all fit; B.AI asks "Alin dito?"
 * - not_found: no_match (nothing fits) or search_unavailable (OpenStreetMap search off or failing)
 * - outside_area: a real place, but outside Metro Manila (B.AI only covers Metro Manila)
 */
export const GeocodeResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("found"), place: GeoPlaceSchema }),
  z.object({ status: z.literal("ambiguous"), choices: z.array(GeoPlaceSchema).min(2).max(5) }),
  z.object({ status: z.literal("not_found"), reason: z.enum(["no_match", "search_unavailable"]) }),
  z.object({ status: z.literal("outside_area"), place: GeoPlaceSchema }),
]);
export type GeocodeResult = z.infer<typeof GeocodeResultSchema>;

// ---------------------------------------------------------------------------
// Intent (Phase 4): what the user asked, as parsed by Gemini or the simple parser
// ---------------------------------------------------------------------------

export const PlaceQuerySchema = z.union([
  z.object({ text: z.string().min(1).max(200) }).strict(),
  z.object({ useCurrentLocation: z.literal(true) }).strict(),
]);
export type PlaceQuery = z.infer<typeof PlaceQuerySchema>;

export const IntentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("plan_trip"), origin: PlaceQuerySchema, destination: PlaceQuerySchema, prefs: PrefsSchema }),
  z.object({
    type: z.literal("check_routes"),
    origin: PlaceQuerySchema,
    destination: PlaceQuerySchema,
    candidates: z.array(CandidateSchema).min(1).max(5),
    prefs: PrefsSchema,
  }),
  z.object({ type: z.literal("need_more_info"), missing: z.array(z.enum(["origin", "destination"])).min(1) }),
  z.object({ type: z.literal("off_topic") }),
]);
export type Intent = z.infer<typeof IntentSchema>;

/** Reply language. "fil" = casual Taglish (the default), "en" = English. */
export const LangSchema = z.enum(["fil", "en"]);
export type Lang = z.infer<typeof LangSchema>;

// ---------------------------------------------------------------------------
// /api/chat request and response
// ---------------------------------------------------------------------------

export const PickedPlaceSchema = z.object({ name: z.string().min(1).max(200), lat: z.number(), lon: z.number(), stopId: z.string().optional() });

export const ChatRequestSchema = z
  .object({
    /** Free-text question. Either this or from + to. */
    message: z.string().trim().min(1).max(500).optional(),
    /** Fallback form (no AI): plain place names, preferences, and "from my location". */
    from: z.string().trim().min(1).max(200).optional(),
    to: z.string().trim().min(1).max(200).optional(),
    prefs: PrefsSchema.optional(),
    fromCurrentLocation: z.boolean().optional(),
    /** Recent turns, oldest first, so "España" can answer "Saan ka papunta?". */
    history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(1000) })).max(6).default([]),
    /** Browser location, only when the user tapped "use my location". Never stored. */
    location: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }).optional(),
    /** A place the user picked from "Alin dito?" choices, sent back with the same question. */
    picked: z.object({ origin: PickedPlaceSchema.optional(), destination: PickedPlaceSchema.optional() }).default({}),
  })
  .refine((r) => r.message || ((r.from || r.fromCurrentLocation) && r.to), { message: "send a message, or both from and to" });
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatRequestInput = z.input<typeof ChatRequestSchema>;

export const ChatKindSchema = z.enum([
  "route", // planTrip answer (itineraries for the map)
  "check", // checkRoutes answer
  "no_route", // places found, nothing connects them
  "ask_place", // ambiguous place: pick one of `choices`
  "place_not_found",
  "need_more_info", // origin or destination missing
  "need_location", // "use my location" without coordinates
  "off_topic",
  "fallback_form", // AI unavailable and the question couldn't be read: show From/To boxes
]);
export type ChatKind = z.infer<typeof ChatKindSchema>;

export const ChatResponseSchema = z.object({
  kind: ChatKindSchema,
  /**
   * Reply text, markdown-light (**bold**). For route/check answers this is the short lead line shown
   * above the step list ("Ito ang pinakamadali: mga **22 min**…"); the steps come from `plan`/`check`.
   */
  text: z.string().min(1),
  lang: LangSchema,
  origin: GeoPlaceSchema.optional(),
  destination: GeoPlaceSchema.optional(),
  plan: PlanResultSchema.optional(),
  check: CheckResultSchema.optional(),
  /** For ask_place: which end is ambiguous, and the options. */
  choices: z.object({ field: z.enum(["origin", "destination"]), options: z.array(GeoPlaceSchema).min(2) }).optional(),
  /**
   * For place_not_found: which place to ask about again, and the question as a plain From/To request
   * (no AI needed) so the reply, an address or a pin on the map, can be sent with the other place kept.
   */
  followUp: z
    .object({
      field: z.enum(["origin", "destination"]),
      query: z.string(),
      request: z.object({
        from: z.string().max(200).optional(),
        fromCurrentLocation: z.boolean().optional(),
        to: z.string().max(200),
        prefs: PrefsSchema.optional(),
        picked: z.object({ origin: PickedPlaceSchema.optional(), destination: PickedPlaceSchema.optional() }),
      }),
    })
    .optional(),
  /** The standard data disclaimer; present on every route/check/no_route answer. */
  disclaimer: z.string().optional(),
  /** Who wrote `text`: Gemini, or the plain template. */
  writer: z.enum(["ai", "template"]),
  /** Why the template was used, when AI was expected. */
  fallbackReason: z.enum(["no_key", "rate_limited", "ai_error", "answer_rejected"]).optional(),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
