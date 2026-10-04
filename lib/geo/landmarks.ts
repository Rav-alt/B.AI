// Curated landmarks (data/landmarks.json): stations, schools, malls, intersections people actually say.
// The geocoder checks these first; build-data also uses them to work out route directions.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { insideMetroManila } from "./bbox";

export const LandmarkSchema = z
  .object({
    /** The name B.AI shows ("Pedro Gil Taft"). */
    name: z.string().min(1),
    /** Other ways people say it ("Pedro Gil", "PGH"). An alias may be shared on purpose ("Buendia"): that makes it ambiguous. */
    aliases: z.array(z.string().min(1)).default([]),
    lat: z.number(),
    lon: z.number(),
    kind: z.enum(["station", "school", "mall", "intersection", "area", "landmark", "terminal"]),
    /** Where the coordinates came from (a URL, a GTFS stop id, or "Approximate: …"). */
    source: z.string().min(3),
    updated: z.iso.date(),
  })
  .strict()
  .refine((l) => insideMetroManila(l.lat, l.lon), { message: "landmark is outside Metro Manila" });
export type Landmark = z.infer<typeof LandmarkSchema>;

export const LandmarksSchema = z.array(LandmarkSchema);

let cached: Landmark[] | undefined;

/** Loads and validates data/landmarks.json once per process. Server-side only. */
export function loadLandmarks(path = join(process.cwd(), "data", "landmarks.json")): Landmark[] {
  if (cached) return cached;
  cached = LandmarksSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  return cached;
}
