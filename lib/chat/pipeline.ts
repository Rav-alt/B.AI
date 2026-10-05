// The /api/chat pipeline, as a plain function with its dependencies passed in (so tests can fake them):
//   message → [Gemini] intent → geocode → router → [Gemini] answer (checked) → response
// Without AI (no key, 429, error): simple parser or From/To form → geocode → router → template.
import type {
  ChatRequest, ChatResponse, GeoPlace, GeocodeResult, Intent, Lang, Network, PlaceQuery,
} from "@/lib/types";
import type { Landmark } from "@/lib/geo/landmarks";
import type { NominatimClient } from "@/lib/geo/nominatim";
import { geocodeText, placeFromCoords } from "@/lib/geo/geocode";
import { insideMetroManila } from "@/lib/geo/bbox";
import { matchPlace } from "@/lib/geo/places";
import { planTrip } from "@/lib/router/plan";
import { checkRoutes } from "@/lib/router/check";
import { AiUnavailable, type AiClient } from "@/lib/ai/gemini";
import { DISCLAIMER, detectLang } from "./format";
import { simpleParse } from "./simple-parse";
import { checkAnswerNames } from "./name-check";
import {
  askPlaceText, checkLead, fallbackFormText, needLocationText, needMoreInfoText, offTopicText, placeNotFoundText, planLead,
} from "./templates";

export interface ChatDeps {
  net: Network;
  landmarks: Landmark[];
  nominatim: NominatimClient | null;
  /** Null when there's no GEMINI_API_KEY. */
  ai: AiClient | null;
  /** Called with the real error whenever an AI call fails (the user only sees the fallback). */
  onAiError?: (stage: "parse" | "answer", error: unknown) => void;
  /** Called with the real error when Nominatim fails. */
  onSearchError?: (query: string, error: unknown) => void;
  /** Called for every place B.AI couldn't find, so missing landmarks can be added to data/landmarks.json. */
  onPlaceNotFound?: (query: string, reason: "no_match" | "search_unavailable") => void;
}

type FallbackReason = NonNullable<ChatResponse["fallbackReason"]>;

/** The request in human words, for the AI answer and for logging. */
const questionOf = (req: ChatRequest) => req.message ?? `${req.from ?? "my location"} → ${req.to}`;

type Resolved =
  | { ok: true; place: GeoPlace }
  /** askAgain: the place wasn't found, so the user can answer with an address or a map pin. */
  | { ok: false; response: Omit<ChatResponse, "writer" | "lang">; askAgain?: boolean };

async function resolve(field: "origin" | "destination", q: PlaceQuery, req: ChatRequest, deps: ChatDeps, lang: Lang): Promise<Resolved> {
  const picked = req.picked[field];
  if (picked) {
    const place: GeoPlace = { ...picked, source: picked.stopId ? "stop" : "landmark" };
    if (!insideMetroManila(place.lat, place.lon)) {
      return { ok: false, response: { kind: "place_not_found", text: placeNotFoundText(picked.name, true, lang) } };
    }
    return { ok: true, place };
  }

  let result: GeocodeResult;
  let label: string;
  if ("useCurrentLocation" in q) {
    if (!req.location) return { ok: false, response: { kind: "need_location", text: needLocationText(lang) } };
    result = placeFromCoords(req.location.lat, req.location.lon, lang === "en" ? "Your location" : "Lokasyon mo");
    label = lang === "en" ? "your location" : "lokasyon mo";
  } else {
    result = await geocodeText(q.text, deps);
    label = q.text;
  }
  switch (result.status) {
    case "found":
      return { ok: true, place: result.place };
    case "ambiguous":
      return {
        ok: false,
        response: { kind: "ask_place", text: askPlaceText(field, label, result.choices, lang), choices: { field, options: result.choices } },
      };
    case "outside_area":
      return { ok: false, response: { kind: "place_not_found", text: placeNotFoundText(label, true, lang) } };
    case "not_found":
      deps.onPlaceNotFound?.(label, result.reason);
      return { ok: false, response: { kind: "place_not_found", text: placeNotFoundText(label, false, lang) }, askAgain: true };
  }
}

type Picked = NonNullable<ChatRequest["picked"]["origin"]>;
const toPicked = (p: GeoPlace): Picked => ({ name: p.name.slice(0, 200), lat: p.lat, lon: p.lon, ...(p.stopId ? { stopId: p.stopId } : {}) });

/**
 * Adds `followUp` to a "not found" answer: the question as From/To
 * text, with places already found kept as picks. Skipped when the destination is "my location", which
 * the From/To request can't express.
 */
