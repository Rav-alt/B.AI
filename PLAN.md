# B.AI — Build Plan

> **For every agent:** this is the order of work. Start with **Current status** below to see where
> the project is. Finish a phase's exit checks before starting the next one. Detailed specs live in
> `CLAUDE.md` (architecture) and `DESIGN.md` (UI). After each task, follow `LEARNING_LOG_PROTOCOL.md`
> and update the status block.

---

## ▶ Current status — read this first

> **Every agent:** update this block at the end of any task that finishes a step or changes what
> comes next. Keep it short; details go in `docs/learning-log/`.

**Last updated:** 2026-10-05 15:35 (Asia/Manila)
**Current phase:** Phase 5 done. **Next: Phase 6 — Deploy.** First, look at the UI on the PC (`npm run dev`).
**Repo:** https://github.com/Rav-alt/B.AI (branch `main`) · local copy: `C:\Projects\B.AI`

### Done
- ✅ **Phase 0** — scaffold builds, data checked, Gemini works. Findings in `docs/data-notes.md`.
- ✅ **Phase 1** — `npm run build:data` writes `data/generated/network.json` (1,719 patterns, 4,835 stops,
  7,152 walking transfers, ~1.7 MB). Corrections applied: PNR removed, Roosevelt → Fernando Poe Jr.
- ✅ **Phase 2** — `planTrip()` and `checkRoutes()` in `lib/router/` (pure, no AI). Pedro Gil Taft → España
  works, Fairview bus = yes / Divisoria jeep = no, never rides backwards. 62 tests pass.
  Assumptions and real answers: `docs/data-notes.md` → "Phase 2 results". Try it: `npm run try:router`.
- ✅ **Phase 3** — `geocodeText()` / `placeFromCoords()` in `lib/geo/`: 36 sourced landmarks + station/stop names first,
  then Nominatim (1 req/s, User-Agent, cache; mocked in tests). Ambiguous names return choices. Landmarks also feed
  `build-data` (known directions 1,361 → 1,395). 85 tests pass. Details: `docs/data-notes.md` → "Phase 3 results".
- ✅ **Phase 4** — `POST /api/chat` (`app/api/chat/route.ts` → `lib/chat/pipeline.ts`): Gemini parses + words the answer,
  router decides, AI text checked against router names, templates + simple parser when AI is off/429. 116 tests pass.
  Try it: `npm run try:chat -- "Pedro Gil Taft to España"`. Details: `docs/data-notes.md` → "Phase 4 results".
- ✅ **Phase 5** — chat UI per `DESIGN.md` (now the shadcn/Motion version): welcome, trip answer (lead, steps with
  badges + signboard placards, total, Leaflet map card + full-screen dialog, disclaimer, other options), check-route
  cards, place picker, location button, From/To fallback, `/limitations`. Gemini now writes only the lead line.
  128 tests pass; checked with Playwright at 360px. Code map: `DESIGN.md` §14.
- ✅ **Place search fix** (after owner testing) — Nominatim now retries with shorter names (max 4 calls per place),
  logs `place not found` / Nominatim errors in the server terminal, and 2 landmarks were added (Ayala Malls Manila Bay,
  STI College Pasay-EDSA → 38). 134 tests pass. Log: `docs/learning-log/2026-10-05_1338_place-search-retries.md`.
- ✅ **Unknown-place follow-up** — "not found" now asks for the address and offers **I-pin sa mapa**; the reply keeps the
  other place and goes through From/To (no AI call). No stop within 1 km → names the nearest stop (≤ 5 km) with a
  one-tap route to it. 138 tests pass. Log: `docs/learning-log/2026-10-05_1434_ask-address-and-pin.md`.
- ✅ **Corrections: LRT-1 to Dr. Santos + EDSA Carousel** — LRT-1 now has 25 stations (Cavite Extension phase 1), the
  Carousel runs PITX ⇄ Monumento (23/24 stops), 2 landmarks added (Dr. Santos LRT/SM Sucat, DFA Aseana). Network:
  1,721 patterns, 4,887 stops. 138 tests pass. Log: `docs/learning-log/2026-10-05_1535_lrt1-extension-and-carousel.md`.

### Open items
- [ ] **Owner:** `NOMINATIM_CONTACT` is now in `.env.local`; restart `npm run dev`, ask about a place not in the
      landmark list, and check the terminal for `place not found` / `Nominatim failed` lines. Add frequent misses to
      `data/landmarks.json` (with a `source`). Also set `NOMINATIM_CONTACT` in Vercel for Phase 6.
