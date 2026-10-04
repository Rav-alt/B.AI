// checkRoutes(): "Should I take the bus going to SM Fairview or the jeep going to Divisoria?"
// For each named route: does it pass near the origin and LATER near the destination?
import type { CandidateVerdict, Candidate, CheckReason, CheckResult, Network, PlaceRef, Prefs } from "@/lib/types";
import { haversineM } from "@/lib/geo/haversine";
import { matchSignboard } from "./match";
import { nearbyStops } from "./nearby";
import { buildItinerary, type Ride } from "./legs";
import { planTrip } from "./plan";
import { MAX_WALK_SHARE, MIN_RIDE_M, SPEED_KMH, WALK_RADIUS_M, WALK_RADIUS_WIDE_M, walkMetersFromStraight, walkMinutes, weightsFor, type Weights } from "./params";

interface Evaluation {
  reason: CheckReason;
  ride?: Ride;
  cost: number;
}

/**
 * How one pattern serves the trip, given walkable stops (stop → walking metres) at each end.
 * A "yes" needs a ride that's worth taking: at least MIN_RIDE_M, longer than the walking around it,
 * and saving real walking compared with just walking there (MAX_WALK_SHARE). Otherwise, with a 1 km
 * radius, "walk 800 m back to ride one stop" or "ride past it and walk back" would count as a yes.
 */
export function evaluatePattern(
  net: Network,
  pi: number,
  nearOrigin: Map<number, number>,
  nearDest: Map<number, number>,
  weights: Weights,
  tripStraightM: number,
): Evaluation {
  const p = net.patterns[pi]!;
  const perM = 60 / (1000 * SPEED_KMH[p.mode]);
  const os: number[] = [];
  const ds: number[] = [];
  p.stops.forEach((s, j) => {
    if (nearOrigin.has(s)) os.push(j);
    if (nearDest.has(s)) ds.push(j);
  });

  const directWalkM = walkMetersFromStraight(tripStraightM);
  const worthIt = (rideM: number, walkM: number) => rideM >= MIN_RIDE_M && rideM >= walkM && walkM <= directWalkM * MAX_WALK_SHARE;
  let best: Evaluation | undefined;
  let reverseWorks = false; // would it work if the route ran the other way?
  let tooShort = false; // right order, but the ride is too short to be worth it
  for (const o of os)
    for (const d of ds) {
      if (o === d) continue;
      const rideM = Math.abs(p.dist[d]! - p.dist[o]!);
      const walkM = nearOrigin.get(p.stops[o]!)! + nearDest.get(p.stops[d]!)!;
      const ok = worthIt(rideM, walkM);
      if (d < o) {
        reverseWorks ||= ok;
        continue;
      }
      if (!ok) {
        tooShort = true;
        continue;
      }
      const cost = weights.board + perM * rideM + walkMinutes(walkM) * weights.walk;
      if (!best || cost < best.cost) best = { reason: "passes_both", ride: { pattern: pi, from: o, to: d }, cost };
    }
  if (best) return best;
  const reason: CheckReason = reverseWorks
    ? "wrong_direction"
    : tooShort
      ? "ride_too_short"
      : os.length && ds.length
        ? "wrong_direction"
        : os.length
          ? "origin_only"
          : ds.length
            ? "destination_only"
            : "passes_neither";
  return { reason, cost: Infinity };
}

const REASON_RANK: Record<CheckReason, number> = {
  passes_both: 0, wrong_direction: 1, ride_too_short: 2, origin_only: 3, destination_only: 4, passes_neither: 5, no_such_route: 6,
};

function judge(
  net: Network,
  origin: PlaceRef,
  destination: PlaceRef,
  cand: Candidate,
  matched: number[],
  radius: number,
  weights: Weights,
): CandidateVerdict {
  const toMap = (lat: number, lon: number) => new Map(nearbyStops(net, lat, lon, radius).map((n) => [n.stop, n.walkM]));
  const nearO = toMap(origin.lat, origin.lon);
  const nearD = toMap(destination.lat, destination.lon);

  const tripM = haversineM(origin.lat, origin.lon, destination.lat, destination.lon);
  const evals = matched.map((pi, rank) => ({ pi, rank, ...evaluatePattern(net, pi, nearO, nearD, weights, tripM) }));
  evals.sort((a, b) => REASON_RANK[a.reason] - REASON_RANK[b.reason] || a.cost - b.cost || a.rank - b.rank);

  const seen = new Set<string>();
  const matchedRoutes: CandidateVerdict["matchedRoutes"] = [];
  for (const e of evals) {
    const p = net.patterns[e.pi]!;
    const key = `${p.name}|${p.towards ?? ""}`;
    if (seen.has(key) || matchedRoutes.length >= 5) continue;
    seen.add(key);
    matchedRoutes.push({ patternId: p.id, mode: p.mode, routeName: p.name, ...(p.towards ? { towards: p.towards } : {}), reason: e.reason });
  }

  const top = evals[0]!;
  if (top.ride) {
    return {
      candidate: cand,
      verdict: "yes",
      reason: "passes_both",
      matchedRoutes,
      itinerary: buildItinerary(net, origin, destination, [top.ride]),
    };
  }
  return { candidate: cand, verdict: "no", reason: top.reason, matchedRoutes };
}

export function checkRoutes(
  net: Network,
  origin: PlaceRef,
  destination: PlaceRef,
  candidates: Candidate[],
  prefs: Prefs = {},
): CheckResult {
  const weights = weightsFor(prefs);
  let walkRadiusM = WALK_RADIUS_M;
  const verdicts = candidates.map((cand): CandidateVerdict => {
    const matched = matchSignboard(net, cand);
    if (matched.length === 0) return { candidate: cand, verdict: "no", reason: "no_such_route", matchedRoutes: [] };
    const close = judge(net, origin, destination, cand, matched, WALK_RADIUS_M, weights);
    if (close.verdict === "yes") return close;
    // A jeep 700 m away still counts, but say so through walkRadiusM.
    walkRadiusM = WALK_RADIUS_WIDE_M;
    return judge(net, origin, destination, cand, matched, WALK_RADIUS_WIDE_M, weights);
  });

  const anyYes = verdicts.some((v) => v.verdict === "yes");
  return {
    verdicts,
    ...(anyYes ? {} : { alternative: planTrip(net, origin, destination, prefs) }),
    walkRadiusM,
  };
}
