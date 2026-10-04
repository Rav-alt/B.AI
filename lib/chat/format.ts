// Small text helpers shared by the templates and the AI facts.
import type { LegMode, Lang } from "@/lib/types";

/** "Taft Ave / Josefa Llanes Escoda Intersection, Manila" → "Taft Ave / Josefa Llanes Escoda". */
export function shortStop(name: string): string {
  const first = name.split(",")[0]!.trim();
  return first.replace(/\s+intersection$/i, "").replace(/\s+/g, " ") || name;
}

/** Round walking metres the way people say them: "mga 100 m", "mga 1.2 km". */
export function walkDistance(m: number): string {
  if (m < 1000) return `${Math.max(50, Math.round(m / 50) * 50)} m`;
  return `${(Math.round(m / 100) / 10).toFixed(1)} km`;
}

/** "mga 25 minuto" / "about 25 min"; long trips in hours. */
export function minutes(n: number, lang: Lang): string {
  const m = Math.max(1, Math.round(n / 5) * 5 || Math.round(n));
  if (m < 60) return lang === "en" ? `about ${m} min` : `mga ${m} minuto`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (lang === "en") return `about ${h} hr${r ? ` ${r} min` : ""}`;
  return `mga ${h} oras${r ? ` at ${r} minuto` : ""}`;
}

const MODE_WORD: Record<Lang, Record<Exclude<LegMode, "walk">, string>> = {
  fil: { jeep: "jeep", bus: "bus", uv: "UV Express", train: "tren" },
  en: { jeep: "jeepney", bus: "bus", uv: "UV Express", train: "train" },
};
export const modeWord = (mode: Exclude<LegMode, "walk">, lang: Lang) => MODE_WORD[lang][mode];

/** Guess the reply language when there's no AI: Tagalog words → Taglish, else English. Default Taglish. */
export function detectLang(text: string): Lang {
  if (!text.trim()) return "fil";
  const tl = /\b(ako|ko|nasa|sa|ng|papunta|papuntang|pupunta|galing|paano|saan|anong|ano|sasakyan|sumakay|po|yung|ba|mula|dito|lang)\b/i;
  return tl.test(text) ? "fil" : "en";
}

export const DISCLAIMER: Record<Lang, string> = {
  fil: "Paalala: Maaaring luma na ang ilang ruta sa data namin. Laging magtanong sa driver o barker bago sumakay.",
  en: "Note: Some routes in our data may be outdated. Always ask the driver or barker before you board.",
};
