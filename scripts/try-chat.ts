// Runs the full /api/chat pipeline in the terminal, with real Gemini and Nominatim if configured.
//   npm run try:chat -- "Nasa Pedro Gil Taft ako, papuntang España"
//   npm run try:chat -- --no-ai "Cubao to Ayala"       (template only, like the fallback)
// Reads GEMINI_API_KEY / GEMINI_MODEL / NOMINATIM_CONTACT from .env.local.
import { loadNetwork } from "@/lib/router/network";
import { loadLandmarks } from "@/lib/geo/landmarks";
import { getNominatim } from "@/lib/geo/nominatim";
import { DEFAULT_FALLBACK_MODEL, DEFAULT_MODEL, getAiClient } from "@/lib/ai/gemini";
import { handleChat } from "@/lib/chat/pipeline";
import { ChatRequestSchema } from "@/lib/types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: AI and Nominatim stay off
}

async function main() {
  const args = process.argv.slice(2);
  const noAi = args.includes("--no-ai");
  const messages = args.filter((a) => a !== "--no-ai");
  if (messages.length === 0) {
    messages.push(
      "Nasa Pedro Gil Taft ako, papuntang España. Anong bus o jeep ang sasakyan ko?",
      "Galing Pedro Gil Taft papuntang España, bus papuntang SM Fairview o jeep papuntang Divisoria?",
      "How do I get from Cubao to Ayala?",
      "Buendia to UST",
      "What's the weather?",
    );
  }
  const errors: string[] = [];
  const calls: string[] = [];
  const deps = {
    net: loadNetwork(),
    landmarks: loadLandmarks(),
    nominatim: getNominatim(),
    ai: noAi
      ? null
      : getAiClient((c) => {
          const u = c.usage ? ` · tokens in ${c.usage.promptTokenCount ?? "?"} / out ${c.usage.candidatesTokenCount ?? "?"} / thinking ${c.usage.thoughtsTokenCount ?? 0}` : "";
          calls.push(`  · ${c.model} ${c.ok ? "ok" : "FAILED"} ${c.ms} ms (thinking ${c.thinking.toLowerCase()})${c.finishReason ? ` · ${c.finishReason}` : ""}${u}${c.error ? ` · ${c.error}` : ""}`);
        }),
    onAiError: (stage: string, e: unknown) => {
      const cause = e instanceof Error && e.cause instanceof Error ? `\n      cause: ${e.cause.message}` : "";
      errors.push(`  ! AI ${stage} failed: ${e instanceof Error ? e.message : String(e)}${cause}`);
    },
  };
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const fallback = process.env.GEMINI_FALLBACK_MODEL || (model === DEFAULT_MODEL ? DEFAULT_FALLBACK_MODEL : DEFAULT_MODEL);
  console.log(`AI: ${deps.ai ? `${model} (backup: ${fallback})` : "off"} · Nominatim: ${deps.nominatim ? "on" : "off"}\n`);
  for (const message of messages) {
    const t0 = Date.now();
    errors.length = 0;
    calls.length = 0;
    const r = await handleChat(ChatRequestSchema.parse({ message }), deps);
    console.log(`> ${message}`);
    for (const c of calls) console.log(c);
    for (const e of errors) console.log(e);
    console.log(`[${r.kind} · ${r.writer}${r.fallbackReason ? ` (${r.fallbackReason})` : ""} · ${Date.now() - t0} ms]`);
    console.log(r.text);
    if (r.disclaimer) console.log(`\n${r.disclaimer}`);
    console.log("");
  }
}

void main();
