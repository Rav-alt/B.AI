// Shared check: an itinerary is well-formed and never rides a pattern backwards.
import { expect } from "vitest";
import type { Itinerary, Network } from "@/lib/types";

/** Every ride leg must go forward along its pattern, and its numbers must agree with the network. */
export function expectValidItinerary(net: Network, it: Itinerary) {
  const rides = it.legs.filter((l) => l.mode !== "walk");
  expect(it.transfers).toBe(Math.max(0, rides.length - 1));
  for (const leg of it.legs) {
    if (leg.mode === "walk") continue;
    const p = net.patterns.find((x) => x.id === leg.patternId);
    expect(p, leg.patternId).toBeDefined();
    const ids = p!.stops.map((i) => net.stops[i]!.id);
    const b = ids.indexOf(leg.boardStop.stopId!);
    const a = ids.lastIndexOf(leg.alightStop.stopId!);
    expect(b, `${leg.patternId} board`).toBeGreaterThanOrEqual(0);
    expect(a, `${leg.patternId} ridden backwards`).toBeGreaterThan(b);
    expect(leg.stopCount).toBeGreaterThan(0);
  }
  // legs are joined end to end
  for (let k = 1; k < it.legs.length; k++) {
    const prev = it.legs[k - 1]!;
    const cur = it.legs[k]!;
    const end = prev.mode === "walk" ? prev.to : prev.alightStop;
    const start = cur.mode === "walk" ? cur.from : cur.boardStop;
    expect([start.lat, start.lon]).toEqual([end.lat, end.lon]);
  }
}

