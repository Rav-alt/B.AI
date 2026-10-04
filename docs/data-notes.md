# Data notes (Phase 0 spike)

> Written 2026-10-04 from `scripts/inspect-gtfs.ts` (run it again with `npm run inspect:gtfs`).
> Feed: `sakayph/gtfs`, branch `master`, last commit `b7394cc` — **24 Mar 2015**
> ("Add feed info"). `calendar.txt` service dates run 2013-06-17 → 2020-06-30.
> The `master` branch is Sakay.ph's cleaned-up version; the untouched DOTC original is on the `dotc` branch.

## Verdict

**Yes, the data is usable** for B.AI's core job (which signboard goes from A to B), with three known
weaknesses we must design around:

1. **It is 11 years old.** Many bus routes along EDSA no longer exist (replaced by the EDSA Carousel
   in 2020), and three rail lines changed. These go into `data/corrections.json`.
2. **No shapes for road routes.** Only 3 of 1,713 road routes have a `shape_id`, so the map draws
   stop-to-stop lines for jeeps/buses. Stops are dense (median gap ≈ 245 m), so this looks fine.
3. **No `direction_id`, no headsigns.** Directions are stored as **separate routes** with the same name
   instead (see "Directions" below). The router doesn't need `direction_id`; it just rides each
   route forward in stop order.

## Counts

| File | Rows |
|---|---|
| agency | 6 |
| routes | 1,717 |
| trips | 1,864 |
| stops | 4,858 |
| stop_times | 79,414 |
| shapes | 520 points, 10 distinct `shape_id`s |
| frequencies | 1,864 (headways only; no real timetables) |

- Every route has ≥1 trip. 1,619 routes have exactly 1 trip; the 3 train lines have 14 trips each (7 per direction).
- Stops per trip: min 2, median 32, p90 92, max 218.
- Trips with `shape_id`: 55 / 1,864 (52 of them are trains). Trips with `direction_id`: **0**. With headsign: **0**.
- Only 1 stop is unused by any trip.

### Agencies and modes

| agency_id | Name | Routes | route_type |
|---|---|---|---|
| LTFRB | LTFRB (road franchises) | 1,711 | 3 |
| LRTA | LRT-1, LRT-2 | 2 | 2 |
| MRTC | MRT-3 | 1 | 2 |
| PNR | PNR Metro Commuter | 1 | 2 |
| FORT | The Fort Bus (BGC) | 2 | 3 |
| MARINA | (ferries — 0 routes) | 0 | — |

Train lines in the feed:

| route_id | Line | Endpoints | Stations |
|---|---|---|---|
| `ROUTE_880747` | LRT 1 | Baclaran – Roosevelt | 20 |
| `ROUTE_880801` | LRT 2 | Recto – Santolan | 11 |
| `ROUTE_880854` | MRT-3 | Taft Ave – North Ave | 13 |
| `ROUTE_880872` | PNR MC | Tutuban – Biñan | 22 |

## Mode mapping rule

`route_type` alone **can't** tell jeep from bus: all 1,711 LTFRB routes are type 3. The `route_id`
prefix can:

```ts
function modeOf(route: { route_id: string; route_type: string; agency_id: string }): Mode {
  if (route.route_type === "1" || route.route_type === "2") return "train"; // LRTA, MRTC, PNR
  if (route.route_id.startsWith("LTFRB_PUJ")) return "jeep";  // 1,522 routes (PUJ = Public Utility Jeepney)
  if (route.route_id.startsWith("LTFRB_PUB")) return "bus";   //   189 routes (PUB = Public Utility Bus)
  if (route.agency_id === "FORT") return "bus";               //     2 routes (BGC Bus, loops)
  throw new Error(`unknown mode for ${route.route_id}`);      // fail the build, don't guess
}
```

- **UV Express: none in the feed.** Any UV routes would have to come from `corrections.json`.
- Train line names come from `route_short_name` ("LRT 1", "LRT 2", "MRT-3", "PNR MC");
  normalise to "LRT-1", "LRT-2", "MRT-3", "PNR".

