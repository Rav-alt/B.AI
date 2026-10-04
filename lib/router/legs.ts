// Turn router decisions (pattern + positions, walks) into the Leg objects the UI and AI read.
import type { Itinerary, LatLon, Leg, Network, PlaceRef, RideLeg, WalkLeg } from "@/lib/types";
import { haversineM, round5 } from "@/lib/geo/haversine";
import { rideMinutes, walkMetersFromStraight, walkMinutes } from "./params";

export function stopRef(net: Network, i: number): PlaceRef {
  const s = net.stops[i]!;
  return { name: s.name, lat: s.lat, lon: s.lon, stopId: s.id };
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Ride pattern `pi` from position `from` to a later position `to`. */
export function rideLeg(net: Network, pi: number, from: number, to: number): Leg {
  const p = net.patterns[pi]!;
  if (!(to > from)) throw new Error(`rideLeg: ${p.id} would be ridden backwards (${from} → ${to})`);
  const meters = p.dist[to]! - p.dist[from]!;

  let polyline: LatLon[] | undefined;
  if (p.shape && p.shapeIdx) {
    const a = p.shapeIdx[from]!;
    const b = p.shapeIdx[to]!;
    if (b > a) polyline = p.shape.slice(a, b + 1);
  }
  if (!polyline || polyline.length < 2) {
    polyline = p.stops.slice(from, to + 1).map((i): LatLon => [net.stops[i]!.lat, net.stops[i]!.lon]);
  }

  const leg: RideLeg = {
    mode: p.mode,
    patternId: p.id,
    routeName: p.name,
    ...(p.line ? { line: p.line } : {}),
    ...(p.via ? { via: p.via } : {}),
    ...(p.towards ? { towards: p.towards } : {}),
    boardStop: stopRef(net, p.stops[from]!),
    alightStop: stopRef(net, p.stops[to]!),
    stopCount: to - from,
    distanceKm: round1(meters / 1000),
    estMinutes: Math.round(rideMinutes(p.mode, meters)),
    polyline,
  };
  return leg as Leg;
}

export function walkLeg(from: PlaceRef, to: PlaceRef): WalkLeg {
  const meters = walkMetersFromStraight(haversineM(from.lat, from.lon, to.lat, to.lon));
  return {
    mode: "walk",
    from,
    to,
    meters,
    estMinutes: Math.round(walkMinutes(meters)),
    polyline: [
      [round5(from.lat), round5(from.lon)],
      [round5(to.lat), round5(to.lon)],
    ],
  };
}

/** Same point (within ~15 m)? Then no walk leg is needed. */
export const samePlace = (a: PlaceRef, b: PlaceRef): boolean => haversineM(a.lat, a.lon, b.lat, b.lon) < 15;

/** One ride inside an itinerary: pattern index, board position, alight position. */
export interface Ride {
  pattern: number;
  from: number;
  to: number;
}

/**
 * Origin → (walk) → ride → (walk) → ride … → (walk) → destination.
 * Walks to/from the origin and destination are skipped when they're under ~15 m;
 * a walk between two different stops is always shown.
 */
export function buildItinerary(net: Network, origin: PlaceRef, destination: PlaceRef, rides: Ride[]): Itinerary {
  const legs: Leg[] = [];
  let here = origin;
  let atStop: number | undefined;
  rides.forEach((r, k) => {
    const board = net.patterns[r.pattern]!.stops[r.from]!;
    const boardRef = stopRef(net, board);
    if (k === 0 ? !samePlace(here, boardRef) : atStop !== board) legs.push(walkLeg(here, boardRef));
    const leg = rideLeg(net, r.pattern, r.from, r.to);
    legs.push(leg);
    atStop = net.patterns[r.pattern]!.stops[r.to]!;
    here = stopRef(net, atStop);
  });
  if (!samePlace(here, destination) || legs.length === 0) legs.push(walkLeg(here, destination));

  const walkMeters = legs.reduce((m, l) => m + (l.mode === "walk" ? l.meters : 0), 0);
  return {
    legs,
    totalMinutes: legs.reduce((t, l) => t + l.estMinutes, 0),
    transfers: Math.max(0, rides.length - 1),
    walkMeters,
  };
}
