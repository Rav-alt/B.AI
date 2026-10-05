// geocodeText(): turn "Pedro Gil Taft" into a point. Local landmarks + stop names first (instant, free),
// then Nominatim as the fallback. placeFromCoords(): the "use my location" button.
import type { GeocodeResult, GeoPlace, Network } from "@/lib/types";
import type { Landmark } from "./landmarks";
import type { NominatimClient } from "./nominatim";
import { FILLER, matchPlace, SAME_PLACE_M } from "./places";
import { insideMetroManila } from "./bbox";
import { clusterByDistance } from "./cluster";

export interface GeocodeContext {
  net: Network;
  landmarks: Landmark[];
  /** Null when Nominatim isn't configured (no NOMINATIM_CONTACT). */
  nominatim: NominatimClient | null;
  /** Called with the real error when Nominatim fails (the user only sees "not found"). */
  onSearchError?: (query: string, error: unknown) => void;
}

/**
 * Words people add that are often not in the OpenStreetMap name, or are spelled differently there
 * ("Ayala Mall" vs "Ayala Malls"). Dropped first when the full question finds nothing.
 */
const LOOSE_WORDS = new Set([
  "mall", "malls", "college", "university", "school", "campus", "station", "stn", "terminal", "church",
  "hospital", "building", "bldg", "tower", "center", "centre", "branch", "main", "ave", "avenue", "st",
  "street", "road", "rd", "blvd", "corner", "cor", "edsa", "city",
]);

/** At most this many Nominatim calls per place (each waits up to 1 s in the queue). */
export const MAX_SEARCHES = 4;

/**
 * Nominatim only finds a place when every word matches, with no typo or plural tolerance. So when the
 * full question finds nothing, try it with one word left out: loose words first ("Ayala Mall Manila
 * Bay" → "Ayala Manila Bay"), then the last word ("STI College Pasay EDSA" → "STI College Pasay"),
 * then the others. The first word (usually the brand: STI, Ayala, SM) is always kept, and so are at
 * least two words, because one word alone ("Ayala") matches too much.
 */
export function searchVariants(query: string): string[] {
  const words = query
    .replace(/[,;?!]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w.toLowerCase()));
  if (words.length === 0) return [];
  const full = words.join(" ");
  if (words.length < 3) return [full];

  const drops = words.map((_, i) => i).filter((i) => i > 0);
  const rank = (i: number) => (LOOSE_WORDS.has(words[i]!.toLowerCase()) ? 0 : i === words.length - 1 ? 1 : 2);
  drops.sort((a, b) => rank(a) - rank(b) || b - a);

  const out = [full];
  for (const i of drops) {
    const v = words.filter((_, j) => j !== i).join(" ");
    if (!out.includes(v)) out.push(v);
    if (out.length >= MAX_SEARCHES) break;
  }
  return out;
}

export async function geocodeText(query: string, ctx: GeocodeContext): Promise<GeocodeResult> {
  const local = matchPlace(ctx.net, ctx.landmarks, query);
  if (local.status !== "not_found") return local;
  if (!ctx.nominatim) return { status: "not_found", reason: "search_unavailable" };

  for (const variant of searchVariants(query)) {
    let results;
    try {
      results = await ctx.nominatim.search(variant);
    } catch (e) {
      ctx.onSearchError?.(variant, e);
      return { status: "not_found", reason: "search_unavailable" };
    }
    const places: GeoPlace[] = results
      .filter((r) => insideMetroManila(r.lat, r.lon))
      .map((r) => ({ name: r.name, lat: r.lat, lon: r.lon, source: "nominatim", ...(r.area ? { area: r.area } : {}) }));
    if (places.length === 0) continue;
    const clusters = clusterByDistance(places, SAME_PLACE_M); // Nominatim already sorts by relevance
    if (clusters.length === 1) return { status: "found", place: clusters[0]![0]! };
    return { status: "ambiguous", choices: clusters.slice(0, 5).map((c) => c[0]!) };
  }
  return { status: "not_found", reason: "no_match" };
}

/** The browser's location. Never stored; only used for this one question. */
export function placeFromCoords(lat: number, lon: number, name = "Your location"): GeocodeResult {
  const place: GeoPlace = { name, lat, lon, source: "device" };
  return insideMetroManila(lat, lon) ? { status: "found", place } : { status: "outside_area", place };
}