- [ ] **Owner:** run `npm run dev` and check the UI with real map tiles and real Gemini leads (both blocked in the
      cloud workspace). Also try "use my location" on a phone (needs HTTPS or localhost).
- [x] Real Gemini run on the owner's PC (2026-10-05): works via the backup model. Found: `gemini-3.8-flash` free tier =
      **20 requests/day** (~10 questions), often 503, refuses MINIMAL thinking. Client now steps thinking down, switches
      to `gemini-3.5-flash-lite` on 429/503/timeout and waits for the quota reset. See `docs/data-notes.md`.
- [x] Model choice: main `gemini-3.5-flash-lite` (fast, ~2–3 s per answer), backup `gemini-3.8-flash`. Now the defaults.
- [ ] **Owner:** copy flash-lite's free-tier RPM / RPD from https://aistudio.google.com/rate-limit into `docs/data-notes.md`.
- [ ] Workflow: the cloud agent **can't push** to the repo (the Claude GitHub App isn't installed for it), so for
      now work is copied into `C:\Projects\B.AI` and the owner commits and pushes. To let agents push to a
      branch instead, install the app: https://github.com/apps/claude/installations/select_target
- [ ] Remaining corrections (LRT-2 East ext., stale EDSA buses, PITX city bus routes, PITX modern jeeps, UV Express):
      list in `docs/data-notes.md`. Stale EDSA buses can't be removed blindly (acceptance test 2 uses one). Not blocking.
- [ ] Router treats the Carousel like any bus (same speed); consider a faster speed for busway routes.

### Key facts every agent needs
- **Stack as installed:** Next.js **16.3** (read `AGENTS.md`: APIs differ from older Next), React 19, Tailwind v4,
  TypeScript strict + `noUncheckedIndexedAccess`, vitest 5, tsx, zod 4, `@google/genai` 2.x. Node ≥ 22.
  Run `npm run build` once before `npx tsc --noEmit` (Next generates the `LayoutProps` type).
- **npm scripts:** `dev`, `build`, `test`, `lint`, `build:data`, `inspect:gtfs`, `test:gemini`, `try:router`, `try:chat`.
- **Data in:** the GTFS feed goes in `data/raw/` (git-ignored): `git clone --depth 1 https://github.com/sakayph/gtfs data/raw`.
  Fixes go in `data/corrections.json` (validated by `lib/data/corrections.ts`; every entry needs `source` + `updated`).
- **Data out:** `data/generated/network.json` is committed. Types in `lib/types.ts` (`Network`, `Pattern`, `Stop`,
  `Transfer`, plus `Leg`/`Itinerary` for the router). Load it server-side with `loadNetwork()` from `lib/router/network.ts`.
- **Pattern = one route ridden one way.** `stops` are indices into `network.stops`; ride forward only.
  `dist` = cumulative metres. `shape`/`shapeIdx` only on 8 patterns, otherwise draw stop to stop.
  `towards` (which end it heads to) is known for 80% of road patterns; **handle it missing**.
- **Acceptance data:** Pedro Gil Taft → España has ≥10 direct forward patterns (test in `tests/network.test.ts`).
- **Gemini:** main `gemini-3.5-flash-lite`, backup `gemini-3.8-flash` (only 20 requests/day). Thinking is stepped down
  automatically; quota/overload switches to the backup. Details in `docs/data-notes.md` → "Phase 4 results".
- **Secrets:** the API key lives only in `.env.local` (git-ignored). `.env.example` keeps **empty** values.
  Never commit a key or click "allow secret".

### Router API (for Phases 3–5)
- `planTrip(net, origin, destination, prefs?)` → `PlanResult` `{ status, itineraries (≤3), walkRadiusM }`.
- `checkRoutes(net, origin, destination, candidates, prefs?)` → `CheckResult` `{ verdicts, alternative?, walkRadiusM }`.
- `origin`/`destination` are `PlaceRef` `{ name, lat, lon }`, the geocoder's job in Phase 3. Schemas in `lib/types.ts`.
- `totalMinutes` is a rough sum of legs (no waiting/traffic): word it as "mga …".

### Geocoding API (for Phases 4–5)
- `geocodeText(text, { net, landmarks, nominatim })` → `GeocodeResult`: `found` (a `GeoPlace`) · `ambiguous` (2–5 choices,
  each with an `area` label) · `not_found` (`no_match` | `search_unavailable`) · `outside_area`.
