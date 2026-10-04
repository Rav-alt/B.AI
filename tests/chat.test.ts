// Phase 4: the /api/chat pipeline. Real network, landmarks and router; AI and Nominatim are faked.
// Covers the acceptance tests in CLAUDE.md that don't need a browser.
import { describe, expect, it, vi } from "vitest";
import { loadNetwork } from "@/lib/router/network";
import { loadLandmarks } from "@/lib/geo/landmarks";
import { handleChat, type ChatDeps } from "@/lib/chat/pipeline";
import { simpleParse } from "@/lib/chat/simple-parse";
import { checkAnswerNames } from "@/lib/chat/name-check";
import { checkText, planLead, planText } from "@/lib/chat/templates";
import { createRateLimiter } from "@/lib/chat/ratelimit";
import { AiUnavailable, type AiClient } from "@/lib/ai/gemini";
import { ChatRequestSchema, ChatResponseSchema, type ChatRequestInput, type Intent, type Lang } from "@/lib/types";
import { DISCLAIMER } from "@/lib/chat/format";

const net = loadNetwork();
const landmarks = loadLandmarks();
const PGT_ESPANA = "Nasa Pedro Gil Taft ako, papuntang España. Anong bus o jeep ang sasakyan ko?";

/** A fake Gemini: returns the given intent, and writes answers with `write` (default: copies the facts' signboards). */
function fakeAi(intent: Intent | AiUnavailable, write?: (facts: Parameters<AiClient["writeAnswer"]>[0]) => string, lang: Lang = "fil") {
  return {
    parseIntent: vi.fn(async () => {
      if (intent instanceof AiUnavailable) throw intent;
      return { intent, lang };
    }),
    writeAnswer: vi.fn(async (input: Parameters<AiClient["writeAnswer"]>[0]) =>
      write ? write(input) : planText(input.plan ?? input.check!.alternative ?? { status: "ok", itineraries: [], walkRadiusM: 600 }, input.origin, input.destination, input.lang),
    ),
  } satisfies AiClient;
}

const deps = (ai: AiClient | null): ChatDeps => ({ net, landmarks, nominatim: null, ai });
const ask = (input: ChatRequestInput, ai: AiClient | null) => handleChat(ChatRequestSchema.parse(input), deps(ai)).then((r) => ChatResponseSchema.parse(r));
const plan = (o: string, d: string, prefs = {}): Intent => ({ type: "plan_trip", origin: { text: o }, destination: { text: d }, prefs });

