# Phase 0: project scaffold and GTFS data check

**Date:** 2026-10-04 23:30
**Prompt I was given:** "Let's start with Phase 0." (folder: `C:\Projects\B.AI`)
**Files touched:** `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`, `vitest.config.ts`,
`app/layout.tsx`, `app/globals.css`, `README.md`, `tests/sanity.test.ts`, `scripts/build-data.ts`,
`scripts/inspect-gtfs.ts`, `scripts/test-gemini.ts`, `docs/data-notes.md`, empty folders under `lib/` and `data/`

## What changed
There is now a real Next.js project in `C:\Projects\B.AI`. It still shows the default Next.js page,
but tests, type-checking, linting and the production build all pass. More importantly, we now know
what the GTFS data looks like: it is usable, both acceptance-test trips can be answered from it,
and `docs/data-notes.md` lists exactly what must be patched.

## How it was done
1. Ran `create-next-app` (Next 16, TypeScript, App Router, Tailwind v4, ESLint, no `src/`).
2. In `tsconfig.json`: kept `strict: true`, added `noUncheckedIndexedAccess: true`, raised `target` to ES2022.
3. Installed `vitest` and `tsx` (dev) and `zod` (runtime, because API routes will validate with it).
   Bumped `@types/node` to v22 because Vitest 5 refuses the older v20 types.
4. Added npm scripts `test`, `build:data` (placeholder), `inspect:gtfs`, `test:gemini`.
5. Removed the default Geist fonts from `app/layout.tsx` (Phase 5 brings Archivo + IBM Plex Mono) and set `lang="fil"`.
6. Fixed `.gitignore`: the default `.env*` would also hide `.env.example`, so it now ignores `.env` and `.env*.local` only. Added `/data/raw/`.
7. Downloaded `sakayph/gtfs` into `data/raw/`, read its `LICENSE.md`, and wrote `scripts/inspect-gtfs.ts`.
8. Ran the script plus a few follow-up queries, then wrote `docs/data-notes.md`.
9. Looked up the current free Gemini Flash model and wrote `scripts/test-gemini.ts` for one test call.

### Key code
The single most useful discovery: the mode is hidden in the route ID, not in `route_type`.

```ts
if (route.route_type === "1" || route.route_type === "2") return "train";
if (route.route_id.startsWith("LTFRB_PUJ")) return "jeep"; // PUJ = Public Utility Jeepney
if (route.route_id.startsWith("LTFRB_PUB")) return "bus";  // PUB = Public Utility Bus
```

All 1,711 road routes have `route_type 3` ("bus" in GTFS terms), so without this we couldn't tell a jeep from a bus.

## Why it was done this way
- **Reason for the approach:** look at the data before writing app code (PLAN.md). One throwaway
  script answered most open questions in a minute.
- **Alternatives considered:** reading the CSVs in a spreadsheet (too big: 79k stop_times rows);
  using a GTFS library (overkill for a spike, and another dependency).
- **Trade-offs:** the CSV parser in the script is hand-written and minimal. Phase 1 can reuse it,
  but it should get a unit test first.
- **Honest note:** the work was built in a cloud workspace and copied into your folder, because this
  session had no terminal on your PC. `node_modules` was not copied; run `npm install`.

## Concepts to learn from this
- **GTFS** — the standard file format for transit data: `routes.txt` (lines), `trips.txt` (runs of a line), `stops.txt`, and `stop_times.txt` (which stops a trip visits, in order).
- **`noUncheckedIndexedAccess`** — makes `array[i]` typed as "maybe undefined", so you must handle a missing element instead of crashing at runtime.
- **Data spike** — a quick, disposable investigation done before building, to turn unknowns into facts.

## How to undo or tweak it
- Re-run the data check any time: `npm run inspect:gtfs` (needs the feed in `data/raw/`).
- Change the Gemini model by editing `GEMINI_MODEL` in `.env.local`.
- To relax strictness, remove `noUncheckedIndexedAccess` from `tsconfig.json` (not recommended).

## Checks performed
- [x] `npm run build` passes
- [x] `npm test` passes (2 tests)
- [x] `npx tsc --noEmit` and `npm run lint` pass
- [x] `npm run dev` serves the page (HTTP 200)
- [x] `test:gemini` prints a clear error with no key and with a bad key

## What's not finished
- The Gemini test call itself: it needs your AI Studio key (run `npm run test:gemini` on your PC),
  and the free-tier RPM/RPD numbers must be copied from AI Studio into `docs/data-notes.md`.
- `npm install` and `git init` on your PC.
