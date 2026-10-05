# Unknown place: ask for the address, pin on the map, nearest stop

**Date:** 2026-10-05 14:34
**Prompt I was given:** "If the location is unknown, use OpenStreetMap to find a nearby place and route… if it's really
unknown, ask the user for the exact address." Agreed plan: ask for the address with context remembered, a "pin on map"
button, and say how far the nearest stop is when nothing is within walking distance.
**Files touched:** `lib/types.ts`, `lib/chat/pipeline.ts`, `lib/chat/templates.ts`, `lib/router/plan.ts`,
`lib/router/params.ts`, `components/FollowUp.tsx` (new), `components/PinMap.tsx` (new), `components/Messages.tsx`,
`components/Chat.tsx`, `tests/chat.test.ts`, `tests/router.test.ts`, `DESIGN.md`

## What changed
When B.AI can't find a place, it now asks for the address ("Ano ang address nito (street at barangay o city), o
anong malapit na landmark?") and shows a small address box plus an **I-pin sa mapa** button. The reply keeps the
place that was already found, so you don't retype the whole question, and it doesn't use a Gemini call. When a place
is found but no stop is within 1 km, B.AI names the nearest stop and its distance ("Payatas Road, mga 1.5 km: mag-tricycle
o maglakad") and offers one button for the route from/to that stop.

## How it was done
1. **Types** (`lib/types.ts`): `ChatResponse.followUp` = which place is missing (`field`), what was typed (`query`), and
   the question rewritten as a plain From/To request with places already found kept in `picked`.
   `PlanResult.nearest` = side, nearest stop, straight-line metres.
2. **Pipeline** (`lib/chat/pipeline.ts`): `resolve()` marks "not found" with `askAgain`; `withFollowUp()` builds the
   From/To request. If the *origin* is unknown, the destination is also looked up in the local list (instant, no
   Nominatim) and kept. A picked spot outside Metro Manila is refused.
3. **Router** (`lib/router/plan.ts`): `nearestStop()` searches up to `NEAREST_STOP_MAX_M` (5 km) only when the status is
   `no_stops_near_origin` / `no_stops_near_destination`.
4. **Templates** (`lib/chat/templates.ts`): new "not found" wording; the no-route text uses `nearest` when present.
5. **UI**: `FollowUp.tsx` (address form + pin dialog), `PinMap.tsx` (Leaflet, client-only), `Messages.tsx`
   (`place_not_found` view and the nearest-stop button), `Chat.tsx` (`answerPlace` / `pinPlace` send the From/To request).

### Key code
```ts
// Chat.tsx: the address replaces only the missing place; everything else comes from the server's follow-up.
answerPlace: (f, text) =>
  void send({ ...f.request, [f.field === "origin" ? "from" : "to"]: text, ...(req.location ? { location: req.location } : {}) }, text),
```
The server already turned the question into `{ from, to, prefs, picked }`. A From/To request goes straight to
geocoding, which is why the reply needs no AI call and still works when Gemini is down.

## Why it was done this way
- **Reason for the approach:** reusing the existing From/To path and `picked` field meant no new endpoint and no new
  way of resolving places. The server writes the follow-up because it knows what Gemini parsed; the browser just sends it back.
- **Pin design:** the pin stays fixed at the map's center and the map moves under it (drag, tap, or arrow keys). A
  "tap to drop a marker" map can't be used with a keyboard; this one can.
- **Alternatives considered:** detecting in the main input whether the next message is an address (guessing; a new
  question would be misread); reverse-geocoding the pin to get a street name (an extra Nominatim call per pin).
- **Trade-offs:** a check-routes question ("bus to SM Fairview or jeep to Divisoria?") becomes a plain trip plan after
  the follow-up, because From/To can't carry the candidates. A pinned spot is shown as "Naka-pin na lugar".

## Concepts to learn from this
- **Conversation state without a database:** the server returns everything needed for the next step (`followUp`),
  and the client sends it back. Nothing is stored on the server.
- **Discriminated results** (`askAgain` on `Resolved`): a flag says *why* something failed, instead of parsing the error text.
- **Accessible map input:** a center crosshair works with touch, mouse and keyboard.

## How to undo or tweak it
- Wording: `placeNotFoundText()` and `noRouteText()` in `lib/chat/templates.ts`.
- How far "nearest stop" looks: `NEAREST_STOP_MAX_M` in `lib/router/params.ts`.
- Pin map start: `METRO_CENTER` and the zoom levels in `components/FollowUp.tsx`.
- To remove the pin button: delete the `<Dialog>` block in `FollowUp.tsx` (the address form keeps working).

## Checks performed
- [x] `npx vitest run`: 138 tests pass (4 new: follow-up keeps the found place and skips the AI; pin used / pin outside
      Metro Manila refused; nearest stop on both sides, none beyond 5 km; nearest-stop wording).
- [x] `next build` passes, including TypeScript (fonts mocked locally because Google Fonts is blocked here). `eslint` clean.
- [x] Playwright at 360px: unknown destination → address "UST" → route; unknown origin → pin dialog → arrow key →
      "Gamitin ang puwestong ito" → route; no-stop answer → "Ruta papunta sa Payatas Road" → route. No horizontal scroll.
- [x] DESIGN §13 scan of the diff: no gradient/shadow/blur/`dark:`/default palette; only `m.*` Motion; new icon `MapPin` added to §8.
- [ ] Not seen with real map tiles or real fonts (both blocked here). Owner: try the pin dialog on a phone.
