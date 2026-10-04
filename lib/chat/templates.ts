// Plain-text answers written by code, not AI. Used when Gemini is off, busy or wrong, and for the
// short replies (questions back, off-topic) that don't need AI at all.
import type { CheckReason, CheckResult, GeoPlace, Itinerary, Lang, PlanResult } from "@/lib/types";
import { minutes, modeWord, shortStop, walkDistance } from "./format";

const b = (s: string) => `**${s}**`;

function rideLabel(l: Exclude<Itinerary["legs"][number], { mode: "walk" }>, lang: Lang): string {
  const towards = l.towards ? (lang === "en" ? ` (to ${l.towards})` : ` (papuntang ${l.towards})`) : "";
  if (l.mode === "train") return `${b(l.line ?? l.routeName)}${towards}`;
  return lang === "en" ? `the ${modeWord(l.mode, lang)} ${b(l.routeName)}${towards}` : `${modeWord(l.mode, lang)} na ${b(l.routeName)}${towards}`;
}

/** Numbered steps for one itinerary. */
export function steps(it: Itinerary, destination: GeoPlace, lang: Lang): string[] {
  const out: string[] = [];
  it.legs.forEach((l, k) => {
    if (l.mode === "walk") {
      const isLast = k === it.legs.length - 1;
      const to = isLast ? destination.name : shortStop(l.to.name);
      out.push(lang === "en" ? `Walk about ${walkDistance(l.meters)} to ${to}.` : `Maglakad ng mga ${walkDistance(l.meters)} papunta sa ${to}.`);
      return;
    }
    const board = shortStop(l.boardStop.name);
    const alight = shortStop(l.alightStop.name);
    out.push(lang === "en" ? `At ${board}, take ${rideLabel(l, lang)}.` : `Sa ${board}, sumakay ng ${rideLabel(l, lang)}.`);
    out.push(lang === "en" ? `Get off at ${alight}.` : `Baba sa ${alight}.`);
  });
  return out.map((s, i) => `${i + 1}. ${s}`);
}

/** "jeep **A** + bus **B**" for the one-line "other options". */
function summary(it: Itinerary, lang: Lang): string {
  const rides = it.legs.flatMap((l) => (l.mode === "walk" ? [] : [l.mode === "train" ? b(l.line ?? l.routeName) : `${modeWord(l.mode, lang)} ${b(l.routeName)}`]));
  return rides.length ? rides.join(" + ") : lang === "en" ? "walk" : "lakad";
}

function noRouteText(plan: PlanResult, origin: GeoPlace, destination: GeoPlace, lang: Lang): string {
  const ask = lang === "en" ? " Try asking a barker or fellow commuters nearby." : " Subukang magtanong sa barker o sa mga kapwa commuter.";
  switch (plan.status) {
    case "no_stops_near_origin":
      return (lang === "en" ? `I don't have any jeep, bus or train stop within walking distance of ${b(origin.name)} in our data.` : `Walang jeep, bus o train stop na malapit-lapit sa ${b(origin.name)} sa data namin.`) + ask;
    case "no_stops_near_destination":
      return (lang === "en" ? `I don't have any stop within walking distance of ${b(destination.name)} in our data.` : `Walang stop na malapit-lapit sa ${b(destination.name)} sa data namin.`) + ask;
    default:
      return (lang === "en" ? `I couldn't find a route from ${b(origin.name)} to ${b(destination.name)} in our data (up to 2 transfers).` : `Wala akong nakitang ruta mula ${b(origin.name)} papuntang ${b(destination.name)} sa data namin (hanggang 2 lipat).`) + ask;
  }
}

export function planText(plan: PlanResult, origin: GeoPlace, destination: GeoPlace, lang: Lang): string {
  const [best, ...others] = plan.itineraries;
  if (plan.status !== "ok" || !best) return noRouteText(plan, origin, destination, lang);
  const head = lang === "en"
    ? `From ${b(origin.name)} to ${b(destination.name)}, ${minutes(best.totalMinutes, lang)}:`
    : `Mula ${b(origin.name)} papuntang ${b(destination.name)}, ${minutes(best.totalMinutes, lang)}:`;
  const lines = [head, ...steps(best, destination, lang)];
  if (others.length) {
    lines.push("", lang === "en" ? "Other options:" : "Ibang paraan:");
    for (const it of others) lines.push(`- ${summary(it, lang)}, ${minutes(it.totalMinutes, lang)}`);
  }
  return lines.join("\n");
}

