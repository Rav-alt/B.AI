// Guard for AI answers: the text may only name routes the router returned, and must name the best one.
// (Acceptance test: "The answer text contains no route name absent from the router result".)
import type { CheckResult, Itinerary, Network, PlanResult } from "@/lib/types";
import { normalizeText } from "@/lib/text";

const pad = (s: string) => ` ${normalizeText(s)} `;

/** Network names worth checking for: long enough that they won't appear in normal words by accident. */
const namesCache = new WeakMap<Network, string[]>();
function networkNames(net: Network): string[] {
  let names = namesCache.get(net);
  if (!names) {
    const all = new Set<string>();
    for (const p of net.patterns) {
      all.add(normalizeText(p.name));
      if (p.line) all.add(normalizeText(p.line));
    }
    names = [...all].filter((n) => n.length >= 8 && n.includes(" "));
    namesCache.set(net, names);
  }
  return names;
}

function rideNames(it: Itinerary | undefined): string[] {
  return (it?.legs ?? []).flatMap((l) => (l.mode === "walk" ? [] : [l.routeName, ...(l.line ? [l.line] : [])]));
}

/** Every route name the answer is allowed to mention. */
export function allowedNames(r: { plan?: PlanResult; check?: CheckResult }): string[] {
  const out: string[] = [];
  for (const it of r.plan?.itineraries ?? []) out.push(...rideNames(it));
  for (const v of r.check?.verdicts ?? []) {
    out.push(v.candidate.signboard, ...v.matchedRoutes.map((m) => m.routeName), ...rideNames(v.itinerary));
  }
  for (const it of r.check?.alternative?.itineraries ?? []) out.push(...rideNames(it));
  return out;
}

/** Names the answer must contain: the rides of the best option (a train leg may be named by its line). */
export function requiredRides(r: { plan?: PlanResult; check?: CheckResult }): string[][] {
  const yes = r.check?.verdicts.find((v) => v.itinerary)?.itinerary;
  const best = r.plan?.itineraries[0] ?? yes ?? r.check?.alternative?.itineraries[0];
  return (best?.legs ?? []).flatMap((l) => (l.mode === "walk" ? [] : [[l.routeName, ...(l.line ? [l.line] : [])]]));
}

export interface NameCheck {
  ok: boolean;
  /** Route names in the text that the router didn't return. */
  unknown: string[];
  /** Rides of the best option that the text left out. */
  missing: string[];
}

export function checkAnswerNames(text: string, net: Network, r: { plan?: PlanResult; check?: CheckResult }): NameCheck {
  const body = pad(text);
  const allowed = allowedNames(r).map(normalizeText).filter(Boolean);
  // Blank out allowed names first, so "Project 6 Vito Cruz" can't hide a shorter network name inside it.
  let rest = body;
  for (const a of [...allowed].sort((x, y) => y.length - x.length)) rest = rest.split(` ${a} `).join("  |  ");
  const unknown = networkNames(net).filter((n) => rest.includes(` ${n} `) && !allowed.includes(n));
  const missing = requiredRides(r)
    .filter((alts) => !alts.some((a) => body.includes(pad(a))))
    .map((alts) => alts[0]!);
  return { ok: unknown.length === 0 && missing.length === 0, unknown, missing };
}
