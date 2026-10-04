// The flat shape Gemini fills in (simple JSON schema = fewer model mistakes), and its conversion to Intent.
import { z } from "zod";
import type { Intent, Lang, PlaceQuery, Prefs } from "@/lib/types";
import { normalizeText } from "@/lib/text";

/** What the model returns. Empty string = "not mentioned". Kept flat on purpose. */
export const RawIntentSchema = z.object({
  type: z.enum(["plan_trip", "check_routes", "need_more_info", "off_topic"]),
  origin: z.string().max(200).default(""),
  originIsCurrentLocation: z.boolean().default(false),
  destination: z.string().max(200).default(""),
  destinationIsCurrentLocation: z.boolean().default(false),
  candidates: z
    .array(z.object({ mode: z.enum(["bus", "jeep", "uv", "train", "any"]).default("any"), signboard: z.string().max(100) }))
    .max(5)
    .default([]),
  prefs: z
    .object({
      fewestTransfers: z.boolean().default(false),
      lessWalking: z.boolean().default(false),
      trainsOnly: z.boolean().default(false),
      avoidTrains: z.boolean().default(false),
    })
    .default({ fewestTransfers: false, lessWalking: false, trainsOnly: false, avoidTrains: false }),
  language: z.enum(["en", "tl", "taglish"]).default("taglish"),
});
export type RawIntent = z.infer<typeof RawIntentSchema>;

/**
 * The same shape as a JSON Schema for Gemini's `responseJsonSchema`. Hand-written with only basic
 * features (no anyOf / null), which every Gemini JSON mode supports.
 */
export const RAW_INTENT_JSON_SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["plan_trip", "check_routes", "need_more_info", "off_topic"] },
    origin: { type: "string", description: "Where the rider starts, as they said it. Empty if not said." },
    originIsCurrentLocation: { type: "boolean", description: "True if they say 'here', 'dito', 'my location'." },
    destination: { type: "string", description: "Where the rider wants to go, as they said it. Empty if not said." },
    destinationIsCurrentLocation: { type: "boolean" },
    candidates: {
      type: "array",
      description: "Only for check_routes: each named vehicle the rider is asking about.",
      items: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["bus", "jeep", "uv", "train", "any"] },
          signboard: { type: "string", description: "The place on the signboard, e.g. 'SM Fairview'." },
        },
        required: ["mode", "signboard"],
      },
    },
    prefs: {
      type: "object",
      properties: {
        fewestTransfers: { type: "boolean" },
        lessWalking: { type: "boolean" },
        trainsOnly: { type: "boolean" },
        avoidTrains: { type: "boolean" },
      },
      required: ["fewestTransfers", "lessWalking", "trainsOnly", "avoidTrains"],
    },
    language: { type: "string", enum: ["en", "tl", "taglish"] },
  },
  required: ["type", "origin", "originIsCurrentLocation", "destination", "destinationIsCurrentLocation", "candidates", "prefs", "language"],
} as const;

const place = (text: string, current: boolean): PlaceQuery | undefined =>
  current ? { useCurrentLocation: true } : text.trim() ? { text: text.trim() } : undefined;

export function toIntent(raw: RawIntent): { intent: Intent; lang: Lang } {
  const lang: Lang = raw.language === "en" ? "en" : "fil";
  if (raw.type === "off_topic") return { intent: { type: "off_topic" }, lang };

  const origin = place(raw.origin, raw.originIsCurrentLocation);
  const destination = place(raw.destination, raw.destinationIsCurrentLocation);
  const missing = [...(origin ? [] : (["origin"] as const)), ...(destination ? [] : (["destination"] as const))];
  if (raw.type === "need_more_info" || missing.length) {
    return { intent: { type: "need_more_info", missing: missing.length ? missing : ["origin", "destination"] }, lang };
  }

  const prefs: Prefs = Object.fromEntries(Object.entries(raw.prefs).filter(([, v]) => v));
  const candidates = raw.candidates
    .filter((c) => c.signboard.trim())
    .map((c) => ({ signboard: c.signboard.trim(), ...(c.mode !== "any" ? { mode: c.mode } : {}) }));
  // "May bus ba papuntang España?" when España is the destination is really "how do I get there?".
  const sameAsEnd = (sb: string) => [raw.destination, raw.origin].some((p) => normalizeText(p) === normalizeText(sb));
  if (raw.type === "check_routes" && candidates.length && !candidates.every((c) => sameAsEnd(c.signboard))) {
    return { intent: { type: "check_routes", origin: origin!, destination: destination!, candidates, prefs }, lang };
  }
  return { intent: { type: "plan_trip", origin: origin!, destination: destination!, prefs }, lang };
}
