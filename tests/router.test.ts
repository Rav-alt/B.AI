// Phase 2 router: rules checked on a tiny hand-made network (tests/fixtures/mini-network.ts).
import { describe, expect, it } from "vitest";
import { mini, near } from "./fixtures/mini-network";
import { rideMinutes, walkMetersFromStraight, walkMinutes } from "@/lib/router/params";
import { nearbyStops } from "@/lib/router/nearby";
import { matchSignboard, normalizeText } from "@/lib/router/match";
import { planTrip } from "@/lib/router/plan";
import { checkRoutes } from "@/lib/router/check";
import { CheckResultSchema, PlanResultSchema } from "@/lib/types";
import { expectValidItinerary } from "./fixtures/assert";

describe("walking and speed estimates", () => {
  it("walk distance is straight line × 1.3, at 80 m/min", () => {
    expect(walkMetersFromStraight(100)).toBe(130);
    expect(walkMinutes(800)).toBe(10);
  });
  it("ride minutes come from distance and mode speed", () => {
    expect(rideMinutes("jeep", 12_000)).toBe(60); // 12 km/h
    expect(rideMinutes("bus", 15_000)).toBe(60); // 15 km/h
    expect(rideMinutes("train", 30_000)).toBe(60); // 30 km/h
  });
});

describe("nearbyStops", () => {
  it("returns stops within the walking radius, nearest first", () => {
    const got = nearbyStops(mini, 14.6, 121.009, 600); // standing on Delta St
    expect(got.map((g) => mini.stops[g.stop]!.id)).toEqual(["s3", "s8", "s2", "s4"]);
    expect(got[0]!.walkM).toBe(0);
    for (const g of got) expect(g.walkM).toBeLessThanOrEqual(600);
  });
  it("returns nothing far from every stop", () => {
    expect(nearbyStops(mini, 14.7, 121.2, 1000)).toEqual([]);
  });
});

describe("signboard matching", () => {
  it("normalises case, accents and punctuation", () => {
    expect(normalizeText("ESPAÑA Blvd.")).toBe("espana blvd");
  });
  it("matches by place name, filtered by mode, tolerating a typo", () => {
    const ids = (sb: string, mode?: "jeep" | "bus") => matchSignboard(mini, { signboard: sb, mode }).map((i) => mini.patterns[i]!.id);
    expect(ids("Delta", "jeep").sort()).toEqual(["J1", "J1r"]);
    expect(ids("Delta", "bus")).toEqual(["B1"]);
    expect(ids("Detla", "jeep").sort()).toEqual(["J1", "J1r"]);
    expect(ids("Zulu")).toEqual([]);
  });
  it("prefers signboard ends over the via part", () => {
    const ids = matchSignboard(mini, { signboard: "X Corner" }).map((i) => mini.patterns[i]!.id);
    expect(ids).toEqual(["B1"]); // only on the via, still found when nothing else matches
  });
});