function reasonText(r: CheckReason, origin: GeoPlace, destination: GeoPlace, lang: Lang): string {
  const o = origin.name;
  const d = destination.name;
  const fil: Record<CheckReason, string> = {
    passes_both: `oo, dumadaan malapit sa ${o} at umaabot sa ${d}.`,
    wrong_direction: `hindi, kabilang direksyon ang punta niyan.`,
    ride_too_short: `hindi na sulit, mas malapit lang kung lalakarin.`,
    origin_only: `hindi, dumadaan malapit sa ${o} pero hindi umaabot sa ${d}.`,
    destination_only: `hindi, umaabot sa ${d} pero hindi dumadaan malapit sa ${o}.`,
    passes_neither: `hindi, hindi dumadaan malapit sa ${o} o sa ${d}.`,
    no_such_route: `wala akong ganyang ruta sa data namin.`,
  };
  const en: Record<CheckReason, string> = {
    passes_both: `yes, it passes near ${o} and reaches ${d}.`,
    wrong_direction: `no, that one goes the other way.`,
    ride_too_short: `no, the ride would be too short to be worth it; walking is about as quick.`,
    origin_only: `no, it passes near ${o} but doesn't reach ${d}.`,
    destination_only: `no, it reaches ${d} but doesn't pass near ${o}.`,
    passes_neither: `no, it doesn't pass near ${o} or ${d}.`,
    no_such_route: `I don't have a route with that signboard in our data.`,
  };
  return (lang === "en" ? en : fil)[r];
}

export function checkText(check: CheckResult, origin: GeoPlace, destination: GeoPlace, lang: Lang): string {
  const lines: string[] = [];
  for (const v of check.verdicts) {
    const what = `${v.candidate.mode ? `${modeWord(v.candidate.mode, lang)} ` : ""}${b(v.candidate.signboard)}`;
    lines.push(`- ${what}: ${reasonText(v.reason, origin, destination, lang)}`);
  }
  const yes = check.verdicts.find((v) => v.verdict === "yes" && v.itinerary);
  if (yes?.itinerary) {
    lines.push("", lang === "en" ? `How (${minutes(yes.itinerary.totalMinutes, lang)}):` : `Paano (${minutes(yes.itinerary.totalMinutes, lang)}):`);
    lines.push(...steps(yes.itinerary, destination, lang));
  } else if (check.alternative) {
    lines.push("", lang === "en" ? "Try this instead:" : "Subukan ito:");
    lines.push(planText(check.alternative, origin, destination, lang));
  }
  return lines.join("\n");
}

export const offTopicText = (lang: Lang) =>
  lang === "en"
    ? "Sorry, I can only help with routes: how to get from one place to another in Metro Manila, or which jeep or bus to take. Where are you headed?"
    : "Pasensya na, ruta lang ang kaya kong sagutin: kung paano pumunta mula sa isang lugar papunta sa iba sa Metro Manila, o kung aling jeep o bus ang sasakyan. Saan ka papunta?";

export function needMoreInfoText(missing: ("origin" | "destination")[], lang: Lang): string {
  const both = missing.includes("origin") && missing.includes("destination");
  if (lang === "en") {
    if (both) return 'Where are you starting from, and where are you going? For example: "Pedro Gil Taft to España".';
    return missing.includes("destination") ? "Where are you going?" : "Where are you starting from?";
  }
  if (both) return 'Saan ka manggagaling at saan ka papunta? Halimbawa: "Pedro Gil Taft papuntang España".';
  return missing.includes("destination") ? "Saan ka papunta?" : "Saan ka manggagaling?";
}

export function askPlaceText(field: "origin" | "destination", query: string, options: GeoPlace[], lang: Lang): string {
  const which = field === "origin" ? (lang === "en" ? "starting point" : "pinanggalingan mo") : lang === "en" ? "destination" : "pupuntahan mo";
  const broad = options.length >= 5 && options.every((o) => o.source === "stop");
  const head = broad
    ? lang === "en"
      ? `"${query}" is a big area. Which spot is your ${which}? Pick one, or type a landmark or corner there.`
      : `Malawak ang "${query}". Saan banda ang ${which}? Pumili, o mag-type ng landmark o kanto doon.`
    : lang === "en"
      ? `Which "${query}" is your ${which}?`
      : `Alin dito ang ${which}?`;
  const label = (o: GeoPlace) => (o.area && !o.name.includes(o.area) ? `${o.name} (${o.area})` : o.name);
  return [head, ...options.map((o, i) => `${i + 1}. ${label(o)}`)].join("\n");
}

export function placeNotFoundText(query: string, outside: boolean, lang: Lang): string {
  if (outside) {
    return lang === "en"
      ? `"${query}" looks like it's outside Metro Manila. I only cover Metro Manila for now.`
      : `Mukhang nasa labas ng Metro Manila ang "${query}". Metro Manila lang ang sakop ko sa ngayon.`;
  }
  return lang === "en"
    ? `I couldn't find "${query}". Try a well-known place nearby: a station, mall, school or major corner.`
    : `Hindi ko mahanap ang "${query}". Subukan ang kilalang lugar malapit doon: istasyon, mall, school o malaking kanto.`;
}

export const needLocationText = (lang: Lang) =>
  lang === "en"
    ? 'Tap "Use my location" so I know where you are, or type the place.'
    : 'Pindutin ang "Gamitin ang lokasyon ko" para malaman ko kung nasaan ka, o i-type ang lugar.';

export const fallbackFormText = (lang: Lang) =>
  lang === "en"
    ? "My AI helper is busy right now. Type where you're starting from and where you're going in the boxes below, and I'll still find you a route."
    : "Medyo busy ang AI ko ngayon. Ilagay mo na lang kung saan ka manggagaling at saan ka papunta sa mga box sa ibaba, hahanapan pa rin kita ng ruta.";
