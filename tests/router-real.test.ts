// Phase 2 exit checks on the real network.json (acceptance tests 1–3 from CLAUDE.md, router part).
import { describe, expect, it } from "vitest";
import { loadNetwork } from "@/lib/router/network";
import { planTrip } from "@/lib/router/plan";
import { checkRoutes } from "@/lib/router/check";
import { expectValidItinerary } from "./fixtures/assert";

const net = loadNetwork();
const PEDRO_GIL_TAFT = { name: "Pedro Gil Taft", lat: 14.5766, lon: 120.9881 };
const ESPANA = { name: "España", lat: 14.6105, lon: 120.9897 };
const CUBAO = { name: "Cubao", lat: 14.6194, lon: 121.0513 };
const AYALA = { name: "Ayala", lat: 14.5494, lon: 121.0279 };

describe("router on the real network", () => {
  it("Pedro Gil Taft → España returns ≥1 valid itinerary (acceptance test 1)", () => {
    const res = planTrip(net, PEDRO_GIL_TAFT, ESPANA);
    expect(res.status).toBe("ok");
    expect(res.itineraries.length).toBeGreaterThanOrEqual(1);
    expect(res.itineraries[0]!.transfers).toBe(0); // there are direct routes
    for (const it of res.itineraries) expectValidItinerary(net, it);
  });

  it("Fairview bus = yes, Divisoria jeep = no (acceptance test 2)", () => {
    const res = checkRoutes(net, PEDRO_GIL_TAFT, ESPANA, [
      { mode: "bus", signboard: "SM Fairview" },
      { mode: "jeep", signboard: "Divisoria" },
    ]);
    expect(res.verdicts[0]).toMatchObject({ verdict: "yes", reason: "passes_both" });
    expect(res.verdicts[0]!.itinerary).toBeDefined();
    expect(res.verdicts[1]!.verdict).toBe("no");
    expect(res.verdicts[1]!.matchedRoutes.length).toBeGreaterThan(0);
    expect(res.alternative).toBeUndefined();
  });

  it("suggests an alternative when no candidate works", () => {
    const res = checkRoutes(net, PEDRO_GIL_TAFT, ESPANA, [{ mode: "jeep", signboard: "Divisoria" }]);
    expect(res.verdicts[0]!.verdict).toBe("no");
    expect(res.alternative?.status).toBe("ok");
    expect(res.alternative!.itineraries.length).toBeGreaterThan(0);
  });

  it("never rides a route backwards (random trips, acceptance test 3)", () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31);
    const inside = net.stops.filter((s) => s.lat > 14.4 && s.lat < 14.75 && s.lon < 121.12);
    let found = 0;
    for (let n = 0; n < 25; n++) {
      const a = inside[Math.floor(rand() * inside.length)]!;
      const b = inside[Math.floor(rand() * inside.length)]!;
      const res = planTrip(net, { name: a.name, lat: a.lat, lon: a.lon }, { name: b.name, lat: b.lat, lon: b.lon });
      for (const it of res.itineraries) {
        expectValidItinerary(net, it);
        expect(it.transfers).toBeLessThanOrEqual(2);
        for (const l of it.legs) if (l.mode !== "walk") expect(l.distanceKm).toBeGreaterThanOrEqual(0.5); // MIN_RIDE_M
      }
      if (res.status === "ok") found++;
    }
    expect(found).toBeGreaterThan(15); // most random Metro Manila pairs are reachable within 2 transfers
  });

  it("Cubao → Ayala works and trainsOnly gives the MRT", () => {
    expect(planTrip(net, CUBAO, AYALA).status).toBe("ok");
    const t = planTrip(net, CUBAO, AYALA, { trainsOnly: true });
    expect(t.status).toBe("ok");
    const lines = t.itineraries[0]!.legs.flatMap((l) => (l.mode === "train" ? [l.line] : []));
    expect(lines).toContain("MRT-3");
  });

  it("is fast enough for a serverless request", () => {
    planTrip(net, CUBAO, ESPANA); // warm the index
    const t0 = performance.now();
    planTrip(net, CUBAO, PEDRO_GIL_TAFT);
    expect(performance.now() - t0).toBeLessThan(800); // ~100–200 ms here; generous for slower laptops
  });
});
