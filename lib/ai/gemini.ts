// Gemini client for the two calls per question: parseIntent() and writeAnswer().
// Server-side only (the API key must never reach the browser).
// Any failure becomes AiUnavailable, and the pipeline falls back to the no-AI path.
import { ApiError, GoogleGenAI, ThinkingLevel, type GenerateContentParameters } from "@google/genai";
import type { Intent, Lang } from "@/lib/types";
import { RAW_INTENT_JSON_SCHEMA, RawIntentSchema, toIntent } from "./intent";
import { ANSWER_SYSTEM, PARSE_SYSTEM, answerFacts, type AnswerInput } from "./prompts";

export type AiFailure = "rate_limited" | "ai_error";

export class AiUnavailable extends Error {
  constructor(
    readonly reason: AiFailure,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AiUnavailable";
  }
}

export interface HistoryTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AiClient {
  parseIntent(message: string, history?: HistoryTurn[]): Promise<{ intent: Intent; lang: Lang }>;
  writeAnswer(input: AnswerInput): Promise<string>;
}

/** The parts of an SDK response we read. */
export interface GenerateResult {
  text?: string | undefined;
  candidates?: { finishReason?: string | undefined }[] | undefined;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } | undefined;
}

/** The one SDK call we use, injectable so tests never hit the network. */
export type Generate = (req: GenerateContentParameters) => Promise<GenerateResult>;

/** One line per attempt, for debugging (`npm run try:chat` prints these). */
export interface CallLog {
  model: string;
  ms: number;
  /** Thinking level sent ("default" = not sent). */
  thinking: string;
  ok: boolean;
  finishReason?: string | undefined;
  usage?: GenerateResult["usageMetadata"];
  error?: string;
}

export interface GeminiOptions {
  apiKey?: string;
  model: string;
  /** Tried once when the main model is overloaded (503/500) or times out. */
  fallbackModel?: string | undefined;
  generate?: Generate;
  timeoutMs?: number;
  onCall?: (log: CallLog) => void;
  now?: () => number;
}

/** Least thinking first; `undefined` = don't send the setting (model default). */
const THINKING_LEVELS: (ThinkingLevel | undefined)[] = [ThinkingLevel.MINIMAL, ThinkingLevel.LOW, undefined];
/** How long to skip a main model after it was overloaded (503) or timed out. */
export const BUSY_COOLDOWN_MS = 5 * 60_000;

const isThinkingConfigError = (e: unknown) => e instanceof ApiError && e.status === 400 && /think/i.test(e.message);
/**
 * Worth trying the backup model: quota used up (429; free-tier quotas are per model), overloaded (503),
 * server error, or too slow.
 */
const isBusy = (e: unknown) =>
  (e instanceof ApiError && [429, 500, 503, 504].includes(e.status)) ||
  (e instanceof AiUnavailable && /timed out/.test(e.message));

/**
 * How long to leave a busy model alone. A 429 says when the quota resets ("retryDelay":"24796s"), so
 * we wait that long (max 24 h); otherwise BUSY_COOLDOWN_MS.
 */
export function cooldownFor(e: unknown): number {
  if (e instanceof ApiError && e.status === 429) {
    const m = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(e.message);
    const secs = m?.[1] ? Number(m[1]) : NaN;
    if (Number.isFinite(secs)) return Math.min(Math.max(secs * 1000, BUSY_COOLDOWN_MS), 24 * 3_600_000);
    return 60 * 60_000; // quota hit but no hint: try again in an hour
  }
  return BUSY_COOLDOWN_MS;
}