describe("planTrip", () => {
  it("finds the direct jeep, walk → ride → walk", () => {
    const res = planTrip(mini, near(0), near(3));
    expect(PlanResultSchema.parse(res)).toEqual(res);
    expect(res.status).toBe("ok");
    const best = res.itineraries[0]!;
    expect(best.legs.map((l) => l.mode)).toEqual(["walk", "jeep", "walk"]);
    const ride = best.legs[1]!;
    expect(ride.mode !== "walk" && ride.patternId).toBe("J1");
    expect(best.transfers).toBe(0);
    for (const it of res.itineraries) expectValidItinerary(mini, it);
  });

  it("uses the twin for the trip back and never rides a pattern backwards", () => {
    const res = planTrip(mini, near(3), near(0));
    const ids = res.itineraries.flatMap((it) => it.legs.flatMap((l) => (l.mode === "walk" ? [] : [l.patternId])));
    expect(ids).toContain("J1r");
    expect(ids).not.toContain("J1");
    for (const it of res.itineraries) expectValidItinerary(mini, it);
  });

  it("transfers with a short walk when needed", () => {
    const res = planTrip(mini, near(0), near(7));
    expect(res.status).toBe("ok");
    const best = res.itineraries[0]!;
    expect(best.transfers).toBe(1);
    expect(best.legs.map((l) => l.mode)).toEqual(["walk", "jeep", "walk", "bus", "walk"]);
    expectValidItinerary(mini, best);
  });

  it("returns different signboard combinations, at most 3", () => {
    const res = planTrip(mini, near(0), near(4));
    expect(res.itineraries.length).toBeGreaterThanOrEqual(2); // train, and jeep + jeep / walk
    expect(res.itineraries.length).toBeLessThanOrEqual(3);
    const keys = res.itineraries.map((it) => it.legs.flatMap((l) => (l.mode === "walk" ? [] : [l.routeName])).join(" > "));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("trainsOnly rides only trains, avoidTrains never does", () => {
    const only = planTrip(mini, near(0), near(5), { trainsOnly: true });
    expect(only.status).toBe("ok");
    for (const it of only.itineraries) for (const l of it.legs) expect(["walk", "train"]).toContain(l.mode);
    const avoid = planTrip(mini, near(0), near(5), { avoidTrains: true });
    for (const it of avoid.itineraries) for (const l of it.legs) expect(l.mode).not.toBe("train");
  });

  it("fewestTransfers prefers one ride even if it is longer", () => {
    // Origin at Bravo, destination at Echo: J2 is direct.
    const res = planTrip(mini, near(1), near(4), { fewestTransfers: true });
    expect(res.itineraries[0]!.transfers).toBe(0);
  });

  it("reports when there are no stops near either end", () => {
    const far = { name: "nowhere", lat: 14.7, lon: 121.2 };
    expect(planTrip(mini, far, near(3)).status).toBe("no_stops_near_origin");
    expect(planTrip(mini, near(3), far).status).toBe("no_stops_near_destination");
    expect(planTrip(mini, far, near(3)).itineraries).toEqual([]);
  });

  it("names the nearest stop (up to 5 km) when none is within walking distance", () => {
    const twoKmNorth = { name: "2 km north", lat: 14.638, lon: 121.009 }; // ~2 km north of North 2
    const res = planTrip(mini, twoKmNorth, near(3));
    expect(res.status).toBe("no_stops_near_origin");
    expect(res.nearest).toMatchObject({ side: "origin", stop: { name: "North 2", stopId: "s7" } });
    expect(res.nearest!.meters).toBeGreaterThan(1900);
    expect(res.nearest!.meters).toBeLessThan(2100);
    expect(planTrip(mini, near(3), twoKmNorth).nearest?.side).toBe("destination");
    expect(PlanResultSchema.parse(res)).toEqual(res);
    // Farther than 5 km from everything: no suggestion.
    expect(planTrip(mini, { name: "nowhere", lat: 14.7, lon: 121.2 }, near(3)).nearest).toBeUndefined();
    // Found a route or "no_route": no suggestion either.
    expect(planTrip(mini, near(7), near(0)).nearest).toBeUndefined();
  });

  it("reports no_route when stops exist but nothing connects them", () => {
    // From North 2 nothing goes anywhere (B1 ends there, one way).
    const res = planTrip(mini, near(7), near(0));
    expect(res.status).toBe("no_route");
  });

  it("widens the walking radius to 1 km when 600 m finds nothing", () => {
    // ~910 m walk (700 m straight) east of Foxtrot St: too far at 600 m, fine at 1 km (train to Foxtrot).
    const res = planTrip(mini, near(0), { name: "east of Foxtrot", lat: 14.6, lon: 121.0215 });
    expect(res.status).toBe("ok");
    expect(res.walkRadiusM).toBe(1000);
  });
});

describe("checkRoutes", () => {
  it("says yes for a route that passes both, with an itinerary", () => {
    const res = checkRoutes(mini, near(0), near(3), [{ mode: "jeep", signboard: "Delta" }]);
    expect(CheckResultSchema.parse(res)).toEqual(res);
    const v = res.verdicts[0]!;
    expect(v.verdict).toBe("yes");
    expect(v.reason).toBe("passes_both");
    expect(v.itinerary).toBeDefined();
    expectValidItinerary(mini, v.itinerary!);
    expect(res.alternative).toBeUndefined();
  });

  it("says no / wrong_direction for a one-way route ridden the wrong way", () => {
    const res = checkRoutes(mini, near(4), near(1), [{ signboard: "Bravo Echo" }]);
    expect(res.verdicts[0]).toMatchObject({ verdict: "no", reason: "wrong_direction" });
  });

  it("says ride_too_short when walking would be about as quick", () => {
    // Bravo → Charlie is one 323 m stop: under the 500 m minimum ride.
    const res = checkRoutes(mini, near(1), near(2), [{ signboard: "Bravo Echo" }]);
    expect(res.verdicts[0]).toMatchObject({ verdict: "no", reason: "ride_too_short" });
  });

  it("explains a route that only reaches one end", () => {
    const res = checkRoutes(mini, near(0), near(3), [{ mode: "bus", signboard: "North" }]);
    expect(res.verdicts[0]).toMatchObject({ verdict: "no", reason: "destination_only" });
  });

  it("says no_such_route for an unknown signboard and suggests an alternative", () => {
    const res = checkRoutes(mini, near(0), near(3), [{ signboard: "Zulu" }]);
    expect(res.verdicts[0]).toMatchObject({ verdict: "no", reason: "no_such_route", matchedRoutes: [] });
    expect(res.alternative?.status).toBe("ok");
  });
});
