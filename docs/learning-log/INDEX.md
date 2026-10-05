# Learning Log

- 2026-10-05 — [LRT-1 extension + EDSA Carousel](2026-10-05_1535_lrt1-extension-and-carousel.md) — LRT-1 now runs to Dr. Santos (25 stations) and the EDSA Carousel (PITX ⇄ Monumento) is in the route data; 138 tests pass
- 2026-10-05 — [Ask for the address, pin on map](2026-10-05_1434_ask-address-and-pin.md) — unknown place → B.AI asks for the address or a map pin and keeps the other place (no AI call); no stop nearby → names the nearest stop and offers the route to it
- 2026-10-05 — [Place search retries](2026-10-05_1338_place-search-retries.md) — Nominatim retries with shorter names ("Ayala Mall" → "Ayala"), not-found places and search errors are logged, added Ayala Malls Manila Bay + STI College Pasay-EDSA
- 2026-10-05 — [Phase 5: chat UI](2026-10-05_0230_phase-5-ui.md) — welcome screen, trip answers with signboard placards and steps, Leaflet map card, OO/HINDI cards, place picker, From/To fallback, /limitations; Gemini now writes only the lead line
- 2026-10-05 — [Phase 4: AI layer and API](2026-10-05_0130_phase-4-ai-and-api.md) — POST /api/chat: Gemini reads the question and words the answer, code does the routing; AI text is checked against the router result; full no-AI fallback
- 2026-10-05 — [Phase 3: geocoding](2026-10-05_0050_phase-3-geocoding.md) — place names → map points: 36 sourced landmarks + station/stop names first, polite cached Nominatim fallback, "Alin dito?" for ambiguous names
- 2026-10-05 — [Phase 2: router](2026-10-05_0015_phase-2-router.md) — planTrip() finds up to 3 different ways from A to B, checkRoutes() says yes/no per signboard; pure TypeScript, 62 tests pass
- 2026-10-04 — [Phase 1: data pipeline](2026-10-04_2355_phase-1-data-pipeline.md) — npm run build:data writes network.json (1,719 route directions, cleaned signboard names, 80% of directions known); first corrections applied
- 2026-10-04 — [Project status tracking](2026-10-04_2345_project-status-tracking.md) — added a "Current status" block to PLAN.md, a "Start here" list to CLAUDE.md, and copied the docs into the repo
- 2026-10-04 — [Gemini test result](2026-10-04_2335_gemini-test-result.md) — first real Gemini call works; found that hidden thinking uses 95% of tokens
- 2026-10-04 — [Phase 0: scaffold and data check](2026-10-04_2330_phase-0-scaffold-and-data-check.md) — Next.js scaffold builds; GTFS feed inspected; data-notes.md written; jeep vs bus comes from the route ID
- 2026-10-04 — [Build plan](2026-10-04_2305_build-plan.md) — wrote PLAN.md: Phases 0–6, data check first, then build the pipeline bottom-up
- 2026-10-04 — [shadcn/ui + Motion stack](2026-10-04_2300_shadcn-motion-stack.md) — added shadcn/ui and Motion to CLAUDE.md and wrote the matching rules into DESIGN.md
