# Phase 1: GTFS → network.json data pipeline

**Date:** 2026-10-04 23:55
**Prompt I was given:** "lets continue with the phase 1"
**Files touched:** `lib/types.ts`, `lib/data/{csv,mode,names,direction,corrections,build}.ts`, `lib/geo/haversine.ts`,
`lib/router/network.ts`, `scripts/build-data.ts`, `data/corrections.json`, `data/generated/network.json`,
`tests/{data-helpers,build-network,network}.test.ts`, `docs/data-notes.md`, `PLAN.md`, `CLAUDE.md`

## What changed
Nothing visible in the browser yet. `npm run build:data` now turns the 2015 GTFS feed into one compact
file, `data/generated/network.json` (~1.7 MB): 1,719 "patterns" (a route ridden one way), 4,835 stops and
7,152 short walks between nearby stops. Signboard names are cleaned up ("BACLARAN - DAPITAN via TAFT" →
"Baclaran – Dapitan", via "Taft"), PNR is removed, Roosevelt station is now Fernando Poe Jr., and 80% of
road routes know which way they're heading. 35 tests pass, plus build, type-check and lint.

## How it was done
1. `lib/types.ts`: zod schemas for the network (Stop, Pattern, Transfer, Network) and for router output
   (RideLeg, WalkLeg, Itinerary). `NetworkSchema` also checks the file is internally consistent
   (stop indices in range, distances never decrease).
2. `lib/data/`: the Phase 0 CSV parser moved here; `modeOf()` (jeep vs bus from the route ID);
   `parseRouteName()` (name cleanup); `corrections.ts` (schema for the fixes file); `build.ts` with one
   pure function, `buildNetwork(feed, corrections)`, that does all the work without touching files.
3. `scripts/build-data.ts` only reads the CSVs, calls `buildNetwork`, writes the JSON one item per
   line (so git diffs stay readable) and prints counts.
4. Found and fixed two map problems: train return trips reused the forward shape (now flipped), and
   stations were measured against shape *points* instead of the *line between them* (now segments).
5. Direction: matched signboard places to stop names (59% solved), then used solved routes to "learn"
   where places are and tried again (75%), then accepted routes that stop short of their signboard ends
   when one direction is clearly better (80%). Checked all 625 two-way pairs: none contradict.
6. `data/corrections.json`: removed PNR (source: Rappler, Mar 2024) and renamed the Roosevelt stop
   (source: BusinessMirror, Aug 2023).
7. Tests: small helpers, a hand-made 9-stop feed that checks every build rule, and the real network.

### Key code
The one-line idea behind "which way does this jeep go?":

```ts
const ab = minDist(first, stopsNamed(A)) + minDist(last, stopsNamed(B)); // runs A → B?
const ba = minDist(first, stopsNamed(B)) + minDist(last, stopsNamed(A)); // runs B → A?
if (score < 4000 && Math.abs(ab - ba) > 1000) towards = ab < ba ? B : A; // only when clearly one way
```
If the first stop sits near places called "Baclaran" and the last near places called "SM Fairview",
the route heads to SM Fairview. When it's not clear, we leave it blank rather than guess.

## Why it was done this way
- **Reason for the approach:** the build logic is a pure function, so tests feed it a tiny fake feed and
  check each rule by hand; the real 79k-row feed is only needed for the final check.
- **Alternatives considered:** storing stop IDs instead of indices in patterns (easier to read, ~600 KB
  bigger); precomputing nothing and finding transfers at runtime (smaller file, slower first request);
  hand-labelling directions (accurate but 1,700 routes is too many).
- **Trade-offs:** 20% of road routes have no `towards`, so the router and UI must handle that. The
  direction guess can be wrong for a messy signboard; it's only used for wording ("papuntang …"), never
  for routing, because routing uses the actual stop order.

## Concepts to learn from this
- **Pure function** — same input, same output, no files or network. Easy to test, easy to trust.
- **Data pipeline / build step** — slow, messy work (parsing CSVs) is done once ahead of time, so the
  app only loads a clean, small file.
- **Bootstrapping** — using answers you're sure of to help answer the harder cases (pass 2 of directions).

## How to undo or tweak it
- Transfer walking radius: `transferRadiusM` in `lib/data/build.ts` (default 300).
- Direction strictness: the `*_M` and `LOPSIDED_RATIO` constants at the top of `lib/data/direction.ts`.
- Name fixes: `ACRONYMS`, `WORD_FIXES`, `KEEP_HYPHEN` in `lib/data/names.ts`.
- Data fixes: `data/corrections.json`, then `npm run build:data` and commit the new `network.json`.

## Checks performed
- [x] `npm run build:data` succeeds with no warnings (~2 s)
- [x] `npm test` — 35 tests pass (helpers, fake-feed build, real network incl. Pedro Gil → España ≥10 direct routes)
- [x] `npm run build`, `npx tsc --noEmit`, `npm run lint` pass
- [x] Spot-checked ~20 solved directions by hand against first/last stop names; 625/625 two-way pairs consistent

## What's not finished
- Big corrections (EDSA Carousel, LRT-1 Cavite and LRT-2 East extensions) need stop lists with sources; still open.
- 347 road patterns have no `towards`; Phase 3's `landmarkAliases` will lift this automatically.
