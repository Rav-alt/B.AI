// POST /api/chat — the whole B.AI pipeline behind one endpoint. See lib/chat/pipeline.ts.
import { ChatRequestSchema } from "@/lib/types";
import { handleChat } from "@/lib/chat/pipeline";
import { createRateLimiter } from "@/lib/chat/ratelimit";
import { loadNetwork } from "@/lib/router/network";
import { loadLandmarks } from "@/lib/geo/landmarks";
import { getNominatim } from "@/lib/geo/nominatim";
import { getAiClient } from "@/lib/ai/gemini";

// Two Gemini calls + maybe one Nominatim call (≤ 1 s queue) fit comfortably.
export const maxDuration = 30;

/** 10 questions per minute per visitor. */
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

const error = (status: number, code: string, message: string) => Response.json({ error: code, message }, { status });

export async function POST(request: Request): Promise<Response> {
  const visitor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!limiter.allow(visitor)) {
    return error(429, "rate_limited", "Sandali lang, ang dami mong tanong. Subukan ulit after a minute.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "bad_request", "Expected a JSON body.");
  }
  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return error(400, "bad_request", parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  }

  try {
    const response = await handleChat(parsed.data, {
      net: loadNetwork(),
      landmarks: loadLandmarks(),
      nominatim: getNominatim(),
      ai: getAiClient(),
      onAiError: (stage, e) => console.warn(`[api/chat] AI ${stage} failed:`, e instanceof Error ? e.message : e),
      onSearchError: (q, e) => console.warn(`[api/chat] Nominatim failed for "${q}":`, e instanceof Error ? e.message : e),
      onPlaceNotFound: (q, reason) => console.info(`[api/chat] place not found (${reason}): "${q}"`),
    });
    return Response.json(response);
  } catch (e) {
    console.error("[api/chat]", e);
    return error(500, "server_error", "May error sa server. Subukan ulit.");
  }
}
