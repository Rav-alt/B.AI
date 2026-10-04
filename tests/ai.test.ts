// Phase 4: the Gemini client, with the SDK call faked (tests never use the network or a key).
import { describe, expect, it, vi } from "vitest";
import { ApiError, type GenerateContentParameters } from "@google/genai";
import { AiUnavailable, cooldownFor, createGeminiClient, type Generate } from "@/lib/ai/gemini";
import { RAW_INTENT_JSON_SCHEMA, RawIntentSchema, toIntent } from "@/lib/ai/intent";
import { answerFacts } from "@/lib/ai/prompts";
import { loadNetwork } from "@/lib/router/network";
import { planTrip } from "@/lib/router/plan";

const raw = (over: Record<string, unknown>) =>
  RawIntentSchema.parse({
    type: "plan_trip", origin: "", originIsCurrentLocation: false, destination: "", destinationIsCurrentLocation: false,
    candidates: [], prefs: { fewestTransfers: false, lessWalking: false, trainsOnly: false, avoidTrains: false }, language: "taglish",
    ...over,
  });

describe("toIntent (model JSON → Intent)", () => {
  it("plan_trip with places and only the prefs that are on", () => {
    const { intent, lang } = toIntent(raw({ origin: "Pedro Gil Taft", destination: "España", prefs: { fewestTransfers: true, lessWalking: false, trainsOnly: false, avoidTrains: false } }));
    expect(intent).toEqual({ type: "plan_trip", origin: { text: "Pedro Gil Taft" }, destination: { text: "España" }, prefs: { fewestTransfers: true } });
    expect(lang).toBe("fil");
  });

  it("check_routes keeps candidates; 'any' mode is dropped", () => {
    const { intent } = toIntent(raw({
      type: "check_routes", origin: "Pedro Gil Taft", destination: "España", language: "en",
      candidates: [{ mode: "bus", signboard: "SM Fairview" }, { mode: "any", signboard: "Divisoria" }],
    }));
    expect(intent).toMatchObject({ type: "check_routes", candidates: [{ mode: "bus", signboard: "SM Fairview" }, { signboard: "Divisoria" }] });
  });

  it("a missing end becomes need_more_info, current location counts as given", () => {
    expect(toIntent(raw({ origin: "Cubao" })).intent).toEqual({ type: "need_more_info", missing: ["destination"] });
    expect(toIntent(raw({ originIsCurrentLocation: true, destination: "UST" })).intent).toMatchObject({
      type: "plan_trip", origin: { useCurrentLocation: true },
    });
  });

  it("check_routes whose only 'signboards' are the destination becomes plan_trip", () => {
    const { intent } = toIntent(raw({
      type: "check_routes", origin: "Pedro Gil Taft", destination: "España",
      candidates: [{ mode: "bus", signboard: "España" }, { mode: "jeep", signboard: "Espana" }],
    }));
    expect(intent.type).toBe("plan_trip");
  });

  it("off_topic stays off_topic", () => {
    expect(toIntent(raw({ type: "off_topic", language: "en" }))).toEqual({ intent: { type: "off_topic" }, lang: "en" });
  });
});

const reply = (obj: unknown) => ({ text: typeof obj === "string" ? obj : JSON.stringify(obj) });

