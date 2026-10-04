// Working out which way a road route is heading ("papuntang B") when the feed has no direction info.
//
// Idea: the signboard names two places, "A – B". Find stops whose names mention A and B. If the
// pattern's last stop is near the B-stops (and its first stop near the A-stops), it heads to B.
// This is best effort: when the evidence is weak we leave `towards` empty instead of guessing.
import { haversineM } from "@/lib/geo/haversine";
import { normalizeForMatch } from "./names";

type Pt = { lat: number; lon: number };
type IndexedStop = Pt & { norm: string };

/** Words too common to identify a place on their own. */
const GENERIC = new Set([
  "ave", "avenue", "road", "rd", "st", "street", "blvd", "boulevard", "highway", "hwy", "market", "terminal",
  "city", "village", "homes", "subd", "via", "north", "south", "east", "west", "san", "santa", "sta", "sto",
  "de", "del", "la", "las", "los", "pier", "plaza", "proper", "ext", "extension", "project", "palengke",
  "bayan", "new", "old", "national", "circle", "loop", "station", "bus", "jeep", "main", "gate",
]);

/** Score limits, in metres. */
const MAX_SCORE_M = 4000; // first-stop gap + last-stop gap must be under this
const MIN_MARGIN_M = 1000; // and clearly better than the opposite orientation
const LOPSIDED_MAX_M = 10_000; // a looser limit, allowed only when…
const LOPSIDED_RATIO = 3; // …the opposite orientation is at least 3× worse
const ONE_SIDE_MAX_M = 2000;
const ONE_SIDE_MARGIN_M = 1500;

export class PlaceMatcher {
  private readonly index: IndexedStop[];
  private readonly cache = new Map<string, Pt[]>();

  constructor(stops: Array<Pt & { name: string }>) {
    // Feed stop names end with the city ("Taft Ave / Pedro Gil, Manila"). Drop that part, or every stop
    // in Pasay would "match" a Pasay signboard.
    const place = (name: string) => (name.includes(",") ? name.slice(0, name.lastIndexOf(",")) : name);
    this.index = stops.map((s) => ({ lat: s.lat, lon: s.lon, norm: ` ${normalizeForMatch(place(s.name))} ` }));
  }

  /** Stops whose names contain the phrase (whole words). Falls back to its most distinctive word. */
  stopsMatching(phrase: string): Pt[] {
    const key = normalizeForMatch(phrase);
    const hit = this.cache.get(key);
    if (hit) return hit;
    let found: Pt[] = [];
    if (key) {
      found = this.index.filter((s) => s.norm.includes(` ${key} `));
      if (found.length === 0) {
        const word = key
          .split(" ")
          .filter((w) => w.length >= 4 && !GENERIC.has(w) && !/^\d+$/.test(w))
          .sort((a, b) => b.length - a.length)[0];
        if (word && word !== key) found = this.index.filter((s) => s.norm.includes(` ${word} `));
      }
    }
    this.cache.set(key, found);
    return found;
  }
}

function minDist(p: Pt, pts: Pt[]): number {
  let best = Infinity;
  for (const q of pts) best = Math.min(best, haversineM(p.lat, p.lon, q.lat, q.lon));
  return best;
}

export type Orientation = { towards: 0 | 1; score: number };

/**
 * Decide whether a pattern from `first` to `last` runs endpoint 0 → 1 (`towards: 1`) or 1 → 0.
 * Returns undefined when the evidence is weak.
 */
export function orient(matcher: PlaceMatcher, first: Pt, last: Pt, ends: [string, string]): Orientation | undefined {
  const a = matcher.stopsMatching(ends[0]);
  const b = matcher.stopsMatching(ends[1]);

  if (a.length && b.length) {
    const ab = minDist(first, a) + minDist(last, b);
    const ba = minDist(first, b) + minDist(last, a);
    const score = Math.min(ab, ba);
    const other = Math.max(ab, ba);
    const closeAndClear = score < MAX_SCORE_M && other - score > MIN_MARGIN_M;
    // Some feed routes stop short of their signboard ends. Still accept when one way round is
    // several times better than the other.
    const shortButLopsided = score < LOPSIDED_MAX_M && other >= LOPSIDED_RATIO * score;
    if (closeAndClear || shortButLopsided) return { towards: ab < ba ? 1 : 0, score };
    return undefined;
  }

  // Only one end can be found: use it alone, with stricter limits.
  const [known, idx] = a.length ? [a, 0 as const] : b.length ? [b, 1 as const] : [null, 0 as const];
  if (!known) return undefined;
  const dFirst = minDist(first, known);
  const dLast = minDist(last, known);
  if (Math.min(dFirst, dLast) < ONE_SIDE_MAX_M && Math.abs(dFirst - dLast) > ONE_SIDE_MARGIN_M) {
    const endsAtKnown = dLast < dFirst;
    const towards = (endsAtKnown ? idx : 1 - idx) as 0 | 1;
    return { towards, score: Math.min(dFirst, dLast) };
  }
  return undefined;
}

/**
 * For names with no separator ("Alabang Fairview"), try every split of the words into two places
 * and keep the split whose two halves best match the pattern's first and last stops.
 */
export function guessSplit(
  matcher: PlaceMatcher,
  words: string[],
  first: Pt,
  last: Pt,
): { ends: [string, string]; towards: 0 | 1 } | undefined {
  let best: { ends: [string, string]; towards: 0 | 1; score: number } | undefined;
  for (let k = 1; k < words.length; k++) {
    const ends: [string, string] = [words.slice(0, k).join(" "), words.slice(k).join(" ")];
    // Both halves must be findable; a one-sided match is too weak to also justify the split.
    if (!matcher.stopsMatching(ends[0]).length || !matcher.stopsMatching(ends[1]).length) continue;
    const o = orient(matcher, first, last, ends);
    if (o && (!best || o.score < best.score)) best = { ends, towards: o.towards, score: o.score };
  }
  return best && { ends: best.ends, towards: best.towards };
}
