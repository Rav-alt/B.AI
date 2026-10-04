// A small rule-based reader for the most common question shapes, used only when Gemini is off or
// busy: "Pedro Gil Taft to España", "galing Cubao papuntang Makati", "nasa UST ako, papuntang MOA".
// Anything fancier gets the From/To form instead.

export interface SimpleTrip {
  origin: string;
  destination: string;
}

const LEAD = /^(?:paano\s+(?:po\s+)?(?:pumunta|magpunta|makarating|makapunta)|how\s+(?:do\s+i|to|can\s+i)\s+(?:get|go)|route)\b\s*/i;
/** A place name ends at the first comma or sentence end: "España, bus papuntang …?" → "España". */
const TAIL = /\s*(?:[,?.!;]|\b(?:anong|ano ang|what|which)\s+(?:bus|jeep|sasakyan|ride|train)).*$/i;

const PATTERNS: RegExp[] = [
  /^(?:from|galing(?:\s+(?:sa|ng))?|mula(?:\s+(?:sa|ng))?)\s+(.+?)\s*,?\s+(?:to|papuntang|papunta\s+(?:sa|ng)|papunta|pupunta\s+(?:sa|ng)|hanggang(?:\s+sa)?)\s+(.+)$/i,
  /^(?:nasa|andito\s+ako\s+sa|nandito\s+ako\s+sa|i'?m\s+at|i\s+am\s+at)\s+(.+?)(?:\s+ako)?\s*,?\s+(?:and\s+)?(?:papuntang|papunta\s+(?:sa|ng)|papunta|pupunta\s+(?:sa|ng)|going\s+to|to)\s+(.+)$/i,
  /^(.+?)\s*(?:→|->|\bto\b|\bpapuntang\b|\bhanggang\b)\s*(.+)$/i,
];

const clean = (s: string) => s.replace(/^(?:the|sa|ng)\s+/i, "").replace(/\s+ako$/i, "").replace(/\s+/g, " ").trim();

export function simpleParse(message: string): SimpleTrip | null {
  const text = message.trim().replace(LEAD, "").replace(/^(?:from\s+)?/i, (m) => m);
  for (const re of PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    const origin = clean(m[1]!.replace(TAIL, ""));
    const destination = clean(m[2]!.replace(TAIL, ""));
    if (origin && destination && origin.length <= 80 && destination.length <= 80 && origin.toLowerCase() !== destination.toLowerCase()) {
      return { origin, destination };
    }
  }
  return null;
}