## Signboard names

- Road routes: `route_short_name` is **always empty**; the signboard text is in `route_long_name`.
- Names look like real signboards: "Baclaran - Blumentritt via L. Guinto, Quiapo",
  "Pacita Complex - SM Fairview via EDSA", "Proj 6 Recto via Espana QAve".
- Style is inconsistent: 343 are ALL CAPS, separators vary (" - ", "-", none), 923 contain "via".
- `route_desc` holds the start/end street addresses ("Taft Ave, Manila - …"), not useful as a signboard.

**Rule for `build-data.ts`:**
1. Split off the `via …` part → `name` ("Baclaran – Blumentritt") and `via` ("L. Guinto, Quiapo").
2. Normalise separators to an en dash with spaces (" – "); collapse double spaces.
3. Convert ALL-CAPS names to Title Case, keeping known short words uppercase (SM, LRT, MRT, UP, NAIA, PITX, BGC).
4. Fix common typos/abbreviations via a small map (e.g. "Espana" → "España", "QAve" → "Quezon Ave",
   "Proj" → "Project", "RTDA." → "Rotonda"). Keep the original string as `rawName` for fuzzy matching.
5. **Direction label** = the name of the last stop's side: for a pair "A – B" ridden from A, show
   "papuntang B". Derive from which endpoint is nearer the trip's last stop.

## Directions

- 777 route names appear exactly twice (+16 three times, +5 four times, 89 once).
- For the twice-named pairs, **746 are clean reverses** (A's first stop ≈ B's last stop, < 1.5 km),
  2 run the same direction (true duplicates), 29 don't match cleanly (mostly long provincial buses).
- Trains store both directions as trips of one route (7 + 7 trips).
- 5 routes are loops (start ≈ end): BGC Bus and a few jeeps like "Landmark Puregold Loop".

**Consequence:** treat each `(route_id, trip pattern)` as one directed pattern. For trains, keep one
trip per direction. Collapse the 2 true duplicates. The 89 single-direction jeep routes are probably
one-way-loop jeeps or missing their return; the router simply can't use them backwards (correct).

## Geography

- Stop bounding box: lat 14.250 – 14.884, lon 120.900 – 121.229.
- **800 stops (16%) are outside** the Metro Manila box we use for Nominatim
  (14.35–14.80, 120.90–121.15): Bulacan (Balagtas, Bocaue), Cavite, Laguna (Biñan), Rizal (Antipolo).
  Keep them in `network.json` (a route that *starts* in Bocaue still serves Manila stops), but the
  geocoder only accepts places inside Metro Manila.
- Coordinates are stored with only ~4 decimals (≈ 11 m), so rounding to 5 in the output costs nothing.

## Acceptance-test places

| Place | Stops found | Notes |
|---|---|---|
| Pedro Gil / Taft | 11 "Pedro Gil" + 26 "Taft" stops; 10 within 400 m | incl. "Pedro Gil LRT" and "Taft Ave, Manila" |
| España | 12 stops along España Blvd | spelled both "Espana" and "España" — normalise ñ in fuzzy matching |
| Cubao | 4 | "Cubao LRT", "Cubao MRT", Main Ave bus terminal |
| Makati / Ayala | 218 "Makati", 19 "Ayala" | needs a landmark entry; "Makati" alone is a city, not a point |
| UST, Morayta, Quiapo, Rotonda | 0 by name | → `landmarks.json` / `landmarkAliases` |
| Lawton | 15, but **all in Taguig/Makati (Lawton Ave)** | the Manila "Lawton" (Liwasang Bonifacio) is missing → alias needed, and this is exactly the ambiguity CLAUDE.md warns about |

### Pedro Gil Taft → España: ✅ works with raw data

13 direct routes ride forward from a stop within 400 m of Pedro Gil/Taft to one within 400 m of
España/Lacson — no correction needed for acceptance test 1. Examples:

