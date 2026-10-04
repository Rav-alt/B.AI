# B.AI — Build Plan

> **For every agent:** this is the order of work. Start with **Current status** below to see where
> the project is. Finish a phase's exit checks before starting the next one. Detailed specs live in
> `CLAUDE.md` (architecture) and `DESIGN.md` (UI). After each task, follow `LEARNING_LOG_PROTOCOL.md`
> and update the status block.

---

## ▶ Current status — read this first

> **Every agent:** update this block at the end of any task that finishes a step or changes what
> comes next. Keep it short; details go in `docs/learning-log/`.

**Last updated:** 2026-10-04 23:55 (Asia/Manila)
**Current phase:** Phase 1 done. **Next: Phase 2 — Router.**
**Repo:** https://github.com/Rav-alt/B.AI (branch `main`) · local copy: `C:\Projects\B.AI`

### Done
- ✅ **Phase 0** — scaffold builds, data checked, Gemini works. Findings in `docs/data-notes.md`.
- ✅ **Phase 1** — `npm run build:data` writes `data/generated/network.json` (1,719 patterns, 4,835 stops,
  7,152 walking transfers, ~1.7 MB). Corrections applied: PNR removed, Roosevelt → Fernando Poe Jr.
  35 tests pass. Results and the direction rules: `docs/data-notes.md` → "Phase 1 results".

### Open items
- [ ] Copy the free-tier RPM / TPM / RPD for `gemini-3.8-flash` from https://aistudio.google.com/rate-limit
      into the table in `docs/data-notes.md`. Only needed by Phase 4.
- [ ] Workflow: the cloud agent **can't push** to the repo (the Claude GitHub App isn't installed for it), so for
      now work is copied into `C:\Projects\B.AI` and the owner commits and pushes. To let agents push to a
      branch instead, install the app: https://github.com/apps/claude/installations/select_target
- [ ] Remaining corrections (EDSA Carousel, LRT-1 Cavite ext., LRT-2 East ext., stale EDSA buses): list in
      `docs/data-notes.md`. Not blocking; add as the router tests show where they matter.

### Key facts every agent needs
- **Stack as installed:** Next.js **16.3** (read `AGENTS.md`: APIs differ from older Next), React 19, Tailwind v4,
  TypeScript strict + `noUncheckedIndexedAccess`, vitest 5, tsx, zod 4, `@google/genai` 2.x. Node ≥ 22.
  Run `npm run build` once before `npx tsc --noEmit` (Next generates the `LayoutProps` type).
- **npm scripts:** `dev`, `build`, `test`, `lint`, `build:data`, `inspect:gtfs`, `test:gemini`.
- **Data in:** the GTFS feed goes in `data/raw/` (git-ignored): `git clone --depth 1 https://github.com/sakayph/gtfs data/raw`.
  Fixes go in `data/corrections.json` (validated by `lib/data/corrections.ts`; every entry needs `source` + `updated`).
- **Data out:** `data/generated/network.json` is committed. Types in `lib/types.ts` (`Network`, `Pattern`, `Stop`,
  `Transfer`, plus `Leg`/`Itinerary` for the router). Load it server-side with `loadNetwork()` from `lib/router/network.ts`.
- **Pattern = one route ridden one way.** `stops` are indices into `network.stops`; ride forward only.
  `dist` = cumulative metres. `shape`/`shapeIdx` only on 8 patterns, otherwise draw stop to stop.
  `towards` (which end it heads to) is known for 80% of road patterns; **handle it missing**.
- **Acceptance data:** Pedro Gil Taft → España has ≥10 direct forward patterns (test in `tests/network.test.ts`).
- **Gemini:** `gemini-3.8-flash`, free tier. Thinking is on by default, so Phase 4 must set a low/zero thinking budget.
- **Secrets:** the API key lives only in `.env.local` (git-ignored). `.env.example` keeps **empty** values.
  Never commit a key or click "allow secret".

### Next steps (Phase 2 — Router, test-first, pure functions in `lib/router/`)
1. Nearby-stops lookup (grid index over `network.stops`) and walking estimates (e.g. 80 m/min, straight-line × ~1.3).
2. Mode speeds for `estMinutes` from `dist` (pick and write down, e.g. train 30 km/h, bus 15, jeep 12).
3. `planTrip()`: round-based search over patterns + `transfers`, max 2 transfers, forward only,
   cost = ride min + walk min × 2 + 8 min per transfer, prefs; top 3 *diverse* itineraries → `Itinerary[]`.
4. `checkRoutes()`: fuzzy signboard match on `name`/`rawName`/`endpoints`, yes/no + board/alight + reason.
5. Tests: never ridden backwards, Pedro Gil Taft → España ≥1 itinerary, Fairview bus = yes / Divisoria jeep = no.

---

## Why this order

The riskiest unknown is **the data**. Everything else depends on it:

```
GTFS data  →  network.json  →  router  →  AI answer  →  UI
```

- The router can't be designed well until we know what the GTFS feed actually contains
  (how many routes, whether shapes exist, how signboard names are written, how many are stale).
- The UI shows what the router returns, so its data shape must be settled first.
- The AI layer is the easiest part to swap or fix, so it comes late.

So we **look at the data before writing app code**, then build from the bottom of the pipeline up.

---

## Phase 0 — Foundation and data check ✅ done 2026-10-04

Goal: a running empty project, and a written answer to "is the data good enough, and what does it look like?"
**Answer: yes, usable.** See `docs/data-notes.md` and `docs/learning-log/2026-10-04_2330_phase-0-scaffold-and-data-check.md`.