describe("acceptance tests (CLAUDE.md)", () => {
  it("1. 'Pedro Gil Taft to España' → itinerary, map data, signboards, disclaimer", async () => {
    const r = await ask({ message: PGT_ESPANA }, fakeAi(plan("Pedro Gil Taft", "España")));
    expect(r.kind).toBe("route");
    expect(r.plan!.itineraries.length).toBeGreaterThanOrEqual(1);
    expect(r.plan!.itineraries[0]!.legs.every((l) => l.polyline.length >= 2)).toBe(true); // map
    expect(r.text).toMatch(/\*\*Baclaran – SM Fairview\*\*/);
    expect(r.disclaimer).toBe(DISCLAIMER.fil);
    expect(r.writer).toBe("ai");
  });

  it("2. Fairview bus vs Divisoria jeep → each answered from data", async () => {
    const intent: Intent = {
      type: "check_routes", origin: { text: "Pedro Gil Taft" }, destination: { text: "España" }, prefs: {},
      candidates: [{ mode: "bus", signboard: "SM Fairview" }, { mode: "jeep", signboard: "Divisoria" }],
    };
    const r = await ask({ message: "Galing Pedro Gil Taft papuntang España, bus papuntang SM Fairview o jeep papuntang Divisoria?" }, fakeAi(intent, () => "x"));
    expect(r.kind).toBe("check");
    expect(r.check!.verdicts.map((v) => v.verdict)).toEqual(["yes", "no"]);
    // the fake AI wrote nonsense ("x") → rejected → template conclusion line
    expect(r.writer).toBe("template");
    expect(r.fallbackReason).toBe("answer_rejected");
    expect(r.text).toBe("Kaya: sumakay ka ng bus na **Baclaran – SM Fairview**.");
    // the per-vehicle sentences (shown on the verdict cards) come from the data
    expect(checkText(r.check!, r.origin!, r.destination!, "fil")).toMatch(/bus \*\*SM Fairview\*\*: oo/);
    expect(checkText(r.check!, r.origin!, r.destination!, "fil")).toMatch(/jeep \*\*Divisoria\*\*: hindi/);
  });

  it("2b. neither candidate works → an alternative is suggested", async () => {
    const intent: Intent = {
      type: "check_routes", origin: { text: "Pedro Gil Taft" }, destination: { text: "España" }, prefs: {},
      candidates: [{ mode: "jeep", signboard: "Divisoria" }],
    };
    const r = await ask({ message: "jeep papuntang Divisoria?" }, fakeAi(intent, () => "x"));
    expect(r.check!.alternative?.status).toBe("ok");
    expect(r.text).toBe("Wala sa mga 'yan ang aabot. Ito ang pwede:");
  });

  it("4. missing destination → B.AI asks for it (no second AI call)", async () => {
    const ai = fakeAi({ type: "need_more_info", missing: ["destination"] });
    const r = await ask({ message: "Nasa Cubao ako" }, ai);
    expect(r).toMatchObject({ kind: "need_more_info", text: "Saan ka papunta?" });
    expect(ai.writeAnswer).not.toHaveBeenCalled();
  });

  it("5. 'What's the weather?' → polite decline and redirect", async () => {
    const r = await ask({ message: "What's the weather?" }, fakeAi({ type: "off_topic" }, undefined, "en"));
    expect(r.kind).toBe("off_topic");
    expect(r.text).toMatch(/only help with routes/);
    expect(r.text).toMatch(/Where are you headed\?/);
  });

  it("6. Gemini off or rate-limited → From/To still returns routes", async () => {
    const form = await ask({ from: "Pedro Gil Taft", to: "España" }, null);
    expect(form).toMatchObject({ kind: "route", writer: "template", fallbackReason: "no_key" });

    const limited = await ask({ message: PGT_ESPANA }, fakeAi(new AiUnavailable("rate_limited", "429")));
    expect(limited).toMatchObject({ kind: "route", writer: "template", fallbackReason: "rate_limited" }); // simple parser read it

    const unreadable = await ask({ message: "pa-help naman po bukas ng umaga" }, fakeAi(new AiUnavailable("rate_limited", "429")));
    expect(unreadable.kind).toBe("fallback_form");
  });

  it("7. an answer naming a route the router didn't return is replaced by the template", async () => {
    const r = await ask({ message: PGT_ESPANA }, fakeAi(plan("Pedro Gil Taft", "España"), (i) =>
      `${planText(i.plan!, i.origin, i.destination, i.lang)}\nO kaya sumakay ng **Alabang – Fairview**.`,
    ));
    expect(r.writer).toBe("template");
    expect(r.fallbackReason).toBe("answer_rejected");
    expect(r.text).not.toContain("Alabang – Fairview");
  });
});

describe("lead line and form extras", () => {
  it("the template lead is one line with time and transfers", async () => {
    const r = await ask({ from: "Pedro Gil Taft", to: "España" }, null);
    expect(r.text).toMatch(/^Ito ang pinakamadali: mga \*\*\d+ min\*\*, walang transfer\.$/);
    expect(r.text).toBe(planLead(r.plan!, r.origin!, r.destination!, "fil"));
  });

  it("the From/To form passes preferences and 'from my location'", async () => {
    const trains = await ask({ from: "Cubao", to: "Ayala", prefs: { trainsOnly: true } }, null);
    expect(trains.plan!.itineraries.every((it) => it.legs.every((l) => l.mode === "walk" || l.mode === "train"))).toBe(true);
    const here = await ask({ fromCurrentLocation: true, to: "UST", location: { lat: 14.5766, lon: 120.9881 } }, null);
    expect(here.kind).toBe("route");
    expect(here.origin!.source).toBe("device");
  });
});

