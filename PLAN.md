# B.AI — Build Plan

> **For every agent:** this is the order of work. Start with **Current status** below to see where
> the project is. Finish a phase's exit checks before starting the next one. Detailed specs live in
> `CLAUDE.md` (architecture) and `DESIGN.md` (UI). After each task, follow `LEARNING_LOG_PROTOCOL.md`
> and update the status block.

---

## ▶ Current status — read this first

> **Every agent:** update this block at the end of any task that finishes a step or changes what
> comes next. Keep it short; details go in `docs/learning-log/`.

**Last updated:** 2026-10-04 23:40 (Asia/Manila)
**Current phase:** Phase 0 done (one small TODO below). **Next: Phase 1 — Data pipeline.**
**Repo:** https://github.com/Rav-alt/B.AI (branch `main`) · local copy: `C:\Projects\B.AI`

### Done
- ✅ **Phase 0** — scaffold builds, data checked, Gemini works. Commit on `main`: "Phase 0: scaffold and data check".
  Findings are in `docs/data-notes.md`; read it before Phase 1.

### Open items
- [ ] Copy the free-tier RPM / TPM / RPD for `gemini-3.8-flash` from https://aistudio.google.com/rate-limit
      into the table in `docs/data-notes.md`. Only needed by Phase 4; does not block Phase 1.
- [ ] Decide the workflow for Phase 1+: an agent pushes to a branch on GitHub and the owner reviews and `git pull`s,
      **or** the agent writes straight into `C:\Projects\B.AI` and the owner commits. (Asked, not answered yet.)

### Key facts every agent needs (from Phase 0)
- **Stack as installed:** Next.js **16.3** (read `AGENTS.md`: APIs differ from older Next), React 19, Tailwind v4,
  TypeScript strict + `noUncheckedIndexedAccess`, vitest 5, tsx, zod 4, `@google/genai` 2.x. Node ≥ 22.
- **npm scripts:** `dev`, `build`, `test`, `lint`, `build:data` (placeholder until Phase 1), `inspect:gtfs`, `test:gemini`.
- **Data:** the GTFS feed is in `data/raw/` (git-ignored). Mode comes from the **route_id prefix**:
  `LTFRB_PUJ*` = jeep (1,522), `LTFRB_PUB*` = bus (189), route_type 1/2 = train (4 lines), `FORT_*` = bus.
  No UV routes, no `direction_id` (directions are separate routes with the same name), almost no shapes for road routes.
- **Acceptance tests already pass on the raw data:** Pedro Gil Taft → España has 13 direct routes;
  "bus to SM Fairview" = yes, "jeep to Divisoria" = no.
- **Gemini:** `gemini-3.8-flash` works on the free tier. Thinking is on by default (490 of 518 tokens in the test call),
  so Phase 4 must set a low/zero thinking budget.
- **Secrets:** the API key lives only in `.env.local` (git-ignored). `.env.example` must keep **empty** values.
  GitHub push protection already blocked one leak; never commit a key or click "allow secret".
- **Fonts:** Google Fonts can't be reached from the cloud agent's sandbox; fonts are a Phase 5 job anyway.

### Next steps (Phase 1, in order)
1. `lib/types.ts` with zod schemas (Route, Stop, Leg, Itinerary, Network).
2. `scripts/build-data.ts`: mode mapping, signboard name cleanup, one pattern per route direction,
   cumulative distance, stop-to-stop polylines, walking transfers ≤ 300 m → `data/generated/network.json`.
3. `data/corrections.json` + schema: start with removing PNR and renaming LRT-1 "Roosevelt" → "Fernando Poe Jr.".
4. Tests: counts, every route ≥ 2 stops, mode mapping, name cleanup.

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

## Phase 1 — Data pipeline ⏭ next

Turn raw GTFS into `data/generated/network.json`.
- Shared types in `lib/types.ts` (Route, Stop, Leg, Itinerary), validated with zod.
- `scripts/build-data.ts`: one representative trip per route + direction, ordered stops,
  cumulative distance, polyline (shape or stop-to-stop), walking transfers within ~300 m.
  Use the mode mapping and name-cleanup rules from `docs/data-notes.md`.
- `data/corrections.json` with its zod schema, merged in at build time.
- Log route/stop counts; keep the output small (round coordinates to ~5 decimals).

**Exit check:** `npm run build:data` produces `network.json`; a test loads it and checks counts and that every route has ≥2 stops.

## Phase 2 — Router

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
