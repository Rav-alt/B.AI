// Prints router answers for eyeballing.
//   npm run try:router                       → a few known trips
//   npm run try:router -- "Pedro Gil" "UST"  → your own trip, place names looked up locally (no Nominatim)
import { loadNetwork } from "@/lib/router/network";
import { planTrip } from "@/lib/router/plan";
import { checkRoutes } from "@/lib/router/check";
import type { Itinerary, PlaceRef } from "@/lib/types";
import { loadLandmarks } from "@/lib/geo/landmarks";
import { matchPlace } from "@/lib/geo/places";

const P: Record<string, PlaceRef> = {
  pedroGilTaft: { name: "Pedro Gil Taft", lat: 14.5766, lon: 120.9881 },
  espana: { name: "España (UST)", lat: 14.6105, lon: 120.9897 },
  cubao: { name: "Cubao", lat: 14.6194, lon: 121.0513 },
  ayala: { name: "Ayala", lat: 14.5494, lon: 121.0279 },
  quiapo: { name: "Quiapo Church", lat: 14.5986, lon: 120.9837 },
  upDiliman: { name: "UP Diliman", lat: 14.6538, lon: 121.0685 },
  moa: { name: "SM Mall of Asia", lat: 14.5352, lon: 120.9822 },
  monumento: { name: "Monumento", lat: 14.6543, lon: 120.9839 },
};

function show(it: Itinerary) {
  const steps = it.legs.map((l) =>
    l.mode === "walk" ? `walk ${l.meters} m` : `${l.mode} "${l.routeName}"${l.towards ? ` → ${l.towards}` : ""} (${l.boardStop.name} ⇒ ${l.alightStop.name}, ${l.distanceKm} km)`,
  );
  console.log(`  ~${it.totalMinutes} min, ${it.transfers} transfer(s), walk ${it.walkMeters} m\n    ${steps.join("\n    ")}`);
}

const net = loadNetwork();

const [fromText, toText] = process.argv.slice(2);
if (fromText && toText) {
  const lookup = (q: string): PlaceRef => {
    const r = matchPlace(net, loadLandmarks(), q);
    if (r.status === "found") return r.place;
    if (r.status === "ambiguous") {
      console.log(`"${q}" is ambiguous: ${r.choices.map((c) => c.name + (c.area ? ` (${c.area})` : "")).join(" | ")}`);
      process.exit(1);
    }
    console.log(`"${q}" not found locally (${r.status === "not_found" ? r.reason : r.status})`);
    process.exit(1);
  };
  const a = lookup(fromText);
  const b = lookup(toText);
  const res = planTrip(net, a, b);
  console.log(`${a.name} → ${b.name}: ${res.status}, radius ${res.walkRadiusM} m`);
  res.itineraries.forEach(show);
  process.exit(0);
}

const trips: [string, string, object?][] = [
  ["pedroGilTaft", "espana"], ["cubao", "ayala"], ["cubao", "ayala", { trainsOnly: true }],
  ["quiapo", "upDiliman"], ["moa", "monumento"], ["upDiliman", "moa"],
];
for (const [a, b, prefs] of trips) {
  const t0 = performance.now();
  const res = planTrip(net, P[a]!, P[b]!, prefs ?? {});
  console.log(`\n${a} → ${b} ${prefs ? JSON.stringify(prefs) : ""}: ${res.status}, radius ${res.walkRadiusM} m (${Math.round(performance.now() - t0)} ms)`);
  res.itineraries.forEach(show);
}
const chk = checkRoutes(net, P.pedroGilTaft!, P.espana!, [
  { mode: "bus", signboard: "SM Fairview" },
  { mode: "jeep", signboard: "Divisoria" },
  { signboard: "Monumento" },
]);
console.log("\ncheck Pedro Gil Taft → España:");
for (const v of chk.verdicts) console.log(`  ${v.candidate.signboard}: ${v.verdict} (${v.reason}) — ${v.matchedRoutes.map((m) => m.routeName + (m.towards ? "→" + m.towards : "")).join("; ")}`);