describe("places in the conversation", () => {
  it("an ambiguous place returns choices, and the picked one completes the trip", async () => {
    const ai = fakeAi(plan("Buendia", "UST"));
    const first = await ask({ message: "Buendia to UST" }, ai);
    expect(first.kind).toBe("ask_place");
    expect(first.choices!.field).toBe("origin");
    expect(first.text).toMatch(/^Alin dito/);
    const pick = first.choices!.options[0]!;
    const second = await ask({ message: "Buendia to UST", picked: { origin: pick } }, ai);
    expect(second.kind).toBe("route");
    expect(second.origin!.name).toBe(pick.name);
  });

  it("'use my location' asks for coordinates, then uses them", async () => {
    const ai = fakeAi({ type: "plan_trip", origin: { useCurrentLocation: true }, destination: { text: "UST" }, prefs: {} });
    expect((await ask({ message: "dito ako, papuntang UST" }, ai)).kind).toBe("need_location");
    const r = await ask({ message: "dito ako, papuntang UST", location: { lat: 14.5766, lon: 120.9881 } }, ai);
    expect(r.kind).toBe("route");
    expect(r.origin).toMatchObject({ source: "device", name: "Lokasyon mo" });
  });

  it("an unknown place says so (Nominatim off)", async () => {
    const r = await ask({ from: "Xyzzy Plugh", to: "UST" }, null);
    expect(r.kind).toBe("place_not_found");
    expect(r.text).toContain("Xyzzy Plugh");
  });

  it("English questions get English templates", async () => {
    const r = await ask({ message: "How do I get from Cubao to Ayala?" }, null);
    expect(r.kind).toBe("route");
    expect(r.lang).toBe("en");
    expect(r.text).toMatch(/^Easiest way: about \*\*\d+ min\*\*, no transfers\.$/);
    expect(r.destination!.name).toBe("Ayala Center");
    expect(r.disclaimer).toBe(DISCLAIMER.en);
  });
});

describe("simpleParse (no-AI reader)", () => {
  it.each([
    ["Pedro Gil Taft to España", "Pedro Gil Taft", "España"],
    [PGT_ESPANA, "Pedro Gil Taft", "España"],
    ["galing Cubao papuntang Makati", "Cubao", "Makati"],
    ["Paano pumunta from UST to MOA?", "UST", "MOA"],
    ["How do I get from Cubao to Ayala?", "Cubao", "Ayala"],
    ["Recto → Monumento", "Recto", "Monumento"],
    ["Galing Pedro Gil Taft papuntang España, bus papuntang SM Fairview o jeep papuntang Divisoria?", "Pedro Gil Taft", "España"],
  ])("%s", (msg, o, d) => {
    expect(simpleParse(msg)).toEqual({ origin: o, destination: d });
  });
  it("returns null when there's no trip in it", () => {
    expect(simpleParse("What's the weather?")).toBeNull();
    expect(simpleParse("Saan ang pinakamalapit na LRT?")).toBeNull();
  });
});

describe("answer name check", () => {
  const o = { name: "Pedro Gil Taft", lat: 14.5766, lon: 120.9881, source: "landmark" as const };
  const d = { name: "UST", lat: 14.6097, lon: 120.9897, source: "landmark" as const };
  it("passes the template's own text, fails on extra or missing routes", async () => {
    const { planTrip } = await import("@/lib/router/plan");
    const p = planTrip(net, o, d);
    const good = planText(p, o, d, "fil");
    expect(checkAnswerNames(good, net, { plan: p }).ok).toBe(true);
    expect(checkAnswerNames(`${good} Pwede rin ang Alabang – Fairview.`, net, { plan: p }).unknown).toEqual(["alabang fairview"]);
    expect(checkAnswerNames("Mag-jeep ka lang.", net, { plan: p }).missing.length).toBeGreaterThan(0);
  });
});

describe("rate limiter", () => {
  it("allows N per window per visitor", () => {
    let t = 0;
    const rl = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
    expect([rl.allow("a"), rl.allow("a"), rl.allow("a"), rl.allow("b")]).toEqual([true, true, false, true]);
    t = 1001;
    expect(rl.allow("a")).toBe(true);
  });
});

describe("POST /api/chat", () => {
  it("400 on a bad body, 200 with a route for From/To (no key in tests)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("NOMINATIM_CONTACT", "");
    const { POST } = await import("@/app/api/chat/route");
    const post = (body: unknown) =>
      POST(new Request("http://x/api/chat", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
    expect((await post("{nope")).status).toBe(400);
    expect((await post({ history: [] })).status).toBe(400);
    const ok = await post({ from: "Pedro Gil Taft", to: "España" });
    expect(ok.status).toBe(200);
    const json = ChatResponseSchema.parse(await ok.json());
    expect(json.kind).toBe("route");
    vi.unstubAllEnvs();
  });
});
