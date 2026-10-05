// Local place matching: the curated landmarks first, then stop names from the network.
// Pure and synchronous. Nominatim (the slow, rate-limited fallback) lives in nominatim.ts.
import type { GeocodeResult, GeoPlace, Network } from "@/lib/types";
import { normalizeText, tokens, wordMatches } from "@/lib/text";
import type { Landmark } from "./landmarks";
import { clusterByDistance } from "./cluster";
import { haversineM } from "./haversine";

/** Words around a place name in a question: "nasa Cubao ako", "malapit sa MOA". */
export const FILLER = new Set([
  "nasa", "sa", "ako", "ko", "kami", "dito", "diyan", "near", "malapit", "the", "at", "in", "ng", "na", "po",
  "papuntang", "papunta", "pupunta", "galing", "from", "to", "going", "ang", "yung", "area", "banda", "around",
]);
/** Words that help rank but don't identify a place on their own. */
const GENERIC = new Set([
  "intersection", "ave", "avenue", "st", "street", "blvd", "boulevard", "rd", "road", "dr", "drive", "city",
  "manila", "lungsod", "station", "stn", "corner", "cor", "ext", "extension", "metro",
]);

/** Places closer than this are "the same place" (one corner, one mall). */
export const SAME_PLACE_M = 600;
/** Candidates within this many points of the best one are shown as choices. */
const SCORE_WINDOW = 15;

interface Scored {
  place: GeoPlace;
  lat: number;
  lon: number;
  score: number;
}

const areaOf = (stopName: string): string | undefined => {
  // Stop names often end "…, Marikina City, Manila": the city is the useful part, not "Manila".
  const parts = stopName.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length > 2 && /^manila+$/i.test(parts.at(-1)!)) parts.pop();
  return parts.length > 1 ? parts.at(-1) : undefined;
};

/** Score how well the question words fit a name: all strong words must match; then coverage of the name. */
function scoreText(strongQ: string[], text: string): number {
  const ctoks = tokens(text);
  if (!strongQ.every((q) => ctoks.some((t) => wordMatches(q, t)))) return 0;
  const strongC = ctoks.filter((t) => !GENERIC.has(t));
  const covered = strongC.filter((t) => strongQ.some((q) => wordMatches(q, t))).length;
  return 50 + 40 * (strongC.length ? covered / strongC.length : 1);
}

function decide(cands: Scored[]): GeocodeResult {
  if (cands.length === 0) return { status: "not_found", reason: "no_match" };
  cands.sort((a, b) => b.score - a.score);
  const best = cands[0]!.score;
  const clusters = clusterByDistance(cands.filter((c) => c.score >= best - SCORE_WINDOW), SAME_PLACE_M);
  if (clusters.length === 1) return { status: "found", place: clusters[0]![0]!.place };
  return { status: "ambiguous", choices: clusters.slice(0, 5).map((c) => c[0]!.place) };
}

const landmarkPlace = (l: Landmark): GeoPlace => ({ name: l.name, lat: l.lat, lon: l.lon, source: "landmark" });

/** Bare station names that are really long roads: "EDSA" alone shouldn't mean EDSA LRT station. */
const ROAD_NAMES = new Set(["edsa", "quezon", "taft ave"]);

interface StationName {
  stop: number;
  /** Normalized names that count as an exact match: "cubao mrt" and "cubao". */
  keys: string[];
}

const stationCache = new WeakMap<Network, StationName[]>();

/** Train stations, so "Guadalupe" or "Anonas" mean the station, not every street with that name. */
function stations(net: Network): StationName[] {
  let out = stationCache.get(net);
  if (out) return out;
  const idx = new Set(net.patterns.filter((p) => p.mode === "train").flatMap((p) => p.stops));
  out = [...idx].map((i) => {
    const full = normalizeText(net.stops[i]!.name);
    const bare = full.replace(/ (lrt|mrt)$/, "");
    return { stop: i, keys: bare !== full && !ROAD_NAMES.has(bare) ? [full, bare] : [full] };
  });
  stationCache.set(net, out);
  return out;
}

function stopPlace(net: Network, i: number): GeoPlace {
  const s = net.stops[i]!;
  const area = areaOf(s.name);
  return { name: s.name, lat: s.lat, lon: s.lon, stopId: s.id, source: "stop", ...(area ? { area } : {}) };
}

export function matchPlace(net: Network, landmarks: Landmark[], query: string): GeocodeResult {
  const q = tokens(query).filter((w) => !FILLER.has(w));
  if (q.length === 0) return { status: "not_found", reason: "no_match" };
  const key = q.join(" ");

  // 1. Exact landmark or station name wins outright ("Lawton" is the Manila one, full stop).
  const exact: Scored[] = landmarks
    .filter((l) => [l.name, ...l.aliases].some((n) => normalizeText(n) === key))
    .map((l) => ({ place: landmarkPlace(l), lat: l.lat, lon: l.lon, score: 100 }));
  for (const st of stations(net))
    if (st.keys.includes(key)) {
      const place = stopPlace(net, st.stop);
      exact.push({ place, lat: place.lat, lon: place.lon, score: 100 });
    }
  if (exact.length) return label(net, landmarks, decide(exact));

  // 2. Fuzzy: every strong question word must appear (typos and prefixes allowed).
  let strong = q.filter((w) => !GENERIC.has(w));
  if (strong.length === 0) strong = q;
  const cands: Scored[] = [];
  for (const l of landmarks) {
    const score = Math.max(...[l.name, ...l.aliases].map((n) => scoreText(strong, n)));
    if (score > 0) cands.push({ place: landmarkPlace(l), lat: l.lat, lon: l.lon, score: score + 10 });
  }
  net.stops.forEach((s, i) => {
    const score = scoreText(strong, s.name);
    if (score > 0) cands.push({ place: stopPlace(net, i), lat: s.lat, lon: s.lon, score });
  });
  return label(net, landmarks, decide(cands));
}

/** How far a "near …" label may be. */
const NEAR_LABEL_M = 1500;

/**
 * Choices like five "Quezon Avenue, Quezon City" stops are useless as a question, so each stop
 * choice gets the nearest landmark or station as its area ("near Quezon Memorial Circle").
 * Choices that still look identical are dropped.
 */
function label(net: Network, landmarks: Landmark[], r: GeocodeResult): GeocodeResult {
  if (r.status !== "ambiguous") return r;
  const named = [
    ...landmarks.map((l) => ({ name: l.name, lat: l.lat, lon: l.lon })),
    ...stations(net).map((st) => net.stops[st.stop]!),
  ];
  const seen = new Set<string>();
  const choices: GeoPlace[] = [];
  for (const c of r.choices) {
    let place = c;
    if (c.source === "stop") {
      let best: { name: string; d: number } | undefined;
      for (const n of named) {
        const d = haversineM(c.lat, c.lon, n.lat, n.lon);
        if (d <= NEAR_LABEL_M && (!best || d < best.d) && n.name !== c.name) best = { name: n.name, d };
      }
      if (best) place = { ...c, area: `near ${best.name}` };
    }
    const key = `${place.name}|${place.area ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    choices.push(place);
  }
  return choices.length >= 2 ? { status: "ambiguous", choices } : { status: "found", place: choices[0]! };
}
