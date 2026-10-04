// Loads data/generated/network.json once per server process and validates it.
// Server-side only: never import this from a client component (the file is ~1.7 MB).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NetworkSchema, type Network } from "@/lib/types";

let cached: Network | undefined;

export function loadNetwork(path = join(process.cwd(), "data", "generated", "network.json")): Network {
  if (cached) return cached;
  const result = NetworkSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (!result.success) {
    const first = result.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`network.json is invalid — run \`npm run build:data\`.\n${first.join("\n")}`);
  }
  cached = result.data;
  return cached;
}
