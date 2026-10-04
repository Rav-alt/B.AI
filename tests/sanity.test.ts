import { describe, expect, it } from "vitest";
import { z } from "zod";

// Phase 0 smoke test: proves vitest runs, TypeScript compiles, and zod is installed.
describe("project setup", () => {
  it("runs tests", () => {
    expect(1 + 1).toBe(2);
  });

  it("can validate with zod", () => {
    const Stop = z.object({ id: z.string(), lat: z.number(), lon: z.number() });
    expect(Stop.safeParse({ id: "LRT1-PG", lat: 14.5766, lon: 120.9881 }).success).toBe(true);
    expect(Stop.safeParse({ id: 1 }).success).toBe(false);
  });
});