- **bus** "Baclaran-SM Fairview via Quezon Ave": board *Taft Ave / J. Llanes Escoda* → alight *España Blvd / Osmeña Dr*
- **jeep** "Cubao - Remedios via Quiapo, L. Guinto": board *Taft Ave* → alight *España Blvd / Osmeña Dr*
- **jeep** "Baclaran - Blumentritt via L. Guinto, Quiapo": board *Leon Guinto / Pedro Gil* → alight *Gen. Concepcion / Laong Laan*
- **jeep** "Proj 6 - Vito cruz via Quezon Avenue", "BACLARAN - DAPITAN via TAFT", …

### Acceptance test 2 (bus to SM Fairview vs jeep to Divisoria): ✅ gives the expected split

- **Bus to SM Fairview → yes.** "Baclaran-SM Fairview via Quezon Ave" passes Pedro Gil/Taft and later España.
- **Jeep to Divisoria → no.** Three Divisoria jeeps pass Pedro Gil (via L. Guinto) but none reach
  España afterwards, so the router should answer "hindi" and suggest one of the routes above.
- Caveat: that Fairview bus is a 2015 franchise; in real life it may be gone. Fine for the test,
  flag it in the corrections review.

### Cubao → Makati (Ayala): ⚠️ works, but mostly with stale routes

72 direct routes, nearly all old **EDSA city buses** (e.g. "Alabang Fairview", "Alabang Monumento via EDSA")
that were removed from EDSA when the Carousel started (2020). MRT-3 Cubao → Ayala also works and is
the realistic answer. This is the strongest case for the corrections file.

## Known gaps → first `corrections.json` list

Names and sources only; coordinates/stops get filled in during Phase 1. Every entry needs `source` + `updated`.

**addRoutes**
- [ ] **EDSA Carousel** (bus, Monumento – PITX, busway stations). Source: DOTr/LTFRB route announcements, 2020–.
- [ ] **LRT-1 Cavite Extension phase 1**: Redemptorist-Aseana, MIA Road, PITX, Ninoy Aquino Ave, Dr. Santos (opened Nov 2024). Source: LRMC.
- [x] **LRT-1 north**: "Roosevelt" was renamed **Fernando Poe Jr.** (Aug 2023); Balintawak already present. *Done in Phase 1 as a `renameStops` entry.*
- [ ] **LRT-2 East Extension**: Marikina-Pasig, Antipolo (opened Jul 2021). Source: LRTA.
- [ ] **BGC Bus** current routes (feed has only "Fort Central", "Fort West" loops).
- [ ] **MRT-7** — check status in Phase 1 (partial operations were still being targeted as of early 2026).
- [ ] UV Express routes — optional, none in feed; only add well-known ones with a source.

**removeRoutes**
- [x] **PNR Metro Commuter** (`ROUTE_880872`): Metro Manila service suspended since 28 Mar 2024 for NSCR construction. *Done in Phase 1.*
- [ ] **EDSA provincial/city bus routes** replaced by the Carousel (filter: `PUB` routes whose name contains "via EDSA" or that run along EDSA between Monumento and Pasay). Needs a manual review list, not a blind regex.

**renameRoutes**
- [x] LRT-1 "Baclaran – Roosevelt" → "Baclaran – Fernando Poe Jr.". *Not a route rename after all: train names are built from their end stations, so renaming the station did it. The Cavite extension will make it "Dr. Santos – Fernando Poe Jr." the same way.*
- [ ] "The Fort Bus" → "BGC Bus".
- [ ] Rationalized jeep routes with new route codes — research later; low priority.

**landmarkAliases**
- [ ] Lawton (Liwasang Bonifacio, Manila) — avoid the Taguig "Lawton Ave" match.
- [ ] Rotonda → Pasay Rotonda (EDSA/Taft); "RTDA." in signboards.
- [ ] Quiapo (Quiapo Church / Plaza Miranda), Morayta (FEU), UST (España), Pedro Gil Taft, Cubao (Araneta City).
- [ ] Ayala / Makati CBD (Ayala Ave – Paseo de Roxas), Buendia, Vito Cruz (DLSU), PITX, Divisoria.

