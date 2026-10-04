# B.AI — Metro Manila Commute Buddy

## Start here (every agent, every session)

1. Read **`PLAN.md` → "Current status"** first: what phase we're in, what's done, what's open, and what's next.
2. Read **`docs/data-notes.md`** before touching data, the router, or the AI layer. It has the facts from the
   Phase 0 data check (mode mapping, name cleanup rules, gaps, Gemini model).
3. Read **`DESIGN.md`** before any UI work.
4. When you finish a task: follow **`LEARNING_LOG_PROTOCOL.md`**, then **update the "Current status" block in `PLAN.md`**.

Repo: https://github.com/Rav-alt/B.AI (local: `C:\Projects\B.AI`). Never commit secrets: keys go in `.env.local` only.

## What this project is

B.AI is a mobile-first web chatbot that tells Filipino commuters **what to ride** to get from where they are to where they want to go in Metro Manila.

Example: *"Nasa Pedro Gil Taft ako, papuntang España. Anong bus o jeep ang sasakyan ko?"*

Google Maps draws a route, but it doesn't clearly tell a commuter which signboard to look for. B.AI answers the way a fellow commuter would: which jeep/bus/train to board (by signboard name), where to board, where to get off, and where to transfer. Every answer comes with a map.

This is a **personal portfolio project**. It must run entirely on **free tiers**.

## Persona: B.AI

- A friendly, practical commuter buddy ("bai" = buddy/friend).
- Replies in the user's language: English, Tagalog, or Taglish. Default to casual Taglish.
- Short, step-by-step answers. Signboard names in **bold**.
- Never invents routes. Only describes what the router returned.
- Always ends route answers with a reminder that data may be outdated and the commuter should confirm with the driver/barker/konduktor.
- Only does route planning. Politely declines unrelated questions (fares, schedules, news, general chat) and redirects to route help.

## Scope

**In scope**
- Metro Manila only.
- Modes: LRT-1, LRT-2, MRT-3, city buses (incl. EDSA Carousel), jeepneys / modern jeeps, UV Express (where data exists).
- Free-text questions in English/Tagalog/Taglish using landmarks, stations, streets, or "use my location".
- Two question types:
  1. **Plan a trip**: "Paano pumunta from A to B?"
  2. **Check named routes**: "Should I take the bus going to SM Fairview or the jeep going to Divisoria?"
- Preferences: fewest transfers, less walking, trains only / avoid trains.
- A map shown with every route answer.

**Out of scope (non-goals)**
- User accounts, saved places, history, database.
- Fares, schedules, real-time traffic, train status.
- Booking, payment, ride-hailing.
- Areas outside Metro Manila.

## Known limitations (show these honestly in the UI/README)

- Route data is old (DOTC GTFS from the Philippine Transit App Challenge) and many routes changed under PUV modernization/route rationalization. Some routes are stale or missing.
- No real-time info (traffic, breakdowns, lines, availability).
- Jeepneys don't have fixed stops, so boarding/alighting points are approximate.
- Place search can misread local names ("Lawton", "Rotonda").

**Standard disclaimer** (shown under every route answer):
> Paalala: Maaaring luma na ang ilang ruta sa data namin. Laging magtanong sa driver o barker bago sumakay.

**Privacy note** (shown near the input): "Don't type personal information."

## Tech stack (all free)

