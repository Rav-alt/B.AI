// Build data/generated/network.json from the GTFS feed in data/raw/ plus data/corrections.json
// (and data/landmarks.json, used only to work out route directions).
// Run with:  npm run build:data
// Get the feed first (one time):  git clone --depth 1 https://github.com/sakayph/gtfs data/raw
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv, type Row } from "../lib/data/csv";
import { CorrectionsSchema } from "../lib/data/corrections";
import { buildNetwork } from "../lib/data/build";
import { LandmarksSchema } from "../lib/geo/landmarks";

const ROOT = process.cwd();
const RAW = join(ROOT, "data", "raw");
const OUT_DIR = join(ROOT, "data", "generated");
const OUT = join(OUT_DIR, "network.json");

function load(name: string, required = true): Row[] {
  const p = join(RAW, `${name}.txt`);
  if (!existsSync(p)) {
    if (!required) return [];
    console.error(`Missing ${p}.\nDownload the feed first:  git clone --depth 1 https://github.com/sakayph/gtfs data/raw`);
    process.exit(1);
  }
  return parseCsv(readFileSync(p, "utf8"));
}

const feed = {
  routes: load("routes"),
  trips: load("trips"),
  stopTimes: load("stop_times"),
  stops: load("stops"),
  shapes: load("shapes", false),
};

const parsed = CorrectionsSchema.safeParse(JSON.parse(readFileSync(join(ROOT, "data", "corrections.json"), "utf8")));
if (!parsed.success) {
  console.error("data/corrections.json is invalid:");
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

// data/landmarks.json (the geocoder's list) also teaches the direction matcher where places are,
// so "Divisoria" or "Lawton" on a signboard can be located even though no stop is named that.
const landmarks = LandmarksSchema.parse(JSON.parse(readFileSync(join(ROOT, "data", "landmarks.json"), "utf8")));
const corrections = {
  ...parsed.data,
  landmarkAliases: [
    ...parsed.data.landmarkAliases,
    ...landmarks.map(({ name, aliases, lat, lon, source, updated }) => ({ name, aliases, lat, lon, source, updated })),
  ],
};

const feedInfo = load("feed_info", false)[0];
const { network, report } = buildNetwork(feed, corrections, {
  builtAt: new Date().toISOString(),
  feedNote: feedInfo ? `feed_info: ${feedInfo.feed_publisher_name ?? ""} ${feedInfo.feed_version ?? ""}`.trim() : "",
});

mkdirSync(OUT_DIR, { recursive: true });
// One pattern / stop per line: small file, but still readable in a git diff.
const lines = (xs: unknown[]) => xs.map((x) => JSON.stringify(x)).join(",\n");
const { stops, patterns, transfers, ...meta } = network;
const metaJson = JSON.stringify(meta, null, 2).slice(0, -2); // drop the closing "\n}"
writeFileSync(
  OUT,
  `${metaJson},\n"stops": [\n${lines(stops)}\n],\n"patterns": [\n${lines(patterns)}\n],\n"transfers": [\n${lines(transfers)}\n]\n}\n`,
);

const c = report.counts;
console.log("build:data — network.json written");
console.log(`  feed routes      ${c.feedRoutes} (removed ${c.removedRoutes}, added ${c.addedRoutes})`);
console.log(`  patterns         ${c.patterns}  train ${c.patternsByMode.train} · bus ${c.patternsByMode.bus} · jeep ${c.patternsByMode.jeep} · uv ${c.patternsByMode.uv}`);
console.log(`  stops            ${c.stops}`);
console.log(`  transfers        ${c.transfers} stop pairs ≤ ${network.params.transferRadiusM} m`);
console.log(`  with shape       ${c.withShape} · loops ${c.loops}`);
console.log(`  road direction   known ${c.directionKnown} · unknown ${c.directionUnknown} (split guessed for ${c.splitGuessed})`);
console.log(`  duplicates       ${c.duplicatesDropped} dropped`);
console.log(`  output           ${OUT} (${(statSync(OUT).size / 1024).toFixed(0)} KB)`);
if (report.warnings.length) {
  console.log(`  warnings (${report.warnings.length}):`);
  for (const w of report.warnings.slice(0, 20)) console.log(`    - ${w}`);
  if (report.warnings.length > 20) console.log(`    … ${report.warnings.length - 20} more`);
}