export function withFollowUp(
  response: Omit<ChatResponse, "writer" | "lang">,
  field: "origin" | "destination",
  intent: Extract<Intent, { type: "plan_trip" | "check_routes" }>,
  req: ChatRequest,
  found: { origin?: GeoPlace; destination?: GeoPlace } = {},
): Omit<ChatResponse, "writer" | "lang"> {
  if ("useCurrentLocation" in intent.destination) return response;
  const query = "text" in intent[field] ? (intent[field] as { text: string }).text : "";
  const picked: ChatRequest["picked"] = { ...req.picked };
  if (found.origin) picked.origin = toPicked(found.origin);
  if (found.destination) picked.destination = toPicked(found.destination);
  delete picked[field];
  return {
    ...response,
    followUp: {
      field,
      query,
      request: {
        ...("useCurrentLocation" in intent.origin ? { fromCurrentLocation: true } : { from: intent.origin.text.slice(0, 200) }),
        to: intent.destination.text.slice(0, 200),
        ...(Object.keys(intent.prefs).length ? { prefs: intent.prefs } : {}),
        picked,
      },
    },
  };
}

/** Skip the second AI call if the first part already took this long (keeps us inside maxDuration). */
export const ANSWER_BUDGET_MS = 12_000;

export async function handleChat(req: ChatRequest, deps: ChatDeps): Promise<ChatResponse> {
  const started = Date.now();
  let lang: Lang = detectLang(req.message ?? "");
  let fallbackReason: FallbackReason | undefined = deps.ai ? undefined : "no_key";
  const done = (r: Omit<ChatResponse, "writer" | "lang">, writer: ChatResponse["writer"] = "template"): ChatResponse => ({
    ...r,
    lang,
    writer,
    ...(fallbackReason ? { fallbackReason } : {}),
  });

  // 1. What is being asked?
  let intent: Intent | undefined;
  if ((req.from || req.fromCurrentLocation) && req.to) {
    const origin: PlaceQuery = req.fromCurrentLocation || !req.from ? { useCurrentLocation: true } : { text: req.from };
    intent = { type: "plan_trip", origin, destination: { text: req.to }, prefs: req.prefs ?? {} };
  } else if (req.message) {
    if (deps.ai) {
      try {
        ({ intent, lang } = await deps.ai.parseIntent(req.message, req.history));
      } catch (e) {
        deps.onAiError?.("parse", e);
        fallbackReason = e instanceof AiUnavailable ? e.reason : "ai_error";
      }
    }
    if (!intent) {
      const trip = simpleParse(req.message);
      if (!trip) return done({ kind: "fallback_form", text: fallbackFormText(lang) });
      intent = { type: "plan_trip", origin: { text: trip.origin }, destination: { text: trip.destination }, prefs: {} };
    }
  }
  if (!intent) return done({ kind: "need_more_info", text: needMoreInfoText(["origin", "destination"], lang) });

  if (intent.type === "off_topic") return done({ kind: "off_topic", text: offTopicText(lang) });
  if (intent.type === "need_more_info") return done({ kind: "need_more_info", text: needMoreInfoText(intent.missing, lang) });

  // 2. Where exactly? (If a place can't be found, the answer carries a follow-up so the user's address
  //    or map pin is sent back as a plain From/To request, keeping the other place and skipping the AI.)
  const o = await resolve("origin", intent.origin, req, deps, lang);
  if (!o.ok) {
    if (!o.askAgain) return done(o.response);
    // Keep the destination too if the local list knows it (instant, no Nominatim), so the reply
    // doesn't look it up again and the pin map can open near the trip.
    const dest = req.picked.destination
      ? undefined
      : "text" in intent.destination ? matchPlace(deps.net, deps.landmarks, intent.destination.text) : undefined;
    return done(withFollowUp(o.response, "origin", intent, req, dest?.status === "found" ? { destination: dest.place } : {}));
  }
  const d = await resolve("destination", intent.destination, req, deps, lang);
  if (!d.ok) return done({ ...(d.askAgain ? withFollowUp(d.response, "destination", intent, req, { origin: o.place }) : d.response), origin: o.place });
  const origin = o.place;
  const destination = d.place;

  // 3. Route (pure code, never AI).
  const result =
    intent.type === "check_routes"
      ? { check: checkRoutes(deps.net, origin, destination, intent.candidates, intent.prefs) }
      : { plan: planTrip(deps.net, origin, destination, intent.prefs) };
  const kind: ChatResponse["kind"] = result.check ? "check" : result.plan.status === "ok" ? "route" : "no_route";
  const template = result.check
    ? checkLead(result.check, origin, destination, lang)
    : planLead(result.plan, origin, destination, lang);
  const base = { kind, origin, destination, ...result, disclaimer: DISCLAIMER[lang] };

  // 4. Words: Gemini if available and it behaves, else the template.
  if (deps.ai && !fallbackReason && kind !== "no_route" && Date.now() - started < ANSWER_BUDGET_MS) {
    try {
      const text = await deps.ai.writeAnswer({ lang, question: questionOf(req), origin, destination, ...result });
      const names = checkAnswerNames(text, deps.net, result);
      if (names.ok) return done({ ...base, text }, "ai");
      deps.onAiError?.("answer", new Error(`answer rejected: unknown ${JSON.stringify(names.unknown)}, missing ${JSON.stringify(names.missing)}\n${text}`));
      fallbackReason = "answer_rejected";
    } catch (e) {
      deps.onAiError?.("answer", e);
      fallbackReason = e instanceof AiUnavailable ? e.reason : "ai_error";
    }
  }
  return done({ ...base, text: template });
}
