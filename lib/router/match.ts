// Fuzzy signboard matching: "SM Fairview" → patterns whose signboard mentions Fairview.
import type { Candidate, Network, Pattern } from "@/lib/types";

/** Lowercase, strip accents (ñ → n), turn punctuation into spaces. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const tokens = (s: string | undefined): string[] => (s ? normalizeText(s).split(" ").filter(Boolean) : []);

/** Words in a question that aren't part of a place name. */
const STOPWORDS = new Set([
  "via", "to", "going", "papuntang", "papunta", "pa", "bus", "jeep", "jeepney", "jip", "dyip", "uv", "express",
  "train", "the", "ng", "sa", "na", "route", "signboard", "from", "galing", "yung", "ang", "or", "o",
]);
/** Words that help rank but aren't required ("Fairview" bus still counts for "SM Fairview"). */
const WEAK = new Set(["sm", "city", "terminal", "ave", "avenue", "st", "street", "rd", "road", "blvd", "ext", "extension"]);

/** Optimal-string-alignment distance (Levenshtein + adjacent swaps), stopping early above `max`. */
function osa(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  }
  return d[a.length]![b.length]!;
}

/** Does query word `q` match signboard word `t`? Exact, a prefix (≥4 letters), or one typo (≥5 letters). */
export function wordMatches(q: string, t: string): boolean {
  if (q === t) return true;
  if (/^\d+$/.test(q) || /^\d+$/.test(t)) return false; // "1" must not match "2"
  if (q.length >= 4 && t.startsWith(q)) return true;
  return q.length >= 5 && t.length >= 5 && osa(q, t, 1) <= 1;
}

function splitRaw(raw: string): [main: string, via: string] {
  const m = /\bvia\b/i.exec(raw);
  return m ? [raw.slice(0, m.index), raw.slice(m.index + 3)] : [raw, ""];
}

interface Haystack {
  main: string[];
  via: string[];
  towards: string[];
}

function haystack(p: Pattern): Haystack {
  const [rawMain, rawVia] = splitRaw(p.rawName);
  return {
    main: [...tokens(p.name), ...tokens(p.endpoints?.join(" ")), ...tokens(p.line), ...tokens(rawMain)],
    via: [...tokens(p.via), ...tokens(rawVia)],
    towards: tokens(p.towards),
  };
}

const hayCache = new WeakMap<Network, Haystack[]>();
function haystacks(net: Network): Haystack[] {
  let h = hayCache.get(net);
  if (!h) {
    h = net.patterns.map(haystack);
    hayCache.set(net, h);
  }
  return h;
}

const hasAll = (qs: string[], hay: string[]) => qs.every((q) => hay.some((t) => wordMatches(q, t)));
const countIn = (qs: string[], hay: string[]) => qs.filter((q) => hay.some((t) => wordMatches(q, t))).length;

/**
 * Pattern indices whose signboard matches the candidate, best first.
 * Signboard ends ("A – B") are tried first; the "via" part only when nothing matched the ends.
 */
export function matchSignboard(net: Network, cand: Candidate): number[] {
  const words = tokens(cand.signboard).filter((w) => !STOPWORDS.has(w));
  let strong = words.filter((w) => !WEAK.has(w));
  const weak = words.filter((w) => WEAK.has(w));
  if (strong.length === 0) strong = weak;
  if (strong.length === 0) return [];

  const hays = haystacks(net);
  const modeOk = (p: Pattern) => !cand.mode || p.mode === cand.mode;

  for (const tier of ["main", "via"] as const) {
    const hits: { i: number; score: number }[] = [];
    net.patterns.forEach((p, i) => {
      if (!modeOk(p)) return;
      const h = hays[i]!;
      const hay = tier === "main" ? h.main : [...h.main, ...h.via];
      if (!hasAll(strong, hay)) return;
      // rank: more of the weak words, then "heads towards what was asked"
      const score = countIn(weak, hay) * 10 + (countIn(strong, h.towards) > 0 ? 5 : 0);
      hits.push({ i, score });
    });
    if (hits.length) return hits.sort((a, b) => b.score - a.score || a.i - b.i).map((h) => h.i);
  }
  return [];
}
