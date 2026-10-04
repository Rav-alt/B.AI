// Schema for data/corrections.json: hand-made fixes merged over the 2015 GTFS feed at build time.
// Every entry must say where the fact came from (`source`) and when it was checked (`updated`).
import { z } from "zod";
import { ModeSchema } from "@/lib/types";

const Provenance = {
  source: z.string().min(3),
  updated: z.iso.date(),
};

/** A stop on an added route: either an existing feed stop, or a new point. */
const AddedStopSchema = z.union([
  z.object({ stopId: z.string().min(1) }).strict(),
  z.object({ name: z.string().min(1), lat: z.number(), lon: z.number() }).strict(),
]);

export const CorrectionsSchema = z
  .object({
    removeRoutes: z.array(z.object({ routeId: z.string(), reason: z.string(), ...Provenance }).strict()).default([]),
    renameRoutes: z
      .array(
        z
          .object({
            routeId: z.string(),
            /** New signboard text. Same format as GTFS names: "A - B via C". */
            name: z.string(),
            ...Provenance,
          })
          .strict(),
      )
      .default([]),
    renameStops: z.array(z.object({ stopId: z.string(), name: z.string(), ...Provenance }).strict()).default([]),
    addRoutes: z
      .array(
        z
          .object({
            /** New id; must not clash with a feed route_id. Use a prefix like "CORR_". */
            routeId: z.string().regex(/^CORR_/, "added route ids start with CORR_"),
            name: z.string(),
            mode: ModeSchema,
            /** Train line label, required for trains ("LRT-1"). */
            line: z.string().optional(),
            stops: z.array(AddedStopSchema).min(2),
            /** Also add the reverse direction. */
            bothDirections: z.boolean().default(true),
            ...Provenance,
          })
          .strict(),
      )
      .default([]),
    /** Local place names → coordinates. Not used by build-data; the geocoder (Phase 3) reads them. */
    landmarkAliases: z
      .array(
        z
          .object({
            name: z.string(),
            aliases: z.array(z.string()).default([]),
            lat: z.number(),
            lon: z.number(),
            ...Provenance,
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

export type Corrections = z.infer<typeof CorrectionsSchema>;
export type CorrectionsInput = z.input<typeof CorrectionsSchema>;

export const emptyCorrections = (): Corrections => CorrectionsSchema.parse({});
