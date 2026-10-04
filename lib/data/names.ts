// Turning raw GTFS names into clean signboard text (rules from docs/data-notes.md → "Signboard names").

/** Words that stay uppercase wherever they appear. */
const ACRONYMS = new Set([
  "SM", "LRT", "MRT", "UP", "NAIA", "PITX", "BGC", "EDSA", "MCU", "FTI", "SSH", "JRC", "SJDM", "NBP",
  "MOA", "UE", "TM", "TP", "ABC", "BBB", "NLEX", "SLEX", "QC", "PUP", "FEU", "UST", "GMA", "BF", "CAA",
  "DFA", "SSS", "GSIS", "NIA", "PNR", "II", "III", "IV", "C3", "C4", "C5", "R10", "TIP", "PGH", "UN",
]);

/** Whole-word fixes for typos and abbreviations, keyed by lowercase word (trailing dot ignored). */
const WORD_FIXES: Record<string, string> = {
  espana: "España",
  qave: "Quezon Ave",
  proj: "Project",
  rtda: "Rotonda",
  rotunda: "Rotonda",
  blumentrit: "Blumentritt",
  munoz: "Muñoz",
  dasmarinas: "Dasmariñas",
  binan: "Biñan",
  pinas: "Piñas",
  paranaque: "Parañaque",
  edsa: "EDSA",
};

/** Place names that really contain a hyphen; never split a signboard there. */
const KEEP_HYPHEN = ["bagong-silang", "bel-air", "dagat-dagatan"];

/** Collapse whitespace and trim. */
export const squash = (s: string): string => s.replace(/\s+/g, " ").trim();

/** "BACLARAN" → "Baclaran", leaving acronyms and mixed-case words alone. */
function titleCaseIfShouting(s: string): string {
  if (/[a-z]/.test(s)) return s; // already has lowercase: trust the author's casing
  return s.replace(/[A-ZÀ-Þ]+/g, (w) => (ACRONYMS.has(w) ? w : w[0] + w.slice(1).toLowerCase()));
}

function fixWords(s: string): string {
  return s
    .split(" ")
    .map((tok) => {
      const m = /^([A-Za-zÀ-ÿ0-9]+)(\.?)(.*)$/.exec(tok);
      if (!m) return tok;
      const [, word = "", dot = "", rest = ""] = m;
      const fix = WORD_FIXES[word.toLowerCase()];
      if (fix) return fix + rest; // a fix replaces the abbreviation dot too ("Proj." → "Project")
      if (ACRONYMS.has(word.toUpperCase())) return word.toUpperCase() + dot + rest;
      return tok;
    })
    .join(" ");
}

/** Clean one free-text piece of a signboard (an endpoint or the "via" text). */
export function cleanPart(s: string): string {
  let out = squash(s.replace(/_/g, "-"));
  out = out.replace(/\bhi\s*-?\s*way\b/gi, "Highway");
  out = titleCaseIfShouting(out);
  out = fixWords(out);
  return squash(out);
}

export type ParsedName = {
  /** Display name, endpoints joined with " – " (en dash). */
  name: string;
  via?: string;
  /** Present when the main part had a separator. */
  endpoints?: [string, string];
  /** The main part's cleaned words, used to try splits when there was no separator. */
  mainWords: string[];
};

/**
 * Split a raw route_long_name into a clean name, the "via" text and the two ends.
 * "BACLARAN - DAPITAN via TAFT" → { name: "Baclaran – Dapitan", via: "Taft", endpoints: ["Baclaran", "Dapitan"] }
 */
export function parseRouteName(raw: string): ParsedName {
  const src = squash(raw).replace(/\.via\s/i, ". via ");
  const viaMatch = /\s+via\s+/i.exec(src);
  const main = viaMatch ? src.slice(0, viaMatch.index) : src;
  const viaRaw = viaMatch ? src.slice(viaMatch.index + viaMatch[0].length) : "";

  // Prefer spaced separators ("Bel-Air - Washington"); only split on a bare hyphen when there is no
  // spaced one, and never inside place names that contain a hyphen.
  const protectedMain = KEEP_HYPHEN.reduce((s, w) => s.replace(new RegExp(w, "gi"), (m) => m.replace("-", "‑")), main);
  const sep = /\s[-–]\s/.test(protectedMain) ? /\s+[-–]\s+/ : /\s*[-–]\s*/;
  const parts = protectedMain
    .split(sep)
    .map((p) => cleanPart(p.replace(/‑/g, "-")))
    .filter(Boolean);
  const via = viaRaw ? cleanPart(viaRaw) : undefined;
  const cleanedMain = parts.join(" – ");

  const result: ParsedName = { name: cleanedMain || cleanPart(src), mainWords: cleanPart(main).split(" ") };
  if (via) result.via = via;
  if (parts.length >= 2) result.endpoints = [parts[0]!, parts[parts.length - 1]!];
  return result;
}

/** Clean a stop name: trim, collapse spaces, "LRT Balintawak" → "Balintawak LRT". */
export function cleanStopName(raw: string): string {
  const s = squash(raw);
  const m = /^(LRT|MRT)\s+(.+)$/i.exec(s);
  return m ? `${m[2]} ${m[1]!.toUpperCase()}` : s;
}

/** Station name without the " LRT"/" MRT" suffix, for train endpoints ("Pedro Gil LRT" → "Pedro Gil"). */
export const stationLabel = (stopName: string): string => squash(stopName.replace(/\s+(LRT|MRT|PNR)$/i, ""));

/** Lowercase, no accents, punctuation → spaces. Used for matching, never for display. */
export function normalizeForMatch(s: string): string {
  return squash(
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " "),
  );
}
