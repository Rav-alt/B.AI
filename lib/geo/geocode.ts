// geocodeText(): turn "Pedro Gil Taft" into a point. Local landmarks + stop names first (instant, free),
// then Nominatim as the fallback. placeFromCoords(): the "use my location" button.
import type { GeocodeResult, GeoPlace, Network } from "@/lib/types";
import type { Landmark } from "./landmarks";
import type { NominatimClient } from "./nominatim";
import { matchPlace, SAME_PLACE_M } from "./places";
import { insideMetroManila } from "./bbox";
import { clusterByDistance } from "./cluster";

export interface GeocodeContext {
  net: Network;
  landmarks: Landmark[];
  /** Null when Nominatim isn't configured (no NOMINATIM_CONTACT). */
  nominatim: NominatimClient | null;
}

export async function geocodeText(query: string, ctx: GeocodeContext): Promise<GeocodeResult> {
  const local = matchPlace(ctx.net, ctx.landmarks, query);
  if (local.status !== "not_found") return local;
  if (!ctx.nominatim) return { status: "not_found", reason: "search_unavailable" };

  let results;
  try {
    results = await ctx.nominatim.search(query);
  } catch {
    return { status: "not_found", reason: "search_unavailable" };
  }
  const places: GeoPlace[] = results
    .filter((r) => insideMetroManila(r.lat, r.lon))
    .map((r) => ({ name: r.name, lat: r.lat, lon: r.lon, source: "nominatim", ...(r.area ? { area: r.area } : {}) }));
  if (places.length === 0) return { status: "not_found", reason: "no_match" };
  const clusters = clusterByDistance(places, SAME_PLACE_M); // Nominatim already sorts by relevance
  if (clusters.length === 1) return { status: "found", place: clusters[0]![0]! };
  return { status: "ambiguous", choices: clusters.slice(0, 5).map((c) => c[0]!) };
}

/** The browser's location. Never stored; only used for this one question. */
export function placeFromCoords(lat: number, lon: number, name = "Your location"): GeocodeResult {
  const place: GeoPlace = { name, lat, lon, source: "device" };
  return insideMetroManila(lat, lon) ? { status: "found", place } : { status: "outside_area", place };
}
