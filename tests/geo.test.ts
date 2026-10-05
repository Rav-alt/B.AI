// Phase 3: geocoding. Local matching runs on the real landmarks + network; Nominatim is always mocked.
import { describe, expect, it, vi } from "vitest";
import { loadNetwork } from "@/lib/router/network";
import { loadLandmarks } from "@/lib/geo/landmarks";
import { insideMetroManila } from "@/lib/geo/bbox";
import { matchPlace } from "@/lib/geo/places";
import { createNominatim, NOMINATIM_URL, type NominatimClient } from "@/lib/geo/nominatim";
import { geocodeText, MAX_SEARCHES, placeFromCoords, searchVariants } from "@/lib/geo/geocode";
import { haversineM } from "@/lib/geo/haversine";
import { GeocodeResultSchema, type GeocodeResult } from "@/lib/types";
import { normalizeText } from "@/lib/text";

const net = loadNetwork();
const landmarks = loadLandmarks();
const local = (q: string) => matchPlace(net, landmarks, q);
const found = (r: GeocodeResult) => {
  expect(r.status, JSON.stringify(r).slice(0, 300)).toBe("found");
  return (r as Extract<GeocodeResult, { status: "found" }>).place;
};

describe("data/landmarks.json", () => {
  it("validates, sits inside Metro Manila, and has a source for every entry", () => {
    expect(landmarks.length).toBeGreaterThanOrEqual(30);
    for (const l of landmarks) {
      expect(insideMetroManila(l.lat, l.lon), l.name).toBe(true);
      expect(l.source.length, l.name).toBeGreaterThan(10);
    }
  });

  it("every landmark is within 600 m of a stop (so the router can use it)", () => {
    for (const l of landmarks) {
      const nearest = Math.min(...net.stops.map((s) => haversineM(l.lat, l.lon, s.lat, s.lon)));
      expect(nearest, l.name).toBeLessThan(600);
    }
  });

  it("names are unique; the only alias shared on purpose is Buendia (Taft vs EDSA)", () => {
    const seen = new Map<string, string>();
    const shared = new Set<string>();
    for (const l of landmarks)
      for (const n of [l.name, ...l.aliases]) {
        const k = normalizeText(n);
        if (seen.has(k) && seen.get(k) !== l.name) shared.add(k);
        seen.set(k, l.name);
      }
    expect([...shared]).toEqual(["buendia"]);
  });
});

