// buildNetwork() on a tiny made-up feed, so each rule can be checked by hand.
import { describe, expect, it } from "vitest";
import { buildNetwork, type Feed } from "@/lib/data/build";
import { CorrectionsSchema, type CorrectionsInput } from "@/lib/data/corrections";
import type { Row } from "@/lib/data/csv";

const stop = (stop_id: string, stop_name: string, lat: number, lon: number): Row => ({
  stop_id,
  stop_name,
  stop_lat: String(lat),
  stop_lon: String(lon),
});
const route = (route_id: string, route_long_name: string, extra: Partial<Row> = {}): Row => ({
  route_id,
  route_long_name,
  route_short_name: "",
  route_type: "3",
  agency_id: "LTFRB",
  ...extra,
});
const trip = (trip_id: string, route_id: string, shape_id = ""): Row => ({ trip_id, route_id, shape_id });
const times = (trip_id: string, stopIds: string[]): Row[] =>
  stopIds.map((stop_id, i) => ({ trip_id, stop_id, stop_sequence: String(i + 1) }));

const ROAD = ["S1", "S2", "S3", "S4", "S5"];
const feed: Feed = {
  stops: [
    stop("S1", "Baclaran Terminal, Pasay City", 14.5345, 120.9985),
    stop("S2", "Taft Ave / Libertad, Pasay City", 14.5476, 120.9985),
    stop("S3", "Taft Ave / Pedro Gil, Manila", 14.5766, 120.9881),
    stop("S4", "España Blvd / Lacson, Manila", 14.6105, 120.9897),
    stop("S5", "Blumentritt Market, Manila", 14.6223, 120.9831),
    stop("T1", "Baclaran LRT", 14.5339, 120.998),
    stop("T2", "Roosevelt LRT", 14.6575, 121.022),
    stop("T3", " Monumento LRT ", 14.654, 120.983),
    stop("UNUSED", "Nobody stops here", 14.6, 121.1),
  ],
  routes: [
    route("LTFRB_PUJ0001", "BACLARAN - BLUMENTRITT via TAFT"),
    route("LTFRB_PUJ0002", "BACLARAN - BLUMENTRITT via TAFT"),
    route("LTFRB_PUJ0004", "BACLARAN - BLUMENTRITT via TAFT"), // exact duplicate of 0001
    route("LTFRB_PUB0003", "One Stop Wonder"),
    route("ROUTE_LRT1", "Baclaran - Roosevelt", { route_type: "2", agency_id: "LRTA", route_short_name: "LRT 1" }),
    route("ROUTE_PNR", "Metro Commuter", { route_type: "2", agency_id: "PNR", route_short_name: "PNR MC" }),
  ],
  trips: [
    trip("t1", "LTFRB_PUJ0001"),
    trip("t2", "LTFRB_PUJ0002"),
    trip("t2b", "LTFRB_PUJ0004"),
    trip("t3", "LTFRB_PUB0003"),
    trip("t4", "ROUTE_LRT1", "SH1"),
    trip("t5", "ROUTE_LRT1", "SH1"), // same shape, other direction
    trip("t6", "ROUTE_PNR"),
  ],
  stopTimes: [
    ...times("t1", ROAD),
    ...times("t2", [...ROAD].reverse()),
    ...times("t2b", ROAD),
    ...times("t3", ["S1"]),
    ...times("t4", ["T1", "T3", "T2"]),
    ...times("t5", ["T2", "T3", "T1"]),
    ...times("t6", ["S1", "S2"]),
  ],
  shapes: [
    [14.5339, 120.998],
    [14.6, 120.985],
    [14.654, 120.983],
    [14.6575, 121.022],
  ].map(([lat, lon], i) => ({ shape_id: "SH1", shape_pt_sequence: String(i), shape_pt_lat: String(lat), shape_pt_lon: String(lon) })),
};

const corrections: CorrectionsInput = {
  removeRoutes: [{ routeId: "ROUTE_PNR", reason: "suspended", source: "test", updated: "2026-10-04" }],
  renameStops: [{ stopId: "T2", name: "Fernando Poe Jr. LRT", source: "test", updated: "2026-10-04" }],
  addRoutes: [
    {
      routeId: "CORR_TEST",
      name: "Pedro Gil - New Place",
      mode: "bus",
      stops: [{ stopId: "S3" }, { name: "New Place", lat: 14.59, lon: 120.99 }],
      source: "test",
      updated: "2026-10-04",
    },
  ],
};

const { network, report } = buildNetwork(feed, CorrectionsSchema.parse(corrections), { builtAt: "2026-10-04T00:00:00Z" });
const byId = (id: string) => {
  const p = network.patterns.find((x) => x.id === id);
  if (!p) throw new Error(`no pattern ${id}`);
  return p;
};
const stopNames = (id: string) => byId(id).stops.map((i) => network.stops[i]!.name);

