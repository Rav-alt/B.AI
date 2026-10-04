// Pure helpers that turn router legs into what the UI shows (labels, meta lines, legend).
// No React here, so they're unit-tested in node and safe for the client bundle.
import type { Itinerary, Lang, Leg, LegMode, Mode } from "@/lib/types";
import { shortMinutes, shortStop, walkDistance } from "@/lib/chat/format";
import { transfersText } from "@/lib/chat/templates";

export type RideLegView = Exclude<Leg, { mode: "walk" }>;
export type WalkLegView = Extract<Leg, { mode: "walk" }>;

export const isRide = (l: Leg): l is RideLegView => l.mode !== "walk";

/** Pick the Tagalog or English string. */
export const tr = (lang: Lang, fil: string, en: string) => (lang === "en" ? en : fil);

/** Badge text: the train line ("LRT-1"), else BUS / JEEP / UV / LAKAD. */
export function badgeLabel(leg: Leg, lang: Lang): string {
  if (leg.mode === "walk") return tr(lang, "LAKAD", "WALK");
  if (leg.mode === "train") return leg.line ?? tr(lang, "TREN", "TRAIN");
  return leg.mode === "uv" ? "UV" : leg.mode.toUpperCase();
}

/** Mono meta line under a step: "4 stations · ~10 min", "2.4 km · ~20 min", "300 m · ~5 min". */
export function legMeta(leg: Leg, lang: Lang): string {
  if (leg.mode === "walk") return `${walkDistance(leg.meters)} · ~${shortMinutes(leg.estMinutes)}`;
  if (leg.mode === "train") {
    const n = leg.stopCount;
    return `${n} ${tr(lang, n === 1 ? "istasyon" : "istasyon", n === 1 ? "station" : "stations")} · ~${shortMinutes(leg.estMinutes)}`;
  }
  return `${leg.distanceKm.toFixed(1)} km · ~${shortMinutes(leg.estMinutes)}`;
}

/** "Kabuuan" row: "~22 min · walang transfer · 450 m lakad". */
export function totalSummary(it: Itinerary, lang: Lang): string {
  const walk = it.walkMeters > 0 ? ` · ${walkDistance(it.walkMeters)} ${tr(lang, "lakad", "walk")}` : "";
  return `~${shortMinutes(it.totalMinutes)} · ${transfersText(it.transfers, lang)}${walk}`;
}

/** Lead for an option other than the first: "Option 2: mga 25 min, isang transfer." */
export function optionLead(it: Itinerary, index: number, lang: Lang): string {
  return tr(
    lang,
    `Option ${index + 1}: mga **${shortMinutes(it.totalMinutes)}**, ${transfersText(it.transfers, lang)}.`,
    `Option ${index + 1}: about **${shortMinutes(it.totalMinutes)}**, ${transfersText(it.transfers, lang)}.`,
  );
}

/** Short label for an "Iba pang paraan" button: the signboards / lines, joined. */
export function optionLabel(it: Itinerary, lang: Lang): string {
  const rides = it.legs.filter(isRide).map((l) => (l.mode === "train" ? (l.line ?? l.routeName) : l.routeName));
  return rides.length ? rides.join(" + ") : tr(lang, "Lakad lang", "Just walk");
}

export interface LegendItem {
  mode: LegMode;
  label: string;
}

/** One legend entry per distinct mode/line in the itinerary, in riding order. */
export function legendItems(it: Itinerary, lang: Lang): LegendItem[] {
  const seen = new Set<string>();
  const out: LegendItem[] = [];
  for (const l of it.legs) {
    const label =
      l.mode === "walk" ? tr(lang, "Lakad", "Walk") : l.mode === "train" ? (l.line ?? "Train") : l.mode === "uv" ? "UV" : l.mode === "bus" ? "Bus" : "Jeep";
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ mode: l.mode, label });
  }
  return out;
}

/** Where a step happens, short: "Taft Ave / Josefa Llanes Escoda". */
export const stopLabel = (name: string) => shortStop(name);

/** CSS variable for a mode's color (DESIGN.md: never hard-code a second copy of the hex). */
export const modeVar = (mode: LegMode) => `var(--mode-${mode})`;

/** Read a color token from the CSS variables at runtime (Leaflet needs real values, not var()). */
export function cssVar(name: string): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
export const modeColor = (mode: LegMode | Mode): string => cssVar(`--mode-${mode}`);