| Part | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript (strict). **Installed: Next 16.3** — see `AGENTS.md`, its APIs differ from older Next |
| Styling | Tailwind CSS v4, mobile-first. Theme tokens in `app/globals.css` (see `DESIGN.md`) |
| UI components | shadcn/ui (`new-york` style, Radix primitives, CSS variables). Components are copied into `components/ui/` and restyled to `DESIGN.md`. Icons: `lucide-react` |
| Animation | Motion for React (`motion` package, `motion/react`), loaded with `LazyMotion` + `domAnimation` and the slim `m` components. `tw-animate-css` for shadcn's built-in enter/exit animations |
| Fonts | Archivo (with width axis) + IBM Plex Mono via `next/font/google` |
| Map | Leaflet + react-leaflet with OpenStreetMap tiles (load client-only via `dynamic(..., { ssr: false })`) |
| AI | Google Gemini Flash via Google AI Studio free tier, using the `@google/genai` SDK. Model ID comes from env `GEMINI_MODEL` (currently `gemini-3.8-flash`, see `docs/data-notes.md`). |
| Geocoding | Local landmark/stop list first, then Nominatim (OpenStreetMap) as fallback |
| Route data | `sakayph/gtfs` (GTFS feed for Metro Manila) converted to compact JSON at build time, plus a hand-maintained corrections file |
| Validation | zod |
| Tests | vitest |
| Hosting | Vercel Hobby |

Do **not** add paid services, a database, or OpenTripPlanner (too much RAM for free hosting). Don't add a second UI kit or animation library (no MUI, Chakra, GSAP, react-spring, etc.).

## Architecture

Deterministic pipeline. The AI understands and explains; our code does the routing.

```
user message
  → [1] Gemini: parse intent → JSON (zod-validated)
  → [2] geocode origin/destination
  → [3] router: planTrip() or checkRoutes()   ← pure TypeScript, no AI
  → [4] Gemini: write the answer from the router result ONLY
  → response: { text, itineraries (for map), disclaimer }
```

Only 2 Gemini calls per question, to stay under free-tier limits.

### [1] Intent parsing