describe("matchPlace (local landmarks + stop names)", () => {
  it("finds a landmark by name", () => {
    const p = found(local("Pedro Gil Taft"));
    expect(p).toMatchObject({ name: "Pedro Gil Taft", source: "landmark" });
  });

  it("finds a landmark by alias, ignoring case and accents", () => {
    expect(found(local("ESPANA")).name).toBe("UST");
    expect(found(local("araneta center")).name).toBe("Cubao");
  });

  it("ignores filler words from the question", () => {
    expect(found(local("nasa Cubao ako")).name).toBe("Cubao");
    expect(found(local("malapit sa MOA")).name).toBe("SM Mall of Asia");
  });

  it("forgives a typo", () => {
    expect(found(local("Quiapo Chruch")).name).toBe("Quiapo Church");
  });

  it("falls back to stop names", () => {
    const p = found(local("Gilmore LRT"));
    expect(p.source).toBe("stop");
    expect(p.stopId).toBeDefined();
  });

  it("Lawton means the Manila one, not Lawton Ave in Taguig", () => {
    const p = found(local("Lawton"));
    expect(p.lat).toBeCloseTo(14.594, 2);
    expect(p.lon).toBeCloseTo(120.979, 2);
  });

  it("asks when a name fits places far apart", () => {
    const r = local("Buendia");
    expect(r.status).toBe("ambiguous");
    if (r.status === "ambiguous") expect(r.choices.map((c) => c.name).sort()).toEqual(["Buendia MRT", "Gil Puyat LRT"]);
    const taft = local("Taft");
    expect(taft.status).toBe("ambiguous"); // Taft Avenue is 6 km long
    if (taft.status === "ambiguous") expect(taft.choices.length).toBeLessThanOrEqual(5);
  });

  it("returns not_found for gibberish or an empty question", () => {
    expect(local("xyzzy plugh")).toEqual({ status: "not_found", reason: "no_match" });
    expect(local("nasa ako").status).toBe("not_found");
  });

  it("every result matches the schema", () => {
    for (const q of ["Cubao", "Buendia", "Gilmore LRT", "xyzzy"]) expect(GeocodeResultSchema.parse(local(q))).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Nominatim (always mocked: tests must never call the real service)
// ---------------------------------------------------------------------------

function fakeFetch(body: unknown, status = 200) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));
}
const hit = (name: string, lat: number, lon: number, display = `${name}, Sampaloc, Manila, Metro Manila, Philippines`) => ({
  name, lat: String(lat), lon: String(lon), display_name: display, category: "amenity", type: "cafe", importance: 0.2,
});
/** A fake clock: sleep() moves time forward instead of waiting. */
function fakeClock() {
  let t = 1_000_000;
  const sleeps: number[] = [];
  return { now: () => t, sleep: async (ms: number) => { sleeps.push(ms); t += ms; }, sleeps, advance: (ms: number) => { t += ms; } };
}

describe("Nominatim client", () => {
  it("sends the right query: Metro Manila box, bounded, Philippines, identifying User-Agent", async () => {
    const fetch = fakeFetch([]);
    const c = fakeClock();
    const nom = createNominatim({ contact: "owner@example.com", fetch, now: c.now, sleep: c.sleep });
    await nom.search("Kanto Freestyle Breakfast");
    const [url, init] = fetch.mock.calls[0]!;
    const u = new URL(String(url));
    expect(u.origin + u.pathname).toBe(NOMINATIM_URL);
    expect(u.searchParams.get("q")).toBe("Kanto Freestyle Breakfast");
    expect(u.searchParams.get("countrycodes")).toBe("ph");
    expect(u.searchParams.get("viewbox")).toBe("120.9,14.8,121.15,14.35");
    expect(u.searchParams.get("bounded")).toBe("1");
    expect(u.searchParams.get("format")).toBe("jsonv2");
    expect(new Headers(init?.headers).get("User-Agent")).toBe("B.AI-commute-helper/1.0 (contact: owner@example.com)");
  });

  it("waits at least 1 second between requests", async () => {
    const fetch = fakeFetch([]);
    const c = fakeClock();
    const nom = createNominatim({ contact: "a@b.c", fetch, now: c.now, sleep: c.sleep });
    await Promise.all([nom.search("one"), nom.search("two"), nom.search("three")]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(c.sleeps).toEqual([1000, 1000]);
  });

  it("caches answers (including empty ones) so repeats don't hit the service", async () => {
    const fetch = fakeFetch([hit("Cafe", 14.6, 120.99)]);
    const c = fakeClock();
    const nom = createNominatim({ contact: "a@b.c", fetch, now: c.now, sleep: c.sleep, cacheSize: 2 });
    await nom.search("Cafe");
    await nom.search("  cafe ");
    expect(fetch).toHaveBeenCalledTimes(1);
    await nom.search("b");
    await nom.search("c"); // evicts "cafe" (least recently used)
    await nom.search("cafe");
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("refuses to run without a contact, and throws on HTTP errors", async () => {
    expect(() => createNominatim({ contact: "" })).toThrow();
    const c = fakeClock();
    const nom = createNominatim({ contact: "a@b.c", fetch: fakeFetch({}, 429), now: c.now, sleep: c.sleep });
    await expect(nom.search("x")).rejects.toThrow(/429/);
  });
});

describe("geocodeText (local first, then Nominatim)", () => {
  const ctx = (nominatim: NominatimClient | null) => ({ net, landmarks, nominatim });
  const nomWith = (results: unknown[] | Error): NominatimClient => ({
    search: vi.fn(async () => {
      if (results instanceof Error) throw results;
      const fetch = fakeFetch(results);
      const c = fakeClock();
      return createNominatim({ contact: "a@b.c", fetch, now: c.now, sleep: c.sleep }).search("q");
    }),
  });

  it("never calls Nominatim when the local list knows the place", async () => {
    const nom = nomWith([]);
    const r = await geocodeText("Cubao", ctx(nom));
    expect(found(r).name).toBe("Cubao");
    expect(nom.search).not.toHaveBeenCalled();
  });

  it("uses one Nominatim result", async () => {
    const r = await geocodeText("Kanto Freestyle Breakfast Kalayaan", ctx(nomWith([hit("Kanto Freestyle", 14.5571, 121.0498, "Kanto Freestyle, Kalayaan Avenue, Makati, Metro Manila, Philippines")])));
    const p = found(r);
    expect(p).toMatchObject({ name: "Kanto Freestyle", source: "nominatim", area: "Kalayaan Avenue, Makati" });
  });

  it("asks when Nominatim returns places far apart, and treats same-spot results as one", async () => {
    const far = await geocodeText("Jollibee Zzz", ctx(nomWith([hit("Jollibee", 14.60, 120.99), hit("Jollibee", 14.55, 121.03)])));
    expect(far.status).toBe("ambiguous");
    const same = await geocodeText("Jollibee Zzz", ctx(nomWith([hit("Jollibee", 14.6, 120.99), hit("Jollibee", 14.6001, 120.9901)])));
    expect(same.status).toBe("found");
  });

  it("drops results outside Metro Manila", async () => {
    const r = await geocodeText("Zzz Baguio", ctx(nomWith([hit("Session Road", 16.41, 120.6)])));
    expect(r).toEqual({ status: "not_found", reason: "no_match" });
  });

  it("says search_unavailable when Nominatim is off or failing", async () => {
    expect(await geocodeText("Zzz unknown", ctx(null))).toEqual({ status: "not_found", reason: "search_unavailable" });
    expect(await geocodeText("Zzz unknown", ctx(nomWith(new Error("down"))))).toEqual({ status: "not_found", reason: "search_unavailable" });
  });
});

describe("searchVariants (shorter retries for Nominatim)", () => {
  it("drops a loose word first: 'Ayala Mall Manila Bay' also tries 'Ayala Manila Bay'", () => {
    const v = searchVariants("Ayala Mall Manila Bay");
    expect(v[0]).toBe("Ayala Mall Manila Bay");
    expect(v[1]).toBe("Ayala Manila Bay");
  });

  it("drops filler, keeps the first word, and stays within MAX_SEARCHES", () => {
    const v = searchVariants("sa STI College Pasay EDSA");
    expect(v[0]).toBe("STI College Pasay EDSA");
    expect(v).toContain("STI College Pasay");
    expect(v.length).toBeLessThanOrEqual(MAX_SEARCHES);
    expect(v.every((q) => q.startsWith("STI "))).toBe(true);
  });

  it("never shortens two-word names to one word", () => {
    expect(searchVariants("Robinsons Manila")).toEqual(["Robinsons Manila"]);
    expect(searchVariants("papunta sa")).toEqual([]);
  });
});

describe("geocodeText retries", () => {
  const ctxOf = (nominatim: NominatimClient, onSearchError?: (q: string, e: unknown) => void) =>
    ({ net, landmarks, nominatim, ...(onSearchError ? { onSearchError } : {}) });

  it("finds 'Okada Mall Manila' when OpenStreetMap only knows 'Okada Manila'", async () => {
    // Fake Nominatim: like the real one, every query word must be in the name.
    const osmName = "Okada Manila";
    const search = vi.fn(async (q: string) => {
      const words = osmName.toLowerCase().split(" ");
      return q.toLowerCase().split(" ").every((w) => words.includes(w))
        ? [{ name: osmName, lat: 14.5149, lon: 120.9821, area: "Parañaque" }]
        : [];
    });
    // No landmark or stop has this name, so this always goes to the (fake) Nominatim.
    // (Ayala Malls Manila Bay used to be the example; it is now an EDSA Carousel stop, so it matches locally.)
    const r = await geocodeText("Okada Mall Manila", { net, landmarks: [], nominatim: { search } });
    expect(search.mock.calls.map((c) => c[0])).toEqual(["Okada Mall Manila", "Okada Manila"]);
    expect(found(r).name).toMatch(/Okada Manila/);
  });

  it("retries a made-up place with shorter queries, then gives up with no_match", async () => {
    const search = vi.fn(async () => []);
    const r = await geocodeText("Zzqx Qwerty Plaza Annex", ctxOf({ search }));
    expect(r).toEqual({ status: "not_found", reason: "no_match" });
    expect(search.mock.calls.length).toBe(MAX_SEARCHES);
  });

  it("stops at the first error, reports it, and says search_unavailable", async () => {
    const search = vi.fn(async () => { throw new Error("HTTP 403"); });
    const onSearchError = vi.fn();
    const r = await geocodeText("Zzqx Qwerty Plaza Annex", ctxOf({ search }, onSearchError));
    expect(r).toEqual({ status: "not_found", reason: "search_unavailable" });
    expect(search).toHaveBeenCalledTimes(1);
    expect(onSearchError).toHaveBeenCalledWith("Zzqx Qwerty Plaza Annex", expect.any(Error));
  });
});

describe("placeFromCoords (use my location)", () => {
  it("accepts a point in Metro Manila and refuses one outside", () => {
    expect(placeFromCoords(14.6, 121.0)).toMatchObject({ status: "found", place: { source: "device", lat: 14.6, lon: 121.0 } });
    expect(placeFromCoords(16.41, 120.6).status).toBe("outside_area");
  });
});

describe("geocode → router (Phase 2 + 3 together)", () => {
  it("'Pedro Gil Taft' to 'UST' gives a route without any coordinates typed", async () => {
    const { planTrip } = await import("@/lib/router/plan");
    const ctx = { net, landmarks, nominatim: null };
    const a = found(await geocodeText("nasa Pedro Gil Taft", ctx));
    const b = found(await geocodeText("UST", ctx));
    const res = planTrip(net, a, b);
    expect(res.status).toBe("ok");
  });
});
