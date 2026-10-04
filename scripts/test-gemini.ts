// Phase 0.4: make ONE test call to the Gemini free tier and print what came back.
// Setup:  copy .env.example to .env.local, fill GEMINI_API_KEY and GEMINI_MODEL.
// Run:    npm run test:gemini
import { ApiError, GoogleGenAI } from "@google/genai";

try {
  process.loadEnvFile(".env.local"); // Node 21.7+: reads KEY=value lines into process.env
} catch {
  // no .env.local — fall back to variables already set in the shell
}

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

if (!apiKey) {
  console.error("GEMINI_API_KEY is empty. Put it in .env.local (see .env.example).");
  process.exit(1);
}

async function main(key: string): Promise<void> {
  const ai = new GoogleGenAI({ apiKey: key });
  const started = Date.now();

  try {
    const res = await ai.models.generateContent({
      model,
      contents: "Reply with one short Taglish sentence greeting a commuter in Manila.",
    });
    console.log(`model:   ${model}`);
    console.log(`latency: ${Date.now() - started} ms`);
    console.log(`reply:   ${res.text}`);
    console.log(`tokens:  ${JSON.stringify(res.usageMetadata)}`);
    console.log("\nOK. Now open https://aistudio.google.com/rate-limit and copy this model's");
    console.log("free-tier RPM / TPM / RPD into docs/data-notes.md (section 'Gemini free tier').");
  } catch (err) {
    if (err instanceof ApiError) {
      console.error(`Gemini API error ${err.status}: ${err.message}`);
      if (err.status === 404) console.error("The model ID may be wrong or retired — check https://ai.google.dev/gemini-api/docs/models");
      if (err.status === 429) console.error("Rate limited (429). This is the case the Phase 4 fallback must handle.");
    } else {
      console.error(err);
    }
    process.exit(1);
  }
}

void main(apiKey);