### 0.1 Scaffold the project ✅
- `npx create-next-app@latest` with TypeScript, App Router, Tailwind, ESLint, no `src/` folder. *(Got Next 16.3.)*
- Turn on `"strict": true` in `tsconfig.json` (check `noUncheckedIndexedAccess` too). *(Both on.)*
- Install dev tools: `vitest`, `tsx` (to run `scripts/*.ts`), `zod`. *(zod is a runtime dependency; `@types/node` bumped to v22 for vitest 5.)*
- Create empty folders from `CLAUDE.md` → "Suggested folder structure": `lib/router`, `lib/geo`,
  `lib/ai`, `data`, `data/generated`, `scripts`, `tests`.
- Add `.env.example` with `GEMINI_API_KEY`, `GEMINI_MODEL`, `NOMINATIM_CONTACT` (empty values).
  Make sure `.env*.local` is in `.gitignore`.
- Add `npm` scripts: `test`, `build:data`. *(Also `inspect:gtfs`, `test:gemini`.)*
- One trivial vitest test so `npm test` passes. *(`tests/sanity.test.ts`.)*
- **Don't** set up shadcn, Motion, fonts, or Leaflet yet. That's Phase 5. *(Default Geist fonts were removed.)*

**Exit check:** `npm run dev` shows the default page, `npm test` passes, `npm run build` passes. ✅

### 0.2 Get and inspect the GTFS feed (data spike) ✅
- Download the `sakayph/gtfs` files into `data/raw/` (add `data/raw/` to `.gitignore`; we commit only the generated output).
- Read the repo's `LICENSE.md` and confirm it matches the rules in `CLAUDE.md`. *(It does.)*
- Write a throwaway script `scripts/inspect-gtfs.ts` that prints counts, route types, agencies, sample
  names, shape/direction coverage, the stop bounding box, and stops near the acceptance-test places.
- Manually check: is there a route that plausibly takes you from **Pedro Gil Taft to España**? *(Yes: 13 direct routes.)*

### 0.3 Write down what you found ✅
`docs/data-notes.md`: counts, mode mapping rule, signboard naming rule, known gaps, first corrections list.

### 0.4 Confirm the free AI tier ✅ (one TODO)
- Model `gemini-3.8-flash`; test call works (`npm run test:gemini`).
- [ ] TODO: free-tier RPM / TPM / RPD from AI Studio into `docs/data-notes.md`.

---

## Phase 1 — Data pipeline ✅ done 2026-10-04

Turn raw GTFS into `data/generated/network.json`.
- Shared types in `lib/types.ts` (Route, Stop, Leg, Itinerary), validated with zod.
- `scripts/build-data.ts`: one representative trip per route + direction, ordered stops,
  cumulative distance, polyline (shape or stop-to-stop), walking transfers within ~300 m.
  Use the mode mapping and name-cleanup rules from `docs/data-notes.md`.
- `data/corrections.json` with its zod schema, merged in at build time.
- Log route/stop counts; keep the output small (round coordinates to ~5 decimals).

**Exit check:** `npm run build:data` produces `network.json`; a test loads it and checks counts and that every route has ≥2 stops.

## Phase 2 — Router ⏭ next

Pure TypeScript in `lib/router/`, test-first.
- `haversine`, nearby-stops lookup, walking estimates.
- `planTrip()`: round-based search, max 2 transfers, forward-only, cost function, top 3 *diverse* results.
- `checkRoutes()`: fuzzy signboard match, yes/no with board/alight stops and reason.

**Exit check:** tests for "never ridden backwards", Pedro Gil Taft → España returns ≥1 itinerary, and a check-routes case with one yes and one no.

## Phase 3 — Geocoding

- `data/landmarks.json` (start with ~30: stations, universities, malls, intersections from `data-notes.md`).
- Fuzzy matcher over landmarks + stop names.
- Nominatim client: 1 req/s throttle, User-Agent, LRU cache, Metro Manila bounding box.
- Ambiguity result type so the UI can ask "Alin dito?".

**Exit check:** tests for exact, fuzzy, ambiguous, and not-found inputs (Nominatim mocked in tests).

## Phase 4 — AI layer and API

- `parseIntent()` with JSON schema mode + zod; `writeAnswer()` from router JSON only.
- Set a low/zero thinking budget on both calls (see `docs/data-notes.md` → Gemini free tier).
- `app/api/chat/route.ts` wiring the pipeline.
- No-AI fallback path (From/To → router → plain text template) that works with no API key.
- Test: answer text contains no route name missing from the router result.

**Exit check:** all acceptance tests in `CLAUDE.md` that don't need a browser pass.

## Phase 5 — UI

Follow `DESIGN.md` exactly.
1. shadcn init + theme tokens + fonts + `Providers`.
2. Static pieces: Logo, Signboard, ModeBadge, Disclaimer, header, footer, input bar.
3. Welcome screen, then trip answer, then check-routes verdicts (use saved router JSON as fixtures first).
4. Map card + full-screen dialog (Leaflet, client-only).
5. Hook up `/api/chat`, location button, fallback screen.
6. Motion polish (allow-list only).

**Exit check:** `DESIGN.md` §12 "Definition of done", at 360px.

## Phase 6 — Deploy

- Vercel Hobby, env vars set, check function size with `network.json` included.
- README: screenshots, architecture diagram, limitations, data credits.

---

## Can anything run in parallel?

Yes, once Phase 1 has fixed the types in `lib/types.ts`: Phase 3 (geocoding) and the static
parts of Phase 5 (step 2 and 3, using fixture JSON) don't depend on the router being finished.
