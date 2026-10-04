# Phase 3: geocoding (place names → map points)

**Date:** 2026-10-05 00:50
**Prompt I was given:** "sure" (start Phase 3 after Phase 2)
**Files touched:** `data/landmarks.json` (new), `lib/geo/{bbox,landmarks,cluster,places,nominatim,geocode}.ts` (new),
`lib/text.ts` (new, moved from `lib/router/match.ts`), `lib/types.ts`, `scripts/build-data.ts`, `scripts/try-router.ts`,
`data/corrections.json`, `data/generated/network.json`, `tests/geo.test.ts`, `docs/data-notes.md`, `PLAN.md`, `CLAUDE.md`

## What changed
B.AI can now turn what people type ("nasa Pedro Gil Taft", "UST", "malapit sa MOA", "Quiapo Chruch") into a
point on the map, so the router no longer needs coordinates. It checks a hand-made list of 36 landmarks and every
train station and stop name first (instant, free). Only if nothing fits does it ask OpenStreetMap's search
(Nominatim), politely: one request per second, an identifying User-Agent, and a cache. When a name fits places far
apart ("Buendia": Taft or EDSA?) it returns the choices so B.AI can ask "Alin dito?". `npm run try:router --
"Katipunan" "Lawton"` now works with plain names. 85 tests pass.

## How it was done
1. **`data/landmarks.json`**: 36 places with aliases (stations, schools, malls, corners). Coordinates come from
   Wikipedia (26), GTFS stops (6), or are marked "Approximate" (4); every entry says which. Nominatim itself can't be
   reached from the build machine, so each point was also checked against the nearest stops in our network.
2. **`lib/geo/places.ts`**: the local matcher. (a) An exact landmark or station name wins outright, so "Lawton" is
   the Manila one, not Lawton Ave in Taguig. (b) Otherwise every important word must match (typos allowed), names
   that cover more of the question score higher, and results within 600 m of each other count as one place.
   (c) Several far-apart winners → "ambiguous", each labelled with its nearest landmark ("near Quezon MRT").
3. **`lib/geo/nominatim.ts`**: the fallback client: a queue that waits ≥1 s between requests, a 200-entry LRU cache
   (also remembers "nothing found"), Metro Manila box with `bounded=1`, zod-checked responses.
4. **`lib/geo/geocode.ts`**: `geocodeText()` = local first, then Nominatim; `placeFromCoords()` for "use my location"
   (refuses points outside Metro Manila).
5. **Data rebuild**: `build-data` now also reads the landmarks to work out which way routes go. Known directions rose
   from 1,361 to 1,395; it also *fixed* "Cartimar – EDSA/Buendia". One route name got split wrongly ("Arroceros
   Project – 7"), fixed with a `renameRoutes` entry.

### Key code
```ts
// 1. Exact landmark or station name wins outright ("Lawton" is the Manila one, full stop).
const exact = landmarks.filter((l) => [l.name, ...l.aliases].some((n) => normalizeText(n) === key));
// 2. Otherwise: fuzzy words, then group results that are < 600 m apart.
const clusters = clusterByDistance(cands.filter((c) => c.score >= best - SCORE_WINDOW), SAME_PLACE_M);
if (clusters.length === 1) return { status: "found", place: clusters[0][0].place };
return { status: "ambiguous", choices: clusters.slice(0, 5).map((c) => c[0].place) };
```
Twelve stops on one corner are one answer; stops 4 km apart are a question back to the user.

## Why it was done this way
- **Local first:** most questions name well-known places. The local list is instant, free and works with no internet,
  and it keeps traffic to Nominatim (a volunteer-run service) very low.
- **Alternatives considered:** Nominatim only (slow, 1 req/s limit, misreads "Lawton"/"Rotonda"); Google Places
  (paid, ruled out); a fuzzy-search library like Fuse.js (another dependency for something ~100 lines can do).
- **Trade-offs:** the landmark list must be curated by hand. On Vercel each server instance has its own Nominatim
  queue and cache, so the 1 req/s limit is per instance, fine for a portfolio project's traffic.

## Concepts to learn from this
- **Geocoding**: turning a place name into latitude/longitude.
- **Rate limiting with a promise queue**: each request waits for the previous one, plus a pause.
- **LRU cache** ("least recently used"): keep the newest N answers; JavaScript's `Map` remembers insertion order, so
  delete-and-re-add moves an entry to the "newest" end.

## How to undo or tweak it
- Add or fix a place: `data/landmarks.json` (needs `source` + `updated`), then `npm run build:data` to refresh directions.
- Filler words ("nasa", "malapit") and generic words ("Ave", "City"): `FILLER` / `GENERIC` in `lib/geo/places.ts`.
- "Same place" distance (600 m): `SAME_PLACE_M` in `lib/geo/places.ts`.
- Nominatim pacing / cache size: options of `createNominatim()` in `lib/geo/nominatim.ts`.

## Checks performed
- [x] `npm test`: 85 tests (23 new): exact, alias, filler, typo, stop fallback, Lawton, ambiguous (Buendia, Taft),
      not found, Nominatim URL/User-Agent/throttle/cache/errors (mocked, never the real service), use-my-location
- [x] `npm run build`, `npx tsc --noEmit`, `npm run lint` pass
- [x] Rebuilt `network.json`: only route directions changed (+34 known, 1 fixed, 0 lost), 518/518 two-way pairs consistent
- [x] Hand-checked ~30 common names ("Guadalupe" → MRT station, "Makati" → Ayala Triangle, "Marikina" → ask)

## What's not finished
- Nominatim has only been tested with mocks; the first real call happens in Phase 4 with `NOMINATIM_CONTACT` set.
- City-sized names ("Pasig", "Marikina") give 5 random street choices; Phase 4's answer should ask for a landmark instead.
