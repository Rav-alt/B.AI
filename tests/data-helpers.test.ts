import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/data/csv";
import { modeOf, trainLine } from "@/lib/data/mode";
import { cleanStopName, normalizeForMatch, parseRouteName, stationLabel } from "@/lib/data/names";
import { nearbyPairs, pointToSegmentM } from "@/lib/data/build";
import { haversineM } from "@/lib/geo/haversine";

describe("parseCsv", () => {
  it("handles a BOM, quotes, escaped quotes, commas in quotes and CRLF", () => {
    const text = '﻿"id","name"\r\n1,"Taft Ave, Manila"\r\n2,"He said ""para"""\r\n';
    expect(parseCsv(text)).toEqual([
      { id: "1", name: "Taft Ave, Manila" },
      { id: "2", name: 'He said "para"' },
    ]);
  });

  it("fills missing trailing fields with empty strings and skips blank lines", () => {
    expect(parseCsv("a,b,c\n1,2\n\n3,4,5")).toEqual([
      { a: "1", b: "2", c: "" },
      { a: "3", b: "4", c: "5" },
    ]);
  });
});

describe("modeOf", () => {
  const r = (route_id: string, route_type = "3", agency_id = "LTFRB") => ({ route_id, route_type, agency_id });
  it("maps trains, jeeps, buses and The Fort bus", () => {
    expect(modeOf(r("ROUTE_880747", "2", "LRTA"))).toBe("train");
    expect(modeOf(r("LTFRB_PUJ1234"))).toBe("jeep");
    expect(modeOf(r("LTFRB_PUB1041"))).toBe("bus");
    expect(modeOf(r("FORT_CENT", "3", "FORT"))).toBe("bus");
  });
  it("refuses to guess an unknown route", () => {
    expect(() => modeOf(r("LTFRB_XYZ1"))).toThrow(/unknown mode/);
  });
  it("labels train lines the way commuters say them", () => {
    expect(trainLine("LRT 1")).toBe("LRT-1");
    expect(trainLine("MRT-3")).toBe("MRT-3");
    expect(() => trainLine("MRT 7")).toThrow();
  });
});

describe("parseRouteName", () => {
  it("splits the via part and uses an en dash", () => {
    expect(parseRouteName("Baclaran - Blumentritt via L. Guinto, Quiapo")).toEqual({
      name: "Baclaran – Blumentritt",
      via: "L. Guinto, Quiapo",
      endpoints: ["Baclaran", "Blumentritt"],
      mainWords: ["Baclaran", "-", "Blumentritt"],
    });
  });

  it("title-cases ALL CAPS but keeps acronyms", () => {
    const p = parseRouteName("BACLARAN - SM FAIRVIEW via EDSA");
    expect(p.name).toBe("Baclaran – SM Fairview");
    expect(p.via).toBe("EDSA");
  });

  it("fixes common typos and abbreviations", () => {
    expect(parseRouteName("Proj 6 Recto via Espana QAve").via).toBe("España Quezon Ave");
    expect(parseRouteName("PROJ 2&3-KALAW ESPANA").name).toBe("Project 2&3 – Kalaw España");
    expect(parseRouteName("Pasay RTDA. - Monumento").name).toBe("Pasay Rotonda – Monumento");
  });

  it("handles a bare hyphen, a missing space before via, and underscores", () => {
    expect(parseRouteName("Angono-Pasig").endpoints).toEqual(["Angono", "Pasig"]);
    expect(parseRouteName("Baclaran - Q.I.via Mabini").via).toBe("Mabini");
    expect(parseRouteName("NAVOTAS - RECTO via DAGAT_DAGATAN C3_C4").via).toBe("Dagat-Dagatan C3-C4");
  });

  it("does not split place names that contain a hyphen", () => {
    expect(parseRouteName("Bel-Air - Washington").endpoints).toEqual(["Bel-Air", "Washington"]);
    expect(parseRouteName("Bagong-Silang SM Fairview").endpoints).toBeUndefined();
  });

  it("leaves names with no separator unsplit", () => {
    const p = parseRouteName("Alabang Fairview");
    expect(p.endpoints).toBeUndefined();
    expect(p.mainWords).toEqual(["Alabang", "Fairview"]);
  });
});

describe("stop names", () => {
  it("cleans spacing and puts the line after the station", () => {
    expect(cleanStopName(" Magellanes MRT  ")).toBe("Magellanes MRT");
    expect(cleanStopName("LRT Balintawak")).toBe("Balintawak LRT");
    expect(stationLabel("Pedro Gil LRT")).toBe("Pedro Gil");
  });
  it("normalizes for matching (accents, case, punctuation)", () => {
    expect(normalizeForMatch("España Blvd., Manila")).toBe("espana blvd manila");
  });
});

describe("geometry", () => {
  it("haversine: Pedro Gil to Quirino LRT is about 650 m", () => {
    const m = haversineM(14.5766, 120.9881, 14.5703, 120.9915);
    expect(m).toBeGreaterThan(600);
    expect(m).toBeLessThan(800);
  });
  it("point-to-segment distance uses the segment, not just its ends", () => {
    const a = { lat: 14.5, lon: 121.0 };
    const b = { lat: 14.5, lon: 121.02 }; // ~2.15 km east
    const mid = { lat: 14.501, lon: 121.01 }; // ~110 m north of the middle
    expect(pointToSegmentM(mid, a, b)).toBeGreaterThan(100);
    expect(pointToSegmentM(mid, a, b)).toBeLessThan(120);
  });
  it("nearbyPairs finds pairs within the radius, once, smaller index first", () => {
    const stops = [
      { lat: 14.5, lon: 121.0 },
      { lat: 14.5018, lon: 121.0 }, // ~200 m north
      { lat: 14.51, lon: 121.0 }, // ~1.1 km north
    ];
    expect(nearbyPairs(stops, 300)).toEqual([[0, 1, 200]]);
  });
});