Gemini returns structured JSON (use the SDK's JSON / response schema mode), validated with zod:

```ts
type Intent =
  | { type: "plan_trip"; origin: PlaceQuery; destination: PlaceQuery; prefs: Prefs }
  | { type: "check_routes"; origin: PlaceQuery; destination: PlaceQuery;
      candidates: { mode?: "bus" | "jeep" | "uv" | "train"; signboard: string }[]; prefs: Prefs }
  | { type: "need_more_info"; missing: ("origin" | "destination")[] }
  | { type: "off_topic" };

type PlaceQuery = { text: string } | { useCurrentLocation: true };
type Prefs = { fewestTransfers?: boolean; lessWalking?: boolean; trainsOnly?: boolean; avoidTrains?: boolean };
```

If origin or destination is missing, B.AI asks for it. If off-topic, B.AI politely redirects.

### [2] Geocoding

1. Fuzzy-match against `data/landmarks.json` (curated: stations, universities, malls, major intersections like "Pedro Gil Taft") and GTFS stop names.
2. Fallback: Nominatim search restricted to Metro Manila (`countrycodes=ph`, `viewbox=120.90,14.80,121.15,14.35`, `bounded=1`).
3. Nominatim usage policy, which must be followed:
   - max 1 request/second (server-side throttle)
   - identifying `User-Agent` header (e.g. `B.AI-commute-helper/1.0 (contact: <owner email>)`)
   - no search-as-you-type / autocomplete
   - cache results (in-memory LRU is fine)
4. If the match is ambiguous, B.AI asks the user to pick.

### [3] Router (`lib/router/`)

**Network model**, built from GTFS by `scripts/build-data.ts`:
- For each route + direction, keep one representative ordered stop sequence (from `trips.txt` + `stop_times.txt`) and its shape (`shapes.txt`; if missing, draw stop-to-stop lines).
- Keep: route id, route name (= signboard-style "A – B"), mode (from GTFS `route_type` and/or agency), direction, ordered stops (id, name, lat, lon), cumulative distance along the route.
- Precompute walking transfers: stop pairs within ~300 m.
- Output a compact `data/generated/network.json`. Times are not needed; estimate travel time by distance ÷ mode speed.

**planTrip(origin, destination, prefs)**
- Boarding candidates: stops within ~600 m walking of the origin; alighting candidates: within ~600 m of the destination (expand to ~1 km if nothing is found).
- Round-based search (RAPTOR-style, no timetables), max **2 transfers**. A route can only be ridden **forward** in its stop order.
- Cost = estimated in-vehicle minutes + walking minutes × 2 + transfer penalty (~8 min each). Apply prefs (e.g. `lessWalking` raises the walk weight, `trainsOnly` filters modes).
- Return the top 3 *diverse* itineraries (not three that differ by one stop).
- Each leg: `{ mode, routeName, boardStop, alightStop, distanceKm, estMinutes, polyline }`; walk legs: `{ mode: "walk", from, to, meters, polyline }`.

**checkRoutes(origin, destination, candidates)**
- For each candidate, fuzzy-match `signboard` against route names (e.g. "SM Fairview" → routes whose name contains "Fairview"), filtered by mode if given.
- For each matched route/direction: does it pass within walking distance of the origin **and later** within walking distance of the destination? Return yes/no + board/alight stops + reason.
- If none work, also run `planTrip()` and suggest the best alternative.

Router code is pure functions with unit tests. No network calls, no AI.

### [4] Answer writing

Gemini receives the router JSON and writes the reply. System prompt rules:
- Use only the routes, stops, and names in the provided JSON. Never add a route, stop, or landmark that isn't there.
- Format: numbered steps, signboard names in bold, "baba sa …" for where to get off, an approximate total time.
- For `check_routes`: answer each candidate directly first ("Fairview bus: oo, dumadaan sa España…" / "Divisoria jeep: hindi…").
- If the router found nothing: say so honestly and suggest asking a barker or nearby commuters.
- Append the standard disclaimer.

**Fallback:** if Gemini fails or hits the rate limit (HTTP 429), the app still works. Show "From / To" input boxes, skip parsing, and render the router result with a plain text template. Routing never depends on AI.

## UI

**Before any UI work, read `DESIGN.md`** (flat signboard design, colors, shadcn/ui and Motion rules). The summary below is the feature list; `DESIGN.md` says how it must look.

- One-page, mobile-first chat (works well at 360 px width).
- Each route answer = a chat bubble plus a map card below it (tap to expand full screen).
- Map: legs colored by mode (train, bus, jeep, UV, walk as a dashed line), origin/destination markers, board/alight markers. Show "© OpenStreetMap contributors" (Leaflet attribution).
- "Use my location" button (browser Geolocation API; ask permission, never store it).
- Suggested starter chips, e.g. "Pedro Gil Taft → España", "Cubao → Makati".
- Footer: "Data provided by DOTC (now DOTr). Not affiliated with or endorsed by DOTr." plus a link to the limitations section.
- Accessible: real buttons, labels, focus states, sufficient contrast.

## Data and licensing rules (must follow)

**GTFS data** (`sakayph/gtfs`), under the DOTC Developer License Agreement in that repo's `LICENSE.md`:
- Use only to help public transport riders.
- Do not imply affiliation with or endorsement by DOTC/DOTr. No DOTr logo, and no "DOTr" in the app name.
- Keeping a copy in the app is allowed; make reasonable efforts to keep it updated (that's what `data/corrections.json` is for).
- Do not sell or redistribute the raw data separately from the app.
- Credit line in the footer (see UI).

**OpenStreetMap / Nominatim:** keep the attribution visible, keep traffic light, follow the Nominatim policy above.

**Gemini free tier:** keep the "don't type personal info" note.

## Corrections file

`data/corrections.json` is merged over the GTFS-derived network at build time:
- `addRoutes`: new routes (e.g. EDSA Carousel, LRT-1 Cavite extension stations) with ordered stops.
- `removeRoutes`: route ids known to be discontinued.
- `renameRoutes`: updated signboard names.
- `landmarkAliases`: local names → coordinates (e.g. "Lawton", "Rotonda", "Pedro Gil Taft").

Every entry has a `source` and `updated` date field.

## Suggested folder structure

```
/app
  layout.tsx               # fonts, <Providers>, lang="fil"
  providers.tsx            # LazyMotion + MotionConfig (client)
  globals.css              # Tailwind v4 + tw-animate-css + theme tokens (DESIGN.md §3)
  page.tsx                 # chat UI
  api/chat/route.ts        # pipeline endpoint
/components
  ui/                      # shadcn/ui components (owned and restyled by us)
  Chat, MessageBubble, RouteAnswer, VerdictCard, RouteMap,
  Signboard, ModeBadge, StarterChips, Disclaimer, Logo
/lib
  ai/                      # gemini client, parseIntent, writeAnswer, prompts
  data/                    # build-time: csv parser, mode mapping, name cleanup, directions, corrections schema, buildNetwork()
  geo/                     # geocode, nominatim client (throttled + cached), haversine
  router/                  # network loader (network.ts), planTrip, checkRoutes, scoring
  motion.ts                # shared animation presets (DESIGN.md §9)
  utils.ts                 # shadcn cn() helper
  types.ts
/data
  raw/                     # GTFS feed (git-ignored)
  landmarks.json
  corrections.json
  generated/network.json   # build output
/docs
  data-notes.md            # Phase 0 data findings
  learning-log/            # one entry per task + INDEX.md
/scripts
  build-data.ts            # GTFS → network.json
  inspect-gtfs.ts          # Phase 0 data spike
  test-gemini.ts           # one test call to Gemini
/tests                     # vitest
components.json            # shadcn config
DESIGN.md                  # design rules
PLAN.md                    # build order + current status
```

## Environment variables

```
GEMINI_API_KEY=        # Google AI Studio key (server-side only, never exposed to the client)
GEMINI_MODEL=          # current free-tier Flash model ID
NOMINATIM_CONTACT=     # email for the Nominatim User-Agent
```

Real values go in `.env.local` only (git-ignored). `.env.example` stays empty.

## Coding conventions

- TypeScript strict; no `any`.
- Validate all AI output and API input with zod.
- Server-only code (Gemini key, Nominatim calls) stays in route handlers / `lib` server modules.
- Small pure functions in `lib/router` with unit tests.
- Keep the client bundle small; load `network.json` server-side only. Use Motion's slim `m` components (never the full `motion` component), and add only the shadcn components the screens need.
- Server components by default; add `"use client"` only where there's interactivity, the map, or animation.

## Build phases

`PLAN.md` is the source of truth for the order of work and current progress. Summary:

0. **Foundation + data check** ✅
1. **Data** ✅: `scripts/build-data.ts` reads the `sakayph/gtfs` files and outputs `network.json`, merged with `corrections.json`. Log route/stop counts.
2. **Router** ✅: `planTrip` and `checkRoutes` with tests.
3. **Geocoding** ✅: landmarks plus throttled, cached Nominatim.
4. **AI layer**: intent parsing and answer writing, with the no-AI fallback.
5. **UI**: shadcn/ui init + theme from `DESIGN.md`, then chat, map card, location button, disclaimer, footer, then Motion polish.
6. **Deploy**: Vercel; a README with screenshots, architecture, limitations, and data credits.

## Acceptance tests

- "Pedro Gil Taft to España" returns at least one itinerary, with a map, signboard names, and the disclaimer.
- "Galing Pedro Gil Taft papuntang España, bus papuntang SM Fairview o jeep papuntang Divisoria?" answers each candidate yes/no from data, and suggests an alternative if neither works.
- A route is never ridden backwards.
- Missing destination makes B.AI ask for it.
- "What's the weather?" gets a polite decline and a redirect to route help.
- With Gemini disabled or rate-limited, the From/To fallback still returns routes.
- The answer text contains no route name absent from the router result (test: compare names).

## Next.js version notes (auto-generated)

@AGENTS.md
