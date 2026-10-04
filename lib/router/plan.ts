// planTrip(): round-based search (RAPTOR-style, without timetables) over patterns and walking links.
//
// Round k finds the cheapest way to reach every stop using exactly k rides. A ride can only go
// forward along a pattern. Between rides you may walk one short link (≤ 300 m, from network.transfers).
// Cost = riding minutes + walking minutes × walk weight + a boarding cost per ride + a transfer
// penalty per extra ride (all in params.ts).
// To get *different* answers, the search runs again with the signboards of the best answer banned.
import type { Network, PlaceRef, PlanResult, Prefs } from "@/lib/types";
import { haversineM } from "@/lib/geo/haversine";
import { nearbyStops, type NearbyStop } from "./nearby";
import { prepare } from "./prepare";
import { buildItinerary, type Ride } from "./legs";
import {
  MAX_RIDES, MAX_WALK_SHARE, MIN_RIDE_M, SPEED_KMH, WALK_ONLY_MAX_M, WALK_RADIUS_M, WALK_RADIUS_WIDE_M,
  modeAllowed, walkMetersFromStraight, walkMinutes, weightsFor, type Weights,
} from "./params";

/** How a stop was reached. `ride` = got off pattern `pattern` here; `walk` = walked from `prev`; `access` = from the origin. */
type Label =
  | { kind: "access"; cost: number }
  | { kind: "ride"; cost: number; pattern: number; from: number; to: number }
  | { kind: "walk"; cost: number; prev: number };

interface Found {
  cost: number;
  rides: Ride[];
}

interface SearchInput {
  net: Network;
  access: NearbyStop[];
  egress: NearbyStop[];
  weights: Weights;
  prefs: Prefs;
  banned: Set<string>;
}

/** One search: the cheapest way to the destination for each number of rides (1…MAX_RIDES). */
function search({ net, access, egress, weights, prefs, banned }: SearchInput): Found[] {
  const { stopPatterns, walkLinks } = prepare(net);
  const egressWalk = new Map(egress.map((e) => [e.stop, e.walkM]));
  const bestReach = new Map<number, number>(); // cheapest cost to stand at a stop ready to board, any round
  const bestArrive = new Map<number, number>(); // cheapest cost to get off at a stop, any round

  const reach: Array<Map<number, Label>> = [new Map()];
  const arrive: Array<Map<number, Label & { kind: "ride" }>> = [new Map()];
  for (const a of access) {
    const cost = walkMinutes(a.walkM) * weights.walk;
    reach[0]!.set(a.stop, { kind: "access", cost });
    bestReach.set(a.stop, cost);
  }

  const results: Found[] = [];
  for (let k = 1; k <= MAX_RIDES; k++) {
    const prevReach = reach[k - 1]!;
    if (prevReach.size === 0) break;
    const penalty = weights.board + (k > 1 ? weights.transfer : 0);

    // Patterns to scan, each from the first position where a reached stop lets you board.
    const startAt = new Map<number, number>();
    for (const s of prevReach.keys())
      for (const [pi, pos] of stopPatterns[s] ?? []) {
        const p = net.patterns[pi]!;
        if (!modeAllowed(p.mode, prefs) || banned.has(p.name)) continue;
        const cur = startAt.get(pi);
        if (cur === undefined || pos < cur) startAt.set(pi, pos);
      }

    const arr = new Map<number, Label & { kind: "ride" }>();
    for (const [pi, start] of startAt) {
      const p = net.patterns[pi]!;
      const perM = 60 / (1000 * SPEED_KMH[p.mode]); // minutes per metre
      // Ride cost is linear in distance, so the best place to have boarded is the one with the lowest
      // (cost so far + penalty − perM × dist). A boarding only counts once the ride is ≥ MIN_RIDE_M.
      let boardVal = Infinity;
      let boardPos = -1;
      const pending: Array<{ pos: number; v: number }> = [];
      for (let j = start; j < p.stops.length; j++) {
        const s = p.stops[j]!;
        while (pending.length && p.dist[j]! - p.dist[pending[0]!.pos]! >= MIN_RIDE_M) {
          const c = pending.shift()!;
          if (c.v < boardVal) {
            boardVal = c.v;
            boardPos = c.pos;
          }
        }
        if (boardPos >= 0) {
          const cost = boardVal + perM * p.dist[j]!;
          if (cost < (bestArrive.get(s) ?? Infinity) && cost < (arr.get(s)?.cost ?? Infinity)) {
            arr.set(s, { kind: "ride", cost, pattern: pi, from: boardPos, to: j });
          }
        }
        const lab = prevReach.get(s);
        if (lab) pending.push({ pos: j, v: lab.cost + penalty - perM * p.dist[j]! });
      }
    }
    for (const [s, l] of arr) bestArrive.set(s, l.cost);
    arrive.push(arr);

    // Best way to finish after k rides.
    let best: { cost: number; stop: number } | undefined;
    for (const [s, l] of arr) {
      const w = egressWalk.get(s);
      if (w === undefined) continue;
      const cost = l.cost + walkMinutes(w) * weights.walk;
      if (!best || cost < best.cost) best = { cost, stop: s };
    }
    if (best) results.push({ cost: best.cost, rides: unwind(net, reach, arrive, k, best.stop) });

    // Where you can stand to board in round k+1: where you got off, or one short walk from there.
    const next = new Map<number, Label>();
    const offer = (s: number, l: Label) => {
      if (l.cost < (bestReach.get(s) ?? Infinity) && l.cost < (next.get(s)?.cost ?? Infinity)) next.set(s, l);
    };
    for (const [s, l] of arr) offer(s, l);
    for (const [s, l] of arr)
      for (const [t, straight] of walkLinks[s] ?? []) {
        offer(t, { kind: "walk", cost: l.cost + walkMinutes(walkMetersFromStraight(straight)) * weights.walk, prev: s });
      }
    for (const [s, l] of next) bestReach.set(s, l.cost);
    reach.push(next);
  }
  return results;
}

