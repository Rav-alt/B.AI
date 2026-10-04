// Throwaway Phase 0 data spike: prints what the sakayph/gtfs feed actually contains.
// Run with:  npm run inspect:gtfs   (expects the feed files in data/raw/)
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const RAW = join(process.cwd(), "data", "raw");

type Row = Record<string, string>;

/** Minimal CSV parser: handles quoted fields, "" escapes, CRLF and a BOM. */
function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

function load(name: string): Row[] {
  const p = join(RAW, `${name}.txt`);
  if (!existsSync(p)) {
    console.log(`  (missing ${name}.txt)`);
    return [];
  }
  return parseCsv(readFileSync(p, "utf8"));
}

function countBy<T>(items: T[], key: (t: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return new Map([...m.entries()].sort((a, b) => b[1] - a[1]));
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const section = (t: string) => console.log(`\n=== ${t} ===`);

// ---------- load ----------
const agency = load("agency");
const routes = load("routes");
const trips = load("trips");
const stops = load("stops");
const stopTimes = load("stop_times");
const shapes = load("shapes");
const frequencies = load("frequencies");

section("Row counts");
for (const [n, rows] of Object.entries({ agency, routes, trips, stops, stop_times: stopTimes, shapes, frequencies })) {
  console.log(`  ${n.padEnd(12)} ${rows.length}`);
}
console.log(`  distinct shape_ids in shapes.txt: ${new Set(shapes.map((s) => s.shape_id)).size}`);

section("Agencies");
const routesPerAgency = countBy(routes, (r) => r.agency_id ?? "");
for (const a of agency) console.log(`  ${a.agency_id} — ${a.agency_name} (${routesPerAgency.get(a.agency_id ?? "") ?? 0} routes)`);

section("route_type × agency");
for (const [k, v] of countBy(routes, (r) => `type ${r.route_type} / ${r.agency_id}`)) console.log(`  ${k.padEnd(30)} ${v}`);

section("route_short_name prefixes (first word) — hints at mode");
for (const [k, v] of [...countBy(routes, (r) => (r.route_short_name ?? "").split(/[\s-]/)[0] || "(empty)")].slice(0, 15))
  console.log(`  ${k.padEnd(20)} ${v}`);

section("route_desc values (top 15)");
for (const [k, v] of [...countBy(routes, (r) => r.route_desc || "(empty)")].slice(0, 15)) console.log(`  ${k.slice(0, 60).padEnd(60)} ${v}`);

section("Train routes (route_type 1/2)");
for (const r of routes.filter((r) => r.route_type === "1" || r.route_type === "2"))
  console.log(`  ${r.route_id}  ${r.route_short_name} | ${r.route_long_name}`);

section("20 sample route names (every Nth route)");
const step = Math.max(1, Math.floor(routes.length / 20));
for (let i = 0; i < routes.length && i / step < 20; i += step) {
  const r = routes[i]!;
  console.log(`  [t${r.route_type}] short="${r.route_short_name}"  long="${r.route_long_name}"`);
}

section("Trips: shape_id / direction_id / headsign coverage");
const withShape = trips.filter((t) => t.shape_id).length;
const withDir = trips.filter((t) => t.direction_id !== "" && t.direction_id !== undefined).length;
const withHead = trips.filter((t) => t.trip_headsign).length;
console.log(`  trips with shape_id:     ${withShape} / ${trips.length}`);
console.log(`  trips with direction_id: ${withDir} / ${trips.length}  values: ${[...countBy(trips, (t) => t.direction_id || "(empty)").entries()].map(([k, v]) => `${k}=${v}`).join(", ")}`);
console.log(`  trips with headsign:     ${withHead} / ${trips.length}`);
const tripsPerRoute = countBy(trips, (t) => t.route_id ?? "");
console.log(`  routes with ≥1 trip: ${tripsPerRoute.size} / ${routes.length}`);
console.log(`  trips-per-route distribution: ${[...countBy([...tripsPerRoute.values()], (n) => String(n))].map(([k, v]) => `${k} trips→${v} routes`).join(", ")}`);
const routeById = new Map(routes.map((r) => [r.route_id, r]));
const shapeRouteTypes = countBy(trips.filter((t) => t.shape_id), (t) => `type ${routeById.get(t.route_id)?.route_type}`);
console.log(`  trips with shapes by route_type: ${[...shapeRouteTypes].map(([k, v]) => `${k}=${v}`).join(", ")}`);

section("Stop times per trip");
const stopsPerTrip = countBy(stopTimes, (s) => s.trip_id ?? "");
const counts = [...stopsPerTrip.values()].sort((a, b) => a - b);
const pct = (p: number) => counts[Math.min(counts.length - 1, Math.floor(p * counts.length))];
console.log(`  trips with stop_times: ${stopsPerTrip.size}; stops/trip min=${counts[0]} p50=${pct(0.5)} p90=${pct(0.9)} max=${counts.at(-1)}`);

section("Stops: bounding box and IDs");
const lats = stops.map((s) => Number(s.stop_lat));
const lons = stops.map((s) => Number(s.stop_lon));
console.log(`  lat ${Math.min(...lats)} … ${Math.max(...lats)}   lon ${Math.min(...lons)} … ${Math.max(...lons)}`);
const MM = { minLat: 14.35, maxLat: 14.8, minLon: 120.9, maxLon: 121.15 };
const outside = stops.filter((s) => {
  const la = Number(s.stop_lat);
  const lo = Number(s.stop_lon);
  return la < MM.minLat || la > MM.maxLat || lo < MM.minLon || lo > MM.maxLon;
});
console.log(`  stops outside Metro Manila box (${MM.minLat}–${MM.maxLat}, ${MM.minLon}–${MM.maxLon}): ${outside.length}`);
for (const s of outside.slice(0, 8)) console.log(`    ${s.stop_id} ${s.stop_name} (${s.stop_lat}, ${s.stop_lon})`);
console.log(`  coordinate decimals (sample): ${stops.slice(0, 5).map((s) => s.stop_lat).join(", ")}`);
console.log(`  stop_id prefixes: ${[...countBy(stops, (s) => (s.stop_id ?? "").split("_")[0] ?? "")].map(([k, v]) => `${k}=${v}`).join(", ")}`);
const usedStops = new Set(stopTimes.map((s) => s.stop_id));
console.log(`  stops never used by any trip: ${stops.filter((s) => !usedStops.has(s.stop_id)).length}`);

section("Stops matching acceptance-test places");
for (const q of ["pedro gil", "taft", "espa", "cubao", "makati", "ayala", "buendia", "u.s.t", "ust", "lacson", "morayta", "quiapo", "lawton", "rotonda"]) {
  const hits = stops.filter((s) => (s.stop_name ?? "").toLowerCase().includes(q));
  const names = [...new Set(hits.map((s) => s.stop_name))];
  console.log(`  "${q}": ${hits.length} stops — ${names.slice(0, 8).join(" | ")}${names.length > 8 ? " …" : ""}`);
}

// ---------- Pedro Gil Taft → España (direct-route check) ----------
section("Direct routes: Pedro Gil/Taft → España (forward order, ≤400 m walk)");
const PG = { lat: 14.5766, lon: 120.9881 }; // Pedro Gil LRT-1 / Taft Ave
const ESP = { lat: 14.6105, lon: 120.9897 }; // España Blvd near UST / Lacson
const stopById = new Map(stops.map((s) => [s.stop_id, s]));
const near = (p: { lat: number; lon: number }, r: number) =>
  new Set(stops.filter((s) => haversineM(p.lat, p.lon, Number(s.stop_lat), Number(s.stop_lon)) <= r).map((s) => s.stop_id));
const nearPG = near(PG, 400);
const nearESP = near(ESP, 400);
console.log(`  stops within 400 m: Pedro Gil/Taft=${nearPG.size}, España=${nearESP.size}`);
console.log(`  España-area stops: ${[...new Set([...nearESP].map((id) => stopById.get(id)?.stop_name))].join(" | ")}`);

const stByTrip = new Map<string, Row[]>();
for (const st of stopTimes) {
  const list = stByTrip.get(st.trip_id ?? "") ?? [];
  list.push(st);
  stByTrip.set(st.trip_id ?? "", list);
}
const directRoutes = new Map<string, string>();
for (const t of trips) {
  const seq = (stByTrip.get(t.trip_id ?? "") ?? []).sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
  const iBoard = seq.findIndex((s) => nearPG.has(s.stop_id ?? ""));
  if (iBoard < 0) continue;
  const iAlight = seq.findIndex((s, i) => i > iBoard && nearESP.has(s.stop_id ?? ""));
  if (iAlight < 0) continue;
  const r = routeById.get(t.route_id);
  directRoutes.set(
    t.route_id ?? "",
    `[t${r?.route_type}] ${r?.route_short_name} | ${r?.route_long_name}  board "${stopById.get(seq[iBoard]!.stop_id)?.stop_name}" → alight "${stopById.get(seq[iAlight]!.stop_id)?.stop_name}"`,
  );
}
console.log(`  direct routes found: ${directRoutes.size}`);
for (const v of directRoutes.values()) console.log(`    ${v}`);

section("Named-route check: 'Fairview' and 'Divisoria' signboards");
for (const q of ["fairview", "divisoria"]) {
  const hits = routes.filter((r) => `${r.route_short_name} ${r.route_long_name}`.toLowerCase().includes(q));
  console.log(`  "${q}": ${hits.length} routes`);
  for (const r of hits.slice(0, 10)) console.log(`    [t${r.route_type}] ${r.route_short_name} | ${r.route_long_name}`);
}
