// Nominatim (OpenStreetMap search) client, following its usage policy:
// https://operations.osmfoundation.org/policies/nominatim/
// - at most 1 request per second (requests queue up behind each other)
// - an identifying User-Agent with a contact email
// - results are cached; no search-as-you-type (callers only search on submit)
// Server-side only. Note: on serverless hosting each instance has its own queue and cache.
import { z } from "zod";
import { METRO_MANILA } from "./bbox";

export const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

const ResultSchema = z.object({
  lat: z.string(),
  lon: z.string(),
  display_name: z.string(),
  name: z.string().optional(),
  category: z.string().optional(),
  type: z.string().optional(),
  importance: z.number().optional(),
});

export interface NominatimPlace {
  name: string;
  /** Short area label from the address, e.g. "Sampaloc, Manila". */
  area?: string;
  lat: number;
  lon: number;
}

export interface NominatimClient {
  search(query: string): Promise<NominatimPlace[]>;
}

export interface NominatimOptions {
  /** Email for the User-Agent. Required by the usage policy. */
  contact: string;
  fetch?: typeof fetch;
  minIntervalMs?: number;
  cacheSize?: number;
  timeoutMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/** "Kanto Freestyle, Kalayaan Avenue, Makati, Metro Manila, Philippines" → name + "Kalayaan Avenue, Makati". */
function toPlace(r: z.infer<typeof ResultSchema>): NominatimPlace {
  const parts = r.display_name.split(",").map((s) => s.trim()).filter(Boolean);
  const name = r.name?.trim() || parts[0] || r.display_name;
  const rest = parts.filter((p, i) => !(i === 0 && p === name) && !/^(metro manila|philippines|\d{4})$/i.test(p));
  const area = rest.slice(0, 2).join(", ");
  return { name, lat: Number(r.lat), lon: Number(r.lon), ...(area ? { area } : {}) };
}

export function createNominatim(opts: NominatimOptions): NominatimClient {
  if (!opts.contact.trim()) throw new Error("Nominatim needs a contact email (NOMINATIM_CONTACT) for its User-Agent");
  const doFetch = opts.fetch ?? globalThis.fetch;
  const minInterval = opts.minIntervalMs ?? 1000;
  const cacheSize = opts.cacheSize ?? 200;
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const userAgent = `B.AI-commute-helper/1.0 (contact: ${opts.contact.trim()})`;

  const cache = new Map<string, NominatimPlace[]>(); // Map keeps insertion order → simple LRU
  const inflight = new Map<string, Promise<NominatimPlace[]>>();
  let queue: Promise<unknown> = Promise.resolve();
  let last = -Infinity;

  async function request(query: string): Promise<NominatimPlace[]> {
    const wait = last + minInterval - now();
    if (wait > 0) await sleep(wait);
    last = now();
    const u = new URL(NOMINATIM_URL);
    u.search = new URLSearchParams({
      q: query,
      format: "jsonv2",
      countrycodes: "ph",
      viewbox: `${METRO_MANILA.west},${METRO_MANILA.north},${METRO_MANILA.east},${METRO_MANILA.south}`,
      bounded: "1",
      limit: "5",
      "accept-language": "en",
    }).toString();
    const res = await doFetch(u.toString(), {
      headers: { "User-Agent": userAgent, Accept: "application/json" },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
    });
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    return z.array(ResultSchema).parse(await res.json()).map(toPlace);
  }

  return {
    search(query) {
      const key = query.trim().toLowerCase().replace(/\s+/g, " ");
      const hit = cache.get(key);
      if (hit) {
        cache.delete(key); // refresh its place in the LRU order
        cache.set(key, hit);
        return Promise.resolve(hit);
      }
      const pending = inflight.get(key);
      if (pending) return pending;
      const run = queue.then(() => request(query.trim()));
      queue = run.catch(() => undefined);
      const p = run
        .then((places) => {
          cache.set(key, places);
          if (cache.size > cacheSize) cache.delete(cache.keys().next().value!);
          return places;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, p);
      return p;
    },
  };
}

let shared: NominatimClient | null | undefined;

/** One client per server process, configured from NOMINATIM_CONTACT. Null when it isn't set. */
export function getNominatim(): NominatimClient | null {
  if (shared === undefined) {
    const contact = process.env.NOMINATIM_CONTACT?.trim();
    shared = contact ? createNominatim({ contact }) : null;
  }
  return shared;
}
