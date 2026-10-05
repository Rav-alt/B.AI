# Place search: shorter retries, failure logging, two new landmarks

**Date:** 2026-10-05 13:38
**Prompt I was given:** "Pano pumunta sa STI College Pasay EDSA galing Padre Faura" and "Ayala Mall Manila Bay to Pedro Gil Taft" both answered "Hindi ko mahanap…", even after `NOMINATIM_CONTACT` was added. Improve the place/route data.
**Files touched:** `lib/geo/geocode.ts`, `lib/geo/places.ts`, `lib/chat/pipeline.ts`, `app/api/chat/route.ts`, `data/landmarks.json`, `tests/geo.test.ts`

## What changed
Both questions now get a route. "STI College Pasay EDSA" and "Ayala Mall Manila Bay" are in the local landmark list,
so they're found instantly with no internet search. For places that still aren't in the list, B.AI now retries
OpenStreetMap search (Nominatim) with shorter versions of the name, and the server terminal prints a line for every
place it couldn't find and for every Nominatim error.

## How it was done
1. Found the first cause: `NOMINATIM_CONTACT` was missing from `.env.local`, so `getNominatim()` returned `null` and
   only the 36 landmarks + stop names were searched. The owner added it.
2. Found the second cause: Nominatim only returns a place when **every** query word matches. OpenStreetMap calls it
   "Ayala **Malls** Manila Bay", so "Ayala **Mall** Manila Bay" finds nothing. Errors were also swallowed silently,
   so "not found" and "couldn't reach Nominatim" looked the same.
3. `lib/geo/geocode.ts`: added `searchVariants()` and a retry loop in `geocodeText()` (at most `MAX_SEARCHES` = 4
   Nominatim calls per place). Added an optional `onSearchError` hook. Exported `FILLER` from `places.ts` to reuse it.
4. `lib/chat/pipeline.ts` + `app/api/chat/route.ts`: new `onSearchError` / `onPlaceNotFound` hooks, logged with
   `console.warn` / `console.info` as `[api/chat] place not found (no_match): "…"`.
5. `data/landmarks.json`: added **Ayala Malls Manila Bay** (Wikipedia coordinates) and **STI College Pasay-EDSA**
   (pin from STI's own campus page; the campus is at #2818 EDSA Extension cor. P. Celle St.). Both are ~120 m from a stop.
6. Tests: 6 new ones in `tests/geo.test.ts` (variants, the Ayala plural case with a strict fake Nominatim, giving up
   after 4 tries, stopping at the first error).

### Key code
```ts
// "Ayala Mall Manila Bay" → ["Ayala Mall Manila Bay", "Ayala Manila Bay", ...]
const rank = (i: number) => (LOOSE_WORDS.has(words[i]!.toLowerCase()) ? 0 : i === words.length - 1 ? 1 : 2);
drops.sort((a, b) => rank(a) - rank(b) || b - a);
```
Words like "mall", "college", "EDSA" are dropped first because people add them but OpenStreetMap often spells them
differently or leaves them out. Next goes the last word, then the others. The first word (the brand: SM, STI, Ayala)
is always kept, and at least two words stay, so "Ayala" alone never goes out as a search.

## Why it was done this way
- **Reason for the approach:** Nominatim has no typo or plural tolerance, so the cheapest fix is asking again with
  less text. Landmarks were added too, because the local list is instant, works when Nominatim is down, and doesn't
  use up the 1-request-per-second budget.
- **Alternatives considered:** Google Places (better PH coverage, but paid; `CLAUDE.md` says free tiers only);
  Photon (OSM search with fuzzy matching, but another outside service with its own rules); having Gemini rewrite the
  place name (a third AI call, which breaks the 2-calls-per-question rule).
- **Trade-offs:** an unknown place can now take up to ~4 s of Nominatim time (1 s per call), or ~8 s if both places
  are unknown. Still inside `maxDuration = 30`, and the answer step already skips Gemini after 12 s.
  "STI" alone now means the Pasay-EDSA campus, even though STI has other campuses.

## Concepts to learn from this
- **Query relaxation** — when a strict search finds nothing, retry with a looser version of the query.
- **Silent failure** — a `catch` that returns a normal-looking result hides the real problem; a logging hook fixes that.
- **Dependency injection for logging** — the pipeline takes `onPlaceNotFound` as a parameter, so tests can check it and
  the route decides where logs go.

## How to undo or tweak it
- Number of retries: `MAX_SEARCHES` in `lib/geo/geocode.ts` (set to 1 to turn retries off).
- Which words are dropped first: `LOOSE_WORDS` in the same file.
- New places: add an entry to `data/landmarks.json` with a `source`; `tests/geo.test.ts` checks it's within 600 m of a stop.
- To find places worth adding: watch the `npm run dev` terminal for `place not found` lines.

## Checks performed
- [x] Baseline 128 tests passed before the change; 134 pass after (`npx vitest run`).
- [x] `npx tsc --noEmit`: 0 errors.
- [x] Real network + landmarks: "padre paura" → Taft/Padre Faura, then a route to STI College Pasay-EDSA (jeep Baclaran – Divisoria);
      "Ayala Mall Manila Bay" ↔ "Pedro Gil Taft" both directions return routes.
- [x] `npm run build:data` with the new landmarks gives the same `network.json` (only `builtAt` differs), so no
      route names or directions changed.
- [ ] Not checked: real Nominatim answers (the cloud workspace can't reach it). Owner: restart `npm run dev` and try a
      place that isn't in the list, e.g. "Robinsons Place Manila", and watch the terminal.
