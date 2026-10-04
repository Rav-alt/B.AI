// Text helpers shared by signboard matching (lib/router) and place matching (lib/geo).

/** Lowercase, strip accents (ñ → n), turn punctuation into spaces. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const tokens = (s: string | undefined): string[] => (s ? normalizeText(s).split(" ").filter(Boolean) : []);

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