/** Follow the labels back from the final stop of round k to list the rides in order. */
function unwind(
  net: Network,
  reach: Array<Map<number, Label>>,
  arrive: Array<Map<number, Label & { kind: "ride" }>>,
  k: number,
  stop: number,
): Ride[] {
  const rides: Ride[] = [];
  let s = stop;
  for (let r = k; r >= 1; r--) {
    const ride = arrive[r]!.get(s);
    if (!ride) throw new Error("planTrip: broken label chain");
    rides.unshift({ pattern: ride.pattern, from: ride.from, to: ride.to });
    s = net.patterns[ride.pattern]!.stops[ride.from]!;
    const how = reach[r - 1]!.get(s);
    if (how?.kind === "walk") s = how.prev;
  }
  return rides;
}

const signature = (net: Network, rides: Ride[]) => rides.map((r) => net.patterns[r.pattern]!.name).join(" > ");

/** Searches until there are enough different answers; returns them cheapest first, near-duplicates removed. */
function diverse(input: Omit<SearchInput, "banned">, walkOnly: Found | undefined): Found[] {
  const pool = new Map<string, Found>();
  if (walkOnly) pool.set("", walkOnly);
  const banned = new Set<string>();
  for (let iter = 0; iter < 5; iter++) {
    const found = search({ ...input, banned });
    if (found.length === 0) break;
    for (const f of found) {
      const key = signature(input.net, f.rides);
      if (!pool.has(key) || pool.get(key)!.cost > f.cost) pool.set(key, f);
    }
    const cheapest = found.reduce((a, b) => (b.cost < a.cost ? b : a));
    for (const r of cheapest.rides) banned.add(input.net.patterns[r.pattern]!.name);
    if ([...pool.keys()].filter(Boolean).length >= 4) break;
  }
  const all = [...pool.values()].sort((a, b) => a.cost - b.cost);
  const bestCost = all[0]?.cost ?? 0;
  const picked: Found[] = [];
  for (const f of all) {
    if (f.cost > bestCost * 1.6 + 15) break;
    // Skip an answer that is just another one plus or minus a ride ("…then a 300 m jeep").
    if (picked.some((g) => nestedRides(input.net, f, g))) continue;
    picked.push(f);
  }
  return picked;
}

/** True when one answer's signboards are all inside the other's (and neither is "just walk"). */
function nestedRides(net: Network, a: Found, b: Found): boolean {
  if (a.rides.length === 0 || b.rides.length === 0) return false;
  const names = (f: Found) => new Set(f.rides.map((r) => net.patterns[r.pattern]!.name));
  const [x, y] = [names(a), names(b)];
  const inside = (s: Set<string>, t: Set<string>) => [...s].every((n) => t.has(n));
  return inside(x, y) || inside(y, x);
}

export interface PlanOptions {
  /** Override the walking radii (metres of walking), mainly for tests. */
  radii?: number[];
}

export function planTrip(net: Network, origin: PlaceRef, destination: PlaceRef, prefs: Prefs = {}, opts: PlanOptions = {}): PlanResult {
  const weights = weightsFor(prefs);
  const radii = opts.radii ?? [WALK_RADIUS_M, WALK_RADIUS_WIDE_M];
  const directWalkM = walkMetersFromStraight(haversineM(origin.lat, origin.lon, destination.lat, destination.lon));
  const walkOnly: Found | undefined =
    directWalkM <= WALK_ONLY_MAX_M ? { cost: walkMinutes(directWalkM) * weights.walk, rides: [] } : undefined;

  let status: PlanResult["status"] = "no_route";
  let radius = radii[0]!;
  for (radius of radii) {
    const access = nearbyStops(net, origin.lat, origin.lon, radius);
    const egress = nearbyStops(net, destination.lat, destination.lon, radius);
    status = access.length === 0 ? "no_stops_near_origin" : egress.length === 0 ? "no_stops_near_destination" : "no_route";
    const found = status === "no_route" ? diverse({ net, access, egress, weights, prefs }, walkOnly) : walkOnly ? [walkOnly] : [];
    // Drop answers whose walking defeats the point of riding (e.g. ride past and walk back).
    const its = found
      .map((f) => ({ f, it: buildItinerary(net, origin, destination, f.rides) }))
      .filter(({ f, it }) => f.rides.length === 0 || it.walkMeters <= directWalkM * MAX_WALK_SHARE)
      .slice(0, 3);
    if (its.some(({ f }) => f.rides.length > 0) || (radius === radii.at(-1) && its.length > 0)) {
      return { status: "ok", itineraries: its.map(({ it }) => it), walkRadiusM: radius };
    }
  }
  return { status, itineraries: [], walkRadiusM: radius };
}
