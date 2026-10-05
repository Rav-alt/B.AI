# LRT-1 to Dr. Santos and the EDSA Carousel added to the route data

**Date:** 2026-10-05 15:35
**Prompt I was given:** "Can you use that information to our system?", meaning the researched LRT-1, EDSA Carousel and PITX
route guide.
**Files touched:** `data/corrections.json`, `data/landmarks.json`, `data/generated/network.json` (rebuilt),
`tests/network.test.ts`, `tests/geo.test.ts`, `docs/data-notes.md`, `PLAN.md`

## What changed
B.AI now knows the five LRT-1 stations that opened in November 2024 (Redemptorist-Aseana, MIA Road, PITX, Ninoy Aquino
Avenue, Dr. Santos), so "PITX to Monumento" or "Pedro Gil to PITX" is one train ride. It also knows the EDSA Carousel bus
from PITX to Monumento and back, with every busway stop. "SM Sucat" and "DFA Aseana" are now places it can find. The 2015
feed's stale EDSA buses are still there; see "What's not finished".

## How it was done
1. **LRT-1** (`data/corrections.json`): `removeRoutes` drops the feed line `ROUTE_880747` (Baclaran – Roosevelt).
   `addRoutes` adds `CORR_LRT1`: the 20 old stations by their feed `stopId`, then the 5 new ones as name + coordinates
   from each station's Wikipedia infobox. `bothDirections: true` makes both directions.
2. **EDSA Carousel** (`data/corrections.json`): two one-way routes, `CORR_CAROUSEL_NB` (23 stops) and
   `CORR_CAROUSEL_SB` (24 stops), because the two directions stop at slightly different places (Ayala vs One Ayala,
   City of Dreams vs Ayala Malls Manila Bay, Tramo only southbound). Names follow the signboard format
   "PITX - Monumento via EDSA Carousel", so asking for "EDSA Carousel" matches through the `via` part.
3. **Coordinates for busway stops**: OpenStreetMap's Overpass API was blocked from the workspace, so each stop uses
   the nearest stop in the GTFS feed or an existing landmark. Every coordinate's origin is written in the entry's `source`.
4. **Landmarks** (`data/landmarks.json`): added "Dr. Santos LRT" (aliases Sucat LRT, SM Sucat) and "DFA Aseana";
   added "Asiaworld" aliases to PITX.
5. Ran `npm run build:data`, then `npm test`. Two tests changed (below), then all 138 pass.

### Key code
```json
{ "routeId": "CORR_LRT1", "mode": "train", "line": "LRT-1",
  "stops": [{ "stopId": "LTFRB_4963" }, "…19 more feed stations…",
            { "name": "PITX LRT", "lat": 14.50848, "lon": 120.99128 }, "…"],
  "bothDirections": true }
```
Reusing the feed's `stopId`s keeps the walking transfers to nearby jeep and bus stops that the build already computes.
New stations end in " LRT", so the build names the line "Fernando Poe Jr. – Dr. Santos" from its end stations.

## Why it was done this way
- **Reason for the approach:** `corrections.json` is the project's way to fix the old feed without touching the raw
  GTFS files, and every entry carries a `source` and `updated` date.
- **Alternatives considered:** adding only the 5 new stations as a separate "Baclaran – Dr. Santos" train. That would
  make the router count a fake transfer at Baclaran, so the whole line was replaced instead.
- **Trade-offs:** LRT-1 lost the feed's drawn track shape and is now drawn station to station on the map. Carousel stop
  positions are approximate (about 50–300 m off the real median platforms).

## Concepts to learn from this
- **Data corrections layer:** keep raw data untouched and put dated, sourced fixes in a separate file merged at build time.
- **Directed patterns:** a route is stored once per direction, so a bus with different stops each way is just two
  one-way routes.
- **Brittle tests:** a test that relied on "this place is not in our data" broke when the data grew. It now uses a place
  that is truly absent.

## How to undo or tweak it
- Remove the three `CORR_…` entries from `addRoutes` and the `ROUTE_880747` entry from `removeRoutes` in
  `data/corrections.json`, then run `npm run build:data`.
- To move a Carousel stop, edit its `lat`/`lon` in `data/corrections.json` and rebuild.
- Test updates: `tests/network.test.ts` now expects the LRT-1 names "Dr. Santos – Fernando Poe Jr." and 25 stations;
  `tests/geo.test.ts` uses "Okada Mall Manila" for the Nominatim retry test, because "Ayala Malls Manila Bay" is now a
  Carousel stop and is found locally.

## Checks performed
- [x] `npm run build:data`: 1,721 patterns, 4,887 stops, 7,429 transfers, no warnings.
- [x] `npm test`: 138 of 138 pass. ESLint passes on the two changed tests.
- [x] `npm run try:router` checks: PITX → Monumento (LRT-1 direct), Pedro Gil → PITX, SM Sucat → Quiapo Church,
      Ayala → PITX (Carousel from One Ayala), DFA Aseana → Cubao (Carousel + MRT-3).
- [ ] Not checked in the browser: how the longer LRT-1 line and the Carousel look on the map.

## What's not finished
- **Stale EDSA buses:** about 180 of the feed's 191 bus patterns run on EDSA, including the bus acceptance test 2
  relies on. Removing them needs a per-route review, so they stay for now.
- **Carousel speed:** the router uses one bus speed, so it doesn't know the busway is faster than EDSA traffic.
- **PITX city buses, PITX modern jeeps and UV Express** are not added: the research has their names and roads, not
  their stop sequences.
