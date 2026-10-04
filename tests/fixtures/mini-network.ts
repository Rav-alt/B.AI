// A tiny hand-made network for router tests. Every distance is easy to reason about:
// at latitude 14.6, 0.001° of longitude ≈ 108 m and 0.001° of latitude ≈ 111 m.
//
//            s7 N2 (14.620)
//             |  bus "Delta – North" (one way, north)
//            s6 N1 (14.610)
//             |
//            s8 X  (14.6015)  ← 166 m walk from s3
//  s0 ── s1 ── s2 ── s3 ── s4 ── s5     (lat 14.600, ~323 m apart)
//  jeep "Alpha – Delta"   s0→s3 and its twin s3→s0
//  jeep "Bravo – Echo"    s1→s4, one way only (no twin)
//  train "Alpha – Foxtrot" (LRT-9) s0→s2→s4→s5 and back
import type { Network, Pattern, Stop, Transfer } from "@/lib/types";
import { haversineM } from "@/lib/geo/haversine";

const stops: Stop[] = [
  { id: "s0", name: "Alpha St", lat: 14.6, lon: 121.0 },
  { id: "s1", name: "Bravo St", lat: 14.6, lon: 121.003 },
  { id: "s2", name: "Charlie St", lat: 14.6, lon: 121.006 },
  { id: "s3", name: "Delta St", lat: 14.6, lon: 121.009 },
  { id: "s4", name: "Echo St", lat: 14.6, lon: 121.012 },
  { id: "s5", name: "Foxtrot St", lat: 14.6, lon: 121.015 },
  { id: "s6", name: "North 1", lat: 14.61, lon: 121.009 },
  { id: "s7", name: "North 2", lat: 14.62, lon: 121.009 },
  { id: "s8", name: "X Corner", lat: 14.6015, lon: 121.009 },
];

function cumDist(idx: number[]): number[] {
  const out = [0];
  for (let k = 1; k < idx.length; k++) {
    const a = stops[idx[k - 1]!]!;
    const b = stops[idx[k]!]!;
    out.push(out[k - 1]! + Math.round(haversineM(a.lat, a.lon, b.lat, b.lon)));
  }
  return out;
}

function pattern(p: Omit<Pattern, "dist" | "loop" | "source" | "routeId"> & { routeId?: string }): Pattern {
  return { routeId: p.id, loop: false, source: "gtfs", dist: cumDist(p.stops), ...p };
}

const patterns: Pattern[] = [
  pattern({ id: "J1", mode: "jeep", name: "Alpha – Delta", rawName: "ALPHA - DELTA", endpoints: ["Alpha", "Delta"], towards: "Delta", stops: [0, 1, 2, 3] }),
  pattern({ id: "J1r", mode: "jeep", name: "Alpha – Delta", rawName: "ALPHA - DELTA", endpoints: ["Alpha", "Delta"], towards: "Alpha", stops: [3, 2, 1, 0] }),
  pattern({ id: "J2", mode: "jeep", name: "Bravo – Echo", rawName: "Bravo-Echo", endpoints: ["Bravo", "Echo"], stops: [1, 2, 3, 4] }),
  pattern({ id: "B1", mode: "bus", name: "Delta – North", via: "X Corner", rawName: "Delta North via X Corner", endpoints: ["Delta", "North"], towards: "North", stops: [8, 6, 7] }),
  pattern({ id: "T1:0", routeId: "T1", mode: "train", line: "LRT-9", name: "Alpha – Foxtrot", rawName: "LRT 9", stops: [0, 2, 4, 5] }),
  pattern({ id: "T1:1", routeId: "T1", mode: "train", line: "LRT-9", name: "Foxtrot – Alpha", rawName: "LRT 9", stops: [5, 4, 2, 0] }),
];

const transfers: Transfer[] = [];
for (let a = 0; a < stops.length; a++)
  for (let b = a + 1; b < stops.length; b++) {
    const m = haversineM(stops[a]!.lat, stops[a]!.lon, stops[b]!.lat, stops[b]!.lon);
    if (m <= 300) transfers.push([a, b, Math.round(m)]);
  }

export const mini: Network = {
  version: 1,
  builtAt: "2026-10-05T00:00:00.000Z",
  feed: { name: "test", note: "hand-made" },
  params: { transferRadiusM: 300 },
  stops,
  patterns,
  transfers,
};

/** A point ~20 m south of stop i (so the walk is short but not zero). */
export function near(i: number, name = `near ${stops[i]!.name}`) {
  const s = stops[i]!;
  return { name, lat: s.lat - 0.00018, lon: s.lon };
}