export function createGeminiClient(opts: GeminiOptions): AiClient {
  let generate = opts.generate;
  if (!generate) {
    if (!opts.apiKey) throw new Error("createGeminiClient: apiKey or generate is required");
    const ai = new GoogleGenAI({ apiKey: opts.apiKey });
    generate = (req) => ai.models.generateContent(req);
  }
  const gen = generate;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  // Thinking is on by default and makes simple jobs slow. Ask for the least the model accepts:
  // MINIMAL, else LOW, else the model's default. Remembered per model for the rest of the process.
  const levelIdx = new Map<string, number>();
  // A main model that just answered 503 / timed out is skipped (straight to the backup) for a while.
  const busyUntil = new Map<string, number>();
  const now = opts.now ?? Date.now;

  async function attempt(req: GenerateContentParameters): Promise<GenerateResult> {
    const withThinking = (level: ThinkingLevel | undefined): GenerateContentParameters =>
      level ? { ...req, config: { ...req.config, thinkingConfig: { thinkingLevel: level } } } : req;
    const once = async (level: ThinkingLevel | undefined) => {
      const started = Date.now();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new AiUnavailable("ai_error", `Gemini (${req.model}) timed out after ${timeoutMs} ms`)),
          timeoutMs,
        );
      });
      try {
        const res = await Promise.race([gen(withThinking(level)), timeout]);
        opts.onCall?.({ model: req.model, ms: Date.now() - started, thinking: level ?? "default", ok: true, finishReason: res.candidates?.[0]?.finishReason, usage: res.usageMetadata });
        return res;
      } catch (e) {
        opts.onCall?.({ model: req.model, ms: Date.now() - started, thinking: level ?? "default", ok: false, error: e instanceof Error ? e.message.slice(0, 200) : String(e) });
        throw e;
      } finally {
        clearTimeout(timer);
      }
    };
    for (;;) {
      const i = levelIdx.get(req.model) ?? 0;
      try {
        return await once(THINKING_LEVELS[i]);
      } catch (e) {
        if (i >= THINKING_LEVELS.length - 1 || !isThinkingConfigError(e)) throw e;
        levelIdx.set(req.model, i + 1); // try the next level up
      }
    }
  }

  async function call(req: GenerateContentParameters): Promise<string> {
    try {
      let res: GenerateResult;
      const backup = opts.fallbackModel && opts.fallbackModel !== req.model ? opts.fallbackModel : undefined;
      if (backup && (busyUntil.get(req.model) ?? 0) > now()) {
        res = await attempt({ ...req, model: backup });
      } else {
        try {
          res = await attempt(req);
        } catch (e) {
          if (!backup || !isBusy(e)) throw e;
          busyUntil.set(req.model, now() + cooldownFor(e));
          res = await attempt({ ...req, model: backup });
        }
      }
      const finish = res.candidates?.[0]?.finishReason;
      if (finish === "MAX_TOKENS") {
        throw new AiUnavailable("ai_error", `Gemini hit the output limit (thinking used ${res.usageMetadata?.thoughtsTokenCount ?? "?"} tokens)`);
      }
      const text = res.text?.trim();
      if (!text) throw new AiUnavailable("ai_error", `Gemini returned no text (finish: ${finish ?? "?"})`);
      return text;
    } catch (e) {
      if (e instanceof AiUnavailable) throw e;
      if (e instanceof ApiError && (e.status === 429 || e.status === 503)) {
        // 429 = our quota is used up; 503 = Google is overloaded. Either way: "busy", use the fallback.
        throw new AiUnavailable("rate_limited", `Gemini busy (HTTP ${e.status})`, { cause: e });
      }
      const status = e instanceof ApiError ? ` (HTTP ${e.status})` : "";
      throw new AiUnavailable("ai_error", `Gemini call failed${status}: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
    }
  }

  return {
    async parseIntent(message, history = []) {
      const turns = history.slice(-6).map((t) => `${t.role === "user" ? "User" : "B.AI"}: ${t.text}`);
      const contents = turns.length ? `Earlier turns:\n${turns.join("\n")}\n\nLatest message:\n${message}` : message;
      const text = await call({
        model: opts.model,
        contents,
        config: {
          systemInstruction: PARSE_SYSTEM,
          responseMimeType: "application/json",
          responseJsonSchema: RAW_INTENT_JSON_SCHEMA,
          temperature: 0,
          // Generous: on some models hidden thinking counts against this limit, and a cut-off
          // reply is broken JSON. The actual JSON is ~150 tokens.
          maxOutputTokens: 2048,
        },
      });
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new AiUnavailable("ai_error", `Gemini returned invalid JSON: ${text.slice(0, 200)}`);
      }
      const raw = RawIntentSchema.safeParse(json);
      if (!raw.success) throw new AiUnavailable("ai_error", `Gemini JSON didn't match the intent schema: ${text.slice(0, 200)}`);
      return toIntent(raw.data);
    },

    async writeAnswer(input) {
      return call({
        model: opts.model,
        contents: JSON.stringify(answerFacts(input)),
        config: { systemInstruction: ANSWER_SYSTEM, temperature: 0.3, maxOutputTokens: 2048 },
      });
    },
  };
}

let shared: AiClient | null | undefined;

/** Defaults chosen from the first real runs (docs/data-notes.md): lite is fast and has its own quota. */
export const DEFAULT_MODEL = "gemini-3.5-flash-lite";
export const DEFAULT_FALLBACK_MODEL = "gemini-3.8-flash";

/**
 * One client per server process from GEMINI_API_KEY / GEMINI_MODEL / GEMINI_FALLBACK_MODEL.
 * Null when there's no key. Set GEMINI_FALLBACK_MODEL to "none" to turn the backup model off.
 */
export function getAiClient(onCall?: (log: CallLog) => void): AiClient | null {
  if (shared === undefined) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
    const fallback = process.env.GEMINI_FALLBACK_MODEL?.trim() || (model === DEFAULT_MODEL ? DEFAULT_FALLBACK_MODEL : DEFAULT_MODEL);
    shared = apiKey
      ? createGeminiClient({
          apiKey,
          model,
          fallbackModel: fallback === "none" ? undefined : fallback,
          onCall,
        })
      : null;
  }
  return shared;
}