describe("buildNetwork", () => {
  it("cleans road names and works out each direction", () => {
    const a = byId("LTFRB_PUJ0001");
    const b = byId("LTFRB_PUJ0002");
    expect(a.mode).toBe("jeep");
    expect(a.name).toBe("Baclaran – Blumentritt");
    expect(a.via).toBe("Taft");
    expect(a.rawName).toBe("BACLARAN - BLUMENTRITT via TAFT");
    expect(a.towards).toBe("Blumentritt");
    expect(b.towards).toBe("Baclaran");
  });

  it("keeps stops in riding order with increasing cumulative distance", () => {
    const a = byId("LTFRB_PUJ0001");
    expect(stopNames("LTFRB_PUJ0001")[0]).toMatch(/^Baclaran/);
    expect(a.dist[0]).toBe(0);
    for (let i = 1; i < a.dist.length; i++) expect(a.dist[i]!).toBeGreaterThan(a.dist[i - 1]!);
    expect(a.dist.at(-1)!).toBeGreaterThan(9_000); // Baclaran → Blumentritt is ~10 km
    expect(a.dist.at(-1)!).toBeLessThan(11_000);
  });

  it("splits a two-direction train into two patterns and uses the renamed station", () => {
    const n = byId("ROUTE_LRT1:0");
    const s = byId("ROUTE_LRT1:1");
    expect(n.line).toBe("LRT-1");
    expect(n.name).toBe("Baclaran – Fernando Poe Jr.");
    expect(n.towards).toBe("Fernando Poe Jr.");
    expect(s.towards).toBe("Baclaran");
    expect(stopNames("ROUTE_LRT1:0")).toEqual(["Baclaran LRT", "Monumento LRT", "Fernando Poe Jr. LRT"]);
  });

  it("flips a shared shape for the return direction", () => {
    const n = byId("ROUTE_LRT1:0");
    const s = byId("ROUTE_LRT1:1");
    expect(n.shape?.[0]).toEqual([14.5339, 120.998]); // starts at Baclaran
    expect(s.shape?.[0]).toEqual([14.6575, 121.022]); // starts at Fernando Poe Jr.
    expect(n.shapeIdx).toEqual([0, 2, 3]);
    expect(s.shapeIdx).toEqual([0, 1, 3]);
  });

  it("applies removals, drops duplicates and routes with < 2 stops", () => {
    const ids = network.patterns.map((p) => p.id);
    expect(ids).not.toContain("ROUTE_PNR");
    expect(ids).not.toContain("LTFRB_PUB0003");
    expect(ids).not.toContain("LTFRB_PUJ0004");
    expect(report.counts.removedRoutes).toBe(1);
    expect(report.counts.duplicatesDropped).toBe(1);
    expect(report.warnings.some((w) => w.includes("LTFRB_PUB0003"))).toBe(true);
  });

  it("adds correction routes in both directions with new stops", () => {
    const fwd = byId("CORR_TEST:0");
    const back = byId("CORR_TEST:1");
    expect(fwd.source).toBe("corrections");
    expect(stopNames("CORR_TEST:0")).toEqual(["Taft Ave / Pedro Gil, Manila", "New Place"]);
    expect(stopNames("CORR_TEST:1")).toEqual(["New Place", "Taft Ave / Pedro Gil, Manila"]);
    expect(back.mode).toBe("bus");
  });

  it("keeps only used stops and links nearby ones as walking transfers", () => {
    expect(network.stops.some((s) => s.id === "UNUSED")).toBe(false);
    const idx = (id: string) => network.stops.findIndex((s) => s.id === id);
    const [s1, t1] = [idx("S1"), idx("T1")].sort((x, y) => x - y);
    const link = network.transfers.find(([a, b]) => a === s1 && b === t1);
    expect(link?.[2]).toBeLessThan(300); // Baclaran terminal ↔ Baclaran LRT
  });

  it("rejects corrections that point at unknown stops", () => {
    const bad = CorrectionsSchema.parse({
      addRoutes: [{ routeId: "CORR_BAD", name: "x", mode: "jeep", stops: [{ stopId: "NOPE" }, { stopId: "S1" }], source: "test", updated: "2026-10-04" }],
    });
    expect(() => buildNetwork(feed, bad, { builtAt: "x" })).toThrow(/unknown stop NOPE/);
  });
});

describe("CorrectionsSchema", () => {
  it("requires a source and a real date on every entry", () => {
    expect(CorrectionsSchema.safeParse({ removeRoutes: [{ routeId: "X", reason: "r", source: "s", updated: "yesterday" }] }).success).toBe(false);
    expect(CorrectionsSchema.safeParse({ removeRoutes: [{ routeId: "X", reason: "r", updated: "2026-10-04" }] }).success).toBe(false);
  });
  it("requires added route ids to start with CORR_", () => {
    const r = CorrectionsSchema.safeParse({
      addRoutes: [{ routeId: "LTFRB_PUJ9", name: "x", mode: "jeep", stops: [{ stopId: "a" }, { stopId: "b" }], source: "s", updated: "2026-10-04" }],
    });
    expect(r.success).toBe(false);
  });
});
