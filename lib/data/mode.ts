import type { Mode } from "@/lib/types";

/**
 * Work out the ride mode of a GTFS route (rule from docs/data-notes.md).
 * All LTFRB road routes are route_type 3, so the route_id prefix is what tells jeep from bus.
 * Throws on anything unknown so a new kind of route fails the build instead of being guessed.
 */
export function modeOf(route: { route_id: string; route_type: string; agency_id: string }): Mode {
  if (route.route_type === "1" || route.route_type === "2") return "train"; // LRTA, MRTC, PNR
  if (route.route_id.startsWith("LTFRB_PUJ")) return "jeep"; // Public Utility Jeepney
  if (route.route_id.startsWith("LTFRB_PUB")) return "bus"; // Public Utility Bus
  if (route.agency_id === "FORT") return "bus"; // The Fort / BGC Bus
  throw new Error(`unknown mode for route ${route.route_id} (type ${route.route_type}, agency ${route.agency_id})`);
}

/** GTFS train short names → the labels commuters use. */
const LINE_LABELS: Record<string, string> = {
  "LRT 1": "LRT-1",
  "LRT 2": "LRT-2",
  "MRT-3": "MRT-3",
  "MRT 3": "MRT-3",
  "PNR MC": "PNR",
};

export function trainLine(shortName: string): string {
  const label = LINE_LABELS[shortName.trim()];
  if (!label) throw new Error(`unknown train line "${shortName}"`);
  return label;
}
