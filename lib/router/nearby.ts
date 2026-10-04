// "Which stops can I walk to from here?" using the grid in prepare.ts.
import type { Network } from "@/lib/types";
import { haversineM } from "@/lib/geo/haversine";
import { CELL_DEG, prepare } from "./prepare";
import { WALK_DETOUR, walkMetersFromStraight } from "./params";

export interface NearbyStop {
  stop: number;
  /** Estimated walking metres (straight line × detour). */
  walkM: number;
}

/** Stops within `maxWalkM` metres of walking, nearest first (ties by stop index). */
export function nearbyStops(net: Network, lat: number, lon: number, maxWalkM: number): NearbyStop[] {
  const { grid } = prepare(net);
  const maxStraight = maxWalkM / WALK_DETOUR + 1; // +1 m so rounding never drops an edge case
  const dLat = maxStraight / 111_320;
  const dLon = maxStraight / (111_320 * Math.cos((lat * Math.PI) / 180));
  const r0 = Math.floor((lat - dLat) / CELL_DEG);
  const r1 = Math.floor((lat + dLat) / CELL_DEG);
  const c0 = Math.floor((lon - dLon) / CELL_DEG);
  const c1 = Math.floor((lon + dLon) / CELL_DEG);

  const out: NearbyStop[] = [];
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++)
      for (const i of grid.get(`${r}:${c}`) ?? []) {
        const s = net.stops[i]!;
        const walkM = walkMetersFromStraight(haversineM(lat, lon, s.lat, s.lon));
        if (walkM <= maxWalkM) out.push({ stop: i, walkM });
      }
  return out.sort((a, b) => a.walkM - b.walkM || a.stop - b.stop);
}