## Phase 1 results (network.json)

> Built by `npm run build:data` on 2026-10-04. Logic lives in `lib/data/` (pure, tested); the script only reads and writes files.

| | Count |
|---|---|
| Patterns (route × direction) | **1,719** — jeep 1,522 · bus 191 · train 6 · UV 0 |
| Stops (only ones a pattern uses) | 4,835 |
| Walking transfers (stop pairs ≤ 300 m) | 7,152 |
| Patterns with a real shape | 8 (all 6 train directions + 2 jeeps); the rest draw stop to stop |
| Loops | 5 |
| Road directions worked out (`towards`) | **1,361 of 1,708 (80%)**; 347 unknown |
| File size | ~1.7 MB (patterns 1.3 MB, stops 0.5 MB, transfers 0.1 MB) |

**What a pattern is.** Each GTFS road route has exactly one stop sequence, and each train route has
two (one per direction). So one *pattern* = one route ridden one way. The router may only ride a
pattern forward. Train patterns get ids `ROUTE_880747:0` / `:1`; road patterns keep their route_id.

**Train shapes.** The feed reuses one shape for both directions of a line. The builder flips it when
the stops run the other way, and checks each station against the line *segments* (shape vertices
are sparse, so checking vertices alone put stations up to ~220 m off and wrongly rejected them).

**Direction (`towards`) — how it's worked out.** The feed has no `direction_id` or headsign, so:
1. Split the signboard into its two ends ("Baclaran – SM Fairview"). Names with no separator
   ("Alabang Fairview") try every word split and keep the one whose halves both match stops.
2. Find stops whose names mention each end (the ", City" suffix is ignored so "Pasay" doesn't match all of Pasay).
3. If the first stop is near end A's stops and the last near end B's, it heads to B. It must be clearly
   better than the opposite way round (≥1 km better, or ≥3× better for routes that stop short of their ends).
4. Second pass: every solved route teaches where its two places are; those points are added and the rest retried.
5. Reverse twins (same name, mirrored ends) copy the solved twin, flipped.

Checked: all **625** reverse-twin pairs where both sides were solved point opposite ways (no contradictions).
Unknown directions are mostly signboard places that never appear in stop names ("Divisoria", "Pier North")
— stop names are street intersections. Adding those places to `landmarkAliases` (Phase 3) raises coverage on
the next build, because the matcher reads them. **The router and UI must cope with `towards` missing**
(e.g. say "papuntang [last stop area]" or just the signboard).

**Name cleanup** follows the rules above plus: spaced separators win over bare hyphens, and
hyphenated place names (Bel-Air, Bagong-Silang, Dagat-Dagatan) are never split. Some source names are
just messy ("Taftave.,Pasa Rotonda"); fix those with `renameRoutes` when they matter.

## Gemini free tier

- **Model:** `gemini-3.8-flash` — listed as the current stable Flash model and free-of-charge on the
  official models and pricing pages (models page updated 1 Oct 2026). Fallback if its free quota is
  too tight: `gemini-3.5-flash-lite` (also free; cheaper/faster class).
- **Rate limits:** Google no longer prints free-tier numbers in the docs; they are shown per project at
  <https://aistudio.google.com/rate-limit>. **TODO (owner):** run `npm run test:gemini`, then copy the
  free-tier RPM / TPM / RPD for the chosen model here:

  | Model | RPM | TPM | RPD | Checked |
  |---|---|---|---|---|
  | gemini-3.8-flash | ? | ? | ? | — |

- **Privacy:** on the free tier, Google says content *is* used to improve its products — another reason
  for the "Don't type personal information" note.
- **Design consequence:** B.AI spends 2 calls per question, so the daily question budget is RPD ÷ 2.
  Whatever the number, Phase 4's fallback must treat HTTP 429 as normal, not exceptional.

Sources: [Gemini models](https://ai.google.dev/gemini-api/docs/models),
[Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing),
[Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits),
[sakayph/gtfs](https://github.com/sakayph/gtfs).