- Context in the route handler: `loadNetwork()`, `loadLandmarks()`, `getNominatim()` (null if `NOMINATIM_CONTACT` unset).
- `placeFromCoords(lat, lon)` for "use my location" (never store it).
- A `GeoPlace` is a `PlaceRef`, so it goes straight into `planTrip` / `checkRoutes`.

### Chat API (for Phase 5)
- `POST /api/chat` body: `{ message }` or `{ from, to }`, plus optional `history` (last ≤ 6 turns), `location`
  (only after "use my location"), `picked: { origin?, destination? }` (a choice from `ask_place`). Schema: `ChatRequestSchema`.
- Response `ChatResponse`: `kind` (route · check · no_route · ask_place · place_not_found · need_more_info ·
  need_location · off_topic · fallback_form), `text` (**bold** + numbered steps), `lang`, `origin`/`destination`,
  `plan` or `check` (legs with polylines for the map), `choices`, `disclaimer`, `writer` (ai | template), `fallbackReason`.
- `fallback_form` → show the From/To boxes (`from`/`fromCurrentLocation`, `to`, `prefs`). `ask_place` → show `choices` as buttons, resend with `picked`.
- For route/check answers `text` is the one-line lead; the UI draws steps from `plan`/`check`.
- HTTP 429 `{ error: "rate_limited" }` when a visitor sends > 10/min; 400 on a bad body.

### Next steps (Phase 6 — Deploy)
1. Vercel Hobby: import the GitHub repo; set `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `NOMINATIM_CONTACT`.
2. Check the `/api/chat` function bundle includes `data/generated/network.json` and `data/landmarks.json`
   (`outputFileTracingIncludes` in `next.config.ts`) and stays under the size limit.
3. Smoke-test the deployed site: the acceptance questions, the fallback (remove the key in a preview), the map.
4. README: screenshots, architecture diagram, limitations, data credits (DOTC/DOTr disclaimer, OSM), free-tier notes.

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

## Phase 2 — Router ✅ done 2026-10-05

Pure TypeScript in `lib/router/`, test-first.
- `haversine`, nearby-stops lookup, walking estimates.
- `planTrip()`: round-based search, max 2 transfers, forward-only, cost function, top 3 *diverse* results.
- `checkRoutes()`: fuzzy signboard match, yes/no with board/alight stops and reason.

**Exit check:** tests for "never ridden backwards", Pedro Gil Taft → España returns ≥1 itinerary, and a check-routes case with one yes and one no.

## Phase 3 — Geocoding ✅ done 2026-10-05

- `data/landmarks.json` (start with ~30: stations, universities, malls, intersections from `data-notes.md`).
- Fuzzy matcher over landmarks + stop names.
- Nominatim client: 1 req/s throttle, User-Agent, LRU cache, Metro Manila bounding box.
- Ambiguity result type so the UI can ask "Alin dito?".

**Exit check:** tests for exact, fuzzy, ambiguous, and not-found inputs (Nominatim mocked in tests).

## Phase 4 — AI layer and API ✅ done 2026-10-05

- `parseIntent()` with JSON schema mode + zod; `writeAnswer()` from router JSON only.
- Set a low/zero thinking budget on both calls (see `docs/data-notes.md` → Gemini free tier).
- `app/api/chat/route.ts` wiring the pipeline.
- No-AI fallback path (From/To → router → plain text template) that works with no API key.
- Test: answer text contains no route name missing from the router result.

**Exit check:** all acceptance tests in `CLAUDE.md` that don't need a browser pass.

## Phase 5 — UI ✅ done 2026-10-05

Follow `DESIGN.md` exactly.
1. shadcn init + theme tokens + fonts + `Providers`.
2. Static pieces: Logo, Signboard, ModeBadge, Disclaimer, header, footer, input bar.
3. Welcome screen, then trip answer, then check-routes verdicts (use saved router JSON as fixtures first).
4. Map card + full-screen dialog (Leaflet, client-only).
5. Hook up `/api/chat`, location button, fallback screen.
6. Motion polish (allow-list only).

**Exit check:** `DESIGN.md` §12 "Definition of done", at 360px.

## Phase 6 — Deploy ⏭ next

- Vercel Hobby, env vars set, check function size with `network.json` included.
- README: screenshots, architecture diagram, limitations, data credits.

---

## Can anything run in parallel?

Yes, once Phase 1 has fixed the types in `lib/types.ts`: Phase 3 (geocoding) and the static
parts of Phase 5 (step 2 and 3, using fixture JSON) don't depend on the router being finished.
