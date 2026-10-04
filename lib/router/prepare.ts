// Lookup tables the router needs, built once per Network object and cached.
import type { Network } from "@/lib/types";

export interface Prepared {
  /** For each stop: every (pattern, position) that serves it. */
  stopPatterns: Array<Array<[pattern: number, pos: number]>>;
  /** For each stop: nearby stops reachable on foot, with straight-line metres. */
  walkLinks: Array<Array<[stop: number, straightM: number]>>;
  /** Grid of stop indices for nearby-stop lookups, keyed by `${row}:${col}`. */
  grid: Map<string, number[]>;
}

/** Grid cell size in degrees (~0.005° ≈ 550 m). */
export const CELL_DEG = 0.005;
export const cellKey = (lat: number, lon: number): string => `${Math.floor(lat / CELL_DEG)}:${Math.floor(lon / CELL_DEG)}`;

const cache = new WeakMap<Network, Prepared>();

export function prepare(net: Network): Prepared {
  const hit = cache.get(net);
  if (hit) return hit;

  const stopPatterns: Prepared["stopPatterns"] = net.stops.map(() => []);
  net.patterns.forEach((p, pi) => p.stops.forEach((s, pos) => stopPatterns[s]?.push([pi, pos])));

  const walkLinks: Prepared["walkLinks"] = net.stops.map(() => []);
  for (const [a, b, m] of net.transfers) {
    walkLinks[a]?.push([b, m]);
    walkLinks[b]?.push([a, m]);
  }

  const grid = new Map<string, number[]>();
  net.stops.forEach((s, i) => {
    const k = cellKey(s.lat, s.lon);
    const cell = grid.get(k);
    if (cell) cell.push(i);
    else grid.set(k, [i]);
  });

  const out = { stopPatterns, walkLinks, grid };
  cache.set(net, out);
  return out;
}