describe("Gemini client", () => {
  it("asks for JSON with our schema, temperature 0 and minimal thinking", async () => {
    const generate = vi.fn<Generate>(async () => reply({ ...raw({ origin: "Cubao", destination: "Ayala" }) }));
    const ai = createGeminiClient({ model: "m", generate });
    const out = await ai.parseIntent("Cubao to Ayala");
    expect(out.intent.type).toBe("plan_trip");
    const req = generate.mock.calls[0]![0] as GenerateContentParameters;
    expect(req.model).toBe("m");
    expect(req.config?.responseMimeType).toBe("application/json");
    expect(req.config?.responseJsonSchema).toBe(RAW_INTENT_JSON_SCHEMA);
    expect(req.config?.temperature).toBe(0);
    expect(req.config?.thinkingConfig?.thinkingLevel).toBe("MINIMAL");
  });

  it("passes earlier turns so a one-word reply can be understood", async () => {
    const generate = vi.fn<Generate>(async () => reply(raw({ origin: "Cubao", destination: "España" })));
    await createGeminiClient({ model: "m", generate }).parseIntent("España", [
      { role: "user", text: "Nasa Cubao ako" },
      { role: "assistant", text: "Saan ka papunta?" },
    ]);
    expect(String(generate.mock.calls[0]![0].contents)).toContain("User: Nasa Cubao ako");
  });

  it("turns HTTP 429 into AiUnavailable('rate_limited')", async () => {
    const generate = vi.fn<Generate>(async () => {
      throw new ApiError({ message: "quota", status: 429 });
    });
    await expect(createGeminiClient({ model: "m", generate }).parseIntent("x")).rejects.toMatchObject({ reason: "rate_limited" });
  });

  it("steps thinking down MINIMAL → LOW → default when the model refuses, and remembers it", async () => {
    const refuse = () => new ApiError({ message: "Thinking level MINIMAL is not supported for this model.", status: 400 });
    const generate = vi.fn<Generate>().mockRejectedValueOnce(refuse()).mockResolvedValue(reply(raw({ origin: "A", destination: "B" })));
    const ai = createGeminiClient({ model: "m", generate });
    await ai.parseIntent("A to B");
    await ai.parseIntent("A to B");
    const levels = generate.mock.calls.map((c) => c[0].config?.thinkingConfig?.thinkingLevel);
    expect(levels).toEqual(["MINIMAL", "LOW", "LOW"]);

    const never = vi.fn<Generate>().mockRejectedValueOnce(refuse()).mockRejectedValueOnce(refuse()).mockResolvedValue(reply(raw({ origin: "A", destination: "B" })));
    await createGeminiClient({ model: "m", generate: never }).parseIntent("A to B");
    expect(never.mock.calls.map((c) => c[0].config?.thinkingConfig?.thinkingLevel)).toEqual(["MINIMAL", "LOW", undefined]);
  });

  it("after a 503, skips the busy main model for 5 minutes", async () => {
    let t = 0;
    const generate = vi.fn<Generate>(async (req) => {
      if (req.model === "main") throw new ApiError({ message: "high demand", status: 503 });
      return reply(raw({ origin: "A", destination: "B" }));
    });
    const ai = createGeminiClient({ model: "main", fallbackModel: "lite", generate, now: () => t });
    await ai.parseIntent("x");
    await ai.parseIntent("x");
    t = 5 * 60_000 + 1;
    await ai.parseIntent("x");
    expect(generate.mock.calls.map((c) => c[0].model)).toEqual(["main", "lite", "lite", "main", "lite"]);
  });

  it("on 503 tries the backup model once; 503 everywhere counts as 'busy'", async () => {
    const busy = () => new ApiError({ message: "high demand", status: 503 });
    const generate = vi.fn<Generate>().mockRejectedValueOnce(busy()).mockResolvedValue(reply(raw({ origin: "A", destination: "B" })));
    const ai = createGeminiClient({ model: "main", fallbackModel: "lite", generate });
    await ai.parseIntent("A to B");
    expect(generate.mock.calls.map((c) => c[0].model)).toEqual(["main", "lite"]);
    const down = createGeminiClient({ model: "main", fallbackModel: "lite", generate: async () => { throw busy(); } });
    await expect(down.parseIntent("x")).rejects.toMatchObject({ reason: "rate_limited" });
  });

  it("a daily-quota 429 switches to the backup and leaves the main model alone until the quota resets", async () => {
    let t = 0;
    const quota = new ApiError({ message: '{"error":{"code":429,"details":[{"retryDelay":"24796s"}]}}', status: 429 });
    const generate = vi.fn<Generate>(async (req) => {
      if (req.model === "main") throw quota;
      return reply(raw({ origin: "A", destination: "B" }));
    });
    const ai = createGeminiClient({ model: "main", fallbackModel: "lite", generate, now: () => t });
    await ai.parseIntent("x");
    t = 6 * 3_600_000; // 6 h later: still before the reset
    await ai.parseIntent("x");
    t = 24_797_000; // after the reset
    await ai.parseIntent("x");
    expect(generate.mock.calls.map((c) => c[0].model)).toEqual(["main", "lite", "lite", "main", "lite"]);
    expect(cooldownFor(quota)).toBe(24_796_000);
    expect(cooldownFor(new ApiError({ message: "x", status: 429 }))).toBe(3_600_000);
  });

  it("a reply cut off by the token limit is an error, not broken JSON", async () => {
    const ai = createGeminiClient({ model: "m", generate: async () => ({ text: '{"type":"plan', candidates: [{ finishReason: "MAX_TOKENS" }], usageMetadata: { thoughtsTokenCount: 1900 } }) });
    await expect(ai.parseIntent("x")).rejects.toThrow(/output limit.*1900/);
  });

  it("rejects broken JSON, empty replies and timeouts as ai_error", async () => {
    const bad = createGeminiClient({ model: "m", generate: async () => reply("not json {") });
    await expect(bad.parseIntent("x")).rejects.toBeInstanceOf(AiUnavailable);
    const empty = createGeminiClient({ model: "m", generate: async () => ({ text: "" }) });
    const place = { name: "A", lat: 14.6, lon: 121, source: "landmark" as const };
    await expect(empty.writeAnswer({ lang: "fil", question: "q", origin: place, destination: place })).rejects.toMatchObject({ reason: "ai_error" });
    const slow = createGeminiClient({ model: "m", timeoutMs: 20, generate: () => new Promise(() => {}) });
    await expect(slow.parseIntent("x")).rejects.toMatchObject({ reason: "ai_error" });
  });
});

describe("answer facts", () => {
  it("are compact: no polylines, short stop names, signboards kept", () => {
    const net = loadNetwork();
    const o = { name: "Pedro Gil Taft", lat: 14.5766, lon: 120.9881, source: "landmark" as const };
    const d = { name: "UST", lat: 14.6097, lon: 120.9897, source: "landmark" as const };
    const facts = answerFacts({ lang: "fil", question: "q", origin: o, destination: d, plan: planTrip(net, o, d) });
    const json = JSON.stringify(facts);
    expect(json).not.toContain("polyline");
    expect(json).toContain("Baclaran – SM Fairview");
    expect(json).not.toContain("Intersection");
    expect(json.length).toBeLessThan(3000);
  });
});
