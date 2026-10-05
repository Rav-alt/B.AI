// Phase 1 exit check: the real data/generated/network.json loads, validates and makes sense.
// If this fails after changing the build, run `npm run build:data` and commit the new network.json.
import { describe, expect, it } from "vitest";
import { loadNetwork } from "@/lib/router/network";
import { haversineM } from "@/lib/geo/haversine";

const net = loadNetwork();
const PEDRO_GIL_TAFT = { lat: 14.5766, lon: 120.9881 };
const ESPANA = { lat: 14.6105, lon: 120.9897 };

describe("network.json", () => {
  it("passes the schema and has the expected size", () => {
    // loadNetwork() already validated it with NetworkSchema. Counts from docs/data-notes.md.
    expect(net.stops.length).toBeGreaterThan(4_500);
    expect(net.patterns.length).toBeGreaterThan(1_700);
    expect(net.transfers.length).toBeGreaterThan(5_000);
  });

  it("every pattern has at least 2 stops", () => {
    for (const p of net.patterns) expect(p.stops.length, p.id).toBeGreaterThanOrEqual(2);
  });

  it("has every mode the feed provides", () => {
    const count = (m: string) => net.patterns.filter((p) => p.mode === m).length;
    expect(count("jeep")).toBeGreaterThan(1_500);
    expect(count("bus")).toBeGreaterThan(180);
    expect(count("train")).toBe(6); // LRT-1, LRT-2, MRT-3 × 2 directions (PNR removed)
  });

  it("applies corrections: PNR gone, Roosevelt renamed, LRT-1 runs to Dr. Santos", () => {
    expect(net.patterns.some((p) => p.line === "PNR")).toBe(false);
    const lrt1 = net.patterns.filter((p) => p.line === "LRT-1");
    expect(lrt1.map((p) => p.name).sort()).toEqual(["Dr. Santos – Fernando Poe Jr.", "Fernando Poe Jr. – Dr. Santos"]);
    for (const p of lrt1) expect(p.stops.length).toBe(25); // Cavite Extension phase 1 (Nov 2024)
    expect(net.stops.some((s) => s.name.startsWith("Roosevelt LRT"))).toBe(false);
  });

  it("every stop is inside the greater Metro Manila area", () => {
    for (const s of net.stops) {
      expect(s.lat).toBeGreaterThan(14.2);
      expect(s.lat).toBeLessThan(14.95);
      expect(s.lon).toBeGreaterThan(120.85);
      expect(s.lon).toBeLessThan(121.3);
    }
  });

  it("can ride Pedro Gil/Taft → España forward on at least one direct route (acceptance test 1 data check)", () => {
    const near = (i: number, p: { lat: number; lon: number }) => {
      const s = net.stops[i]!;
      return haversineM(s.lat, s.lon, p.lat, p.lon) <= 400;
    };
    const direct = net.patterns.filter((p) => {
      const board = p.stops.findIndex((i) => near(i, PEDRO_GIL_TAFT));
      return board >= 0 && p.stops.some((i, k) => k > board && near(i, ESPANA));
    });
    expect(direct.length).toBeGreaterThanOrEqual(10); // 13 in the Phase 0 spike
    expect(direct.some((p) => p.mode === "bus" && /fairview/i.test(p.name))).toBe(true);
  });

  it("knows which way most road routes go", () => {
    const roads = net.patterns.filter((p) => p.mode !== "train" && !p.loop);
    const known = roads.filter((p) => p.towards).length;
    expect(known / roads.length).toBeGreaterThan(0.75);
    // a known direction is always one of the signboard ends
    for (const p of roads) if (p.towards) expect(p.endpoints, p.id).toContain(p.towards);
  });
});
