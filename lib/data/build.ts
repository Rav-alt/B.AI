// Pure GTFS → Network conversion. No file system access here, so tests can feed it small fixtures.
// scripts/build-data.ts does the reading, writing and logging.
import { NetworkSchema, type LatLon, type Mode, type Network, type Pattern, type Stop, type Transfer } from "@/lib/types";
import { haversineM, round5 } from "@/lib/geo/haversine";
import type { Row } from "./csv";
import type { Corrections } from "./corrections";
import { modeOf, trainLine } from "./mode";
import { cleanStopName, normalizeForMatch, parseRouteName, stationLabel } from "./names";
import { PlaceMatcher, guessSplit, orient } from "./direction";

export type Feed = {
  routes: Row[];
  trips: Row[];
  stopTimes: Row[];
  stops: Row[];
  shapes: Row[];
};

export type BuildOptions = {
  builtAt: string;
  feedNote?: string;
  /** Walking transfer radius between stops, metres. */
  transferRadiusM?: number;
};

export type BuildReport = {
  counts: {
    feedRoutes: number;
    removedRoutes: number;
    addedRoutes: number;
    patterns: number;
    patternsByMode: Record<Mode, number>;
    stops: number;
    transfers: number;
    withShape: number;
    loops: number;
    directionKnown: number;
    directionUnknown: number;
    splitGuessed: number;
    duplicatesDropped: number;
  };
  warnings: string[];
};

type DraftPattern = Omit<Pattern, "stops" | "dist" | "id"> & { stopIds: string[] };

const LOOP_M = 300; // first and last stop this close → loop
const SHAPE_MAX_ERR_M = 150; // drop a shape if a stop is further than this from it
const TWIN_MAX_M = 1500; // reverse twins: A's first stop within this of B's last stop

export function buildNetwork(feed: Feed, corrections: Corrections, opts: BuildOptions): { network: Network; report: BuildReport } {
  const warnings: string[] = [];
  const radius = opts.transferRadiusM ?? 300;

  // ---------- stops ----------
  const stopRename = new Map(corrections.renameStops.map((r) => [r.stopId, r.name]));
  const stopById = new Map<string, Stop>();
  for (const s of feed.stops) {
    const id = s.stop_id ?? "";
    const lat = Number(s.stop_lat);
    const lon = Number(s.stop_lon);
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      warnings.push(`skipped bad stop row ${JSON.stringify(s)}`);
      continue;
    }
    stopById.set(id, { id, name: cleanStopName(stopRename.get(id) ?? s.stop_name ?? id), lat: round5(lat), lon: round5(lon) });
  }
  for (const r of corrections.renameStops) if (!stopById.has(r.stopId)) warnings.push(`renameStops: no stop ${r.stopId}`);

  // ---------- trips → ordered stop sequences ----------
  const timesByTrip = new Map<string, Row[]>();
  for (const st of feed.stopTimes) {
    const t = st.trip_id ?? "";
    let list = timesByTrip.get(t);
    if (!list) timesByTrip.set(t, (list = []));
    list.push(st);
  }
  const shapePts = new Map<string, Array<{ seq: number; lat: number; lon: number }>>();
  for (const p of feed.shapes) {
    const id = p.shape_id ?? "";
    let list = shapePts.get(id);
    if (!list) shapePts.set(id, (list = []));
    list.push({ seq: Number(p.shape_pt_sequence), lat: Number(p.shape_pt_lat), lon: Number(p.shape_pt_lon) });
  }
  for (const list of shapePts.values()) list.sort((a, b) => a.seq - b.seq);

  /** route_id → distinct stop sequences (in first-seen order), each with the shape of its first trip. */
  const seqsByRoute = new Map<string, Map<string, { stopIds: string[]; shapeId: string }>>();
  for (const t of feed.trips) {
    const times = (timesByTrip.get(t.trip_id ?? "") ?? []).slice().sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
    const stopIds: string[] = [];
    for (const st of times) {
      const id = st.stop_id ?? "";
      if (!stopById.has(id)) {
        warnings.push(`trip ${t.trip_id}: unknown stop ${id}`);
        continue;
      }
      if (stopIds.at(-1) !== id) stopIds.push(id); // collapse "A, A"
    }
    const routeId = t.route_id ?? "";
    let seqs = seqsByRoute.get(routeId);
    if (!seqs) seqsByRoute.set(routeId, (seqs = new Map()));
    const key = stopIds.join(">");
    if (!seqs.has(key)) seqs.set(key, { stopIds, shapeId: t.shape_id ?? "" });
  }

  // ---------- routes → draft patterns ----------
  const removed = new Set(corrections.removeRoutes.map((r) => r.routeId));
  const renamed = new Map(corrections.renameRoutes.map((r) => [r.routeId, r.name]));
  const feedRouteIds = new Set(feed.routes.map((r) => r.route_id ?? ""));
  for (const id of removed) if (!feedRouteIds.has(id)) warnings.push(`removeRoutes: no route ${id}`);
  for (const id of renamed.keys()) if (!feedRouteIds.has(id)) warnings.push(`renameRoutes: no route ${id}`);

  const drafts: Array<DraftPattern & { draftId: string }> = [];
  let removedCount = 0;
  for (const r of feed.routes) {
    const routeId = r.route_id ?? "";
    if (removed.has(routeId)) {
      removedCount++;
      continue;
    }
    const mode = modeOf({ route_id: routeId, route_type: r.route_type ?? "", agency_id: r.agency_id ?? "" });
    const seqs = [...(seqsByRoute.get(routeId)?.values() ?? [])].filter((s) => {
      if (s.stopIds.length >= 2) return true;
      warnings.push(`route ${routeId}: dropped a trip with < 2 stops`);
      return false;
    });
    if (seqs.length === 0) {
      warnings.push(`route ${routeId}: no usable trips, skipped`);
      continue;
    }
    const rawName = renamed.get(routeId) ?? (r.route_long_name || r.route_short_name || routeId);
    const line = mode === "train" ? trainLine(r.route_short_name ?? "") : undefined;
    seqs.forEach((s, k) => {
      const draft: DraftPattern & { draftId: string } = {
        draftId: seqs.length === 1 ? routeId : `${routeId}:${k}`,
        routeId,
        mode,
        name: rawName,
        rawName,
        stopIds: s.stopIds,
        loop: false,
        source: "gtfs",
      };
      if (line) draft.line = line;
      const shape = shapeFor(s.shapeId, s.stopIds);
      if (shape) {
        draft.shape = shape.shape;
        draft.shapeIdx = shape.shapeIdx;
      }
      drafts.push(draft);
    });
  }

  function shapeFor(shapeId: string, stopIds: string[]): { shape: LatLon[]; shapeIdx: number[] } | undefined {
    const raw = shapeId ? shapePts.get(shapeId) : undefined;
    if (!raw || raw.length < 2) return undefined;
    const stopsOnShape = stopIds.map((id) => stopById.get(id)!);
    // The feed reuses one shape for both directions of a train line. If the stops run against the
    // shape's point order, flip the shape.
    const firstNear = nearestVertex(raw, stopsOnShape[0]!, 0);
    const lastNear = nearestVertex(raw, stopsOnShape.at(-1)!, 0);
    const pts = lastNear < firstNear ? [...raw].reverse() : raw;

    // Then project each stop onto the shape, moving only forward, so a loop can't snap to the wrong lap.
    const shapeIdx: number[] = [];
    let from = 0;
    for (const [k, s] of stopsOnShape.entries()) {
      const best = nearestVertex(pts, s, from);
      const err = distToLineNear(pts, s, best);
      if (err > SHAPE_MAX_ERR_M) {
        warnings.push(`shape ${shapeId}: stop ${stopIds[k]} is ${Math.round(err)} m off the line; drawing stop to stop instead`);
        return undefined;
      }
      shapeIdx.push(best);
      from = best;
    }
    return { shape: pts.map((p) => [round5(p.lat), round5(p.lon)] as LatLon), shapeIdx };
  }

  // ---------- corrections: added routes ----------
  let addedCount = 0;
  for (const a of corrections.addRoutes) {
    if (feedRouteIds.has(a.routeId)) throw new Error(`addRoutes: ${a.routeId} clashes with a feed route`);
    const stopIds = a.stops.map((s, i) => {
      if ("stopId" in s) {
        if (!stopById.has(s.stopId)) throw new Error(`addRoutes ${a.routeId}: unknown stop ${s.stopId}`);
        return s.stopId;
      }
      const id = `${a.routeId}_${i + 1}`;
      stopById.set(id, { id, name: cleanStopName(s.name), lat: round5(s.lat), lon: round5(s.lon) });
      return id;
    });
    if (a.mode === "train" && !a.line) throw new Error(`addRoutes ${a.routeId}: trains need a line label`);
    const base = { routeId: a.routeId, mode: a.mode, name: a.name, rawName: a.name, loop: false, source: "corrections" as const };
    const fwd: DraftPattern & { draftId: string } = { ...base, draftId: a.bothDirections ? `${a.routeId}:0` : a.routeId, stopIds };
    if (a.line) fwd.line = a.line;
    drafts.push(fwd);
    if (a.bothDirections) drafts.push({ ...fwd, draftId: `${a.routeId}:1`, stopIds: [...stopIds].reverse() });
    addedCount++;
  }

  // ---------- names and directions ----------
  // Signboard places are matched against stop names, plus any landmark aliases (Phase 3 adds more,
  // which also lets more route directions be worked out).
  const landmarkPoints = corrections.landmarkAliases.flatMap((l) =>
    [l.name, ...l.aliases].map((name) => ({ name, lat: l.lat, lon: l.lon })),
  );
  const ends = (d: DraftPattern) => ({ first: stopById.get(d.stopIds[0]!)!, last: stopById.get(d.stopIds.at(-1)!)! });
  const mainWords = new Map<DraftPattern, string[]>();
  for (const d of drafts) {
    const { first, last } = ends(d);
    d.loop = haversineM(first.lat, first.lon, last.lat, last.lon) < LOOP_M;
    if (d.mode === "train") {
      // Trains: name the line by its end stations, so a renamed station renames the line too.
      const e: [string, string] = [stationLabel(first.name), stationLabel(last.name)];
      d.endpoints = e;
      d.name = `${e[0]} – ${e[1]}`;
      d.towards = e[1];
      continue;
    }
    const parsed = parseRouteName(d.rawName);
    d.name = parsed.name;
    if (parsed.via) d.via = parsed.via;
    if (parsed.endpoints) d.endpoints = parsed.endpoints;
    else mainWords.set(d, parsed.mainWords);
  }

  let splitGuessed = 0;
  /** Try to set `towards` on every road pattern that doesn't have one yet. A loop has no single "towards". */
  const resolveDirections = (matcher: PlaceMatcher) => {
    for (const d of drafts) {
      if (d.mode === "train" || d.loop || d.towards) continue;
      const { first, last } = ends(d);
      if (d.endpoints) {
        const o = orient(matcher, first, last, d.endpoints);
        if (o) d.towards = d.endpoints[o.towards];
        continue;
      }
      const words = mainWords.get(d) ?? [];
      if (words.length < 2) continue;
      const g = guessSplit(matcher, words, first, last);
      if (g) {
        d.endpoints = g.ends;
        d.name = `${g.ends[0]} – ${g.ends[1]}`;
        d.towards = g.ends[g.towards];
        splitGuessed++;
      }
    }
  };

  // Pass 1: match signboard places against stop names and landmark aliases.
  resolveDirections(new PlaceMatcher([...stopById.values(), ...landmarkPoints]));
  // Pass 2: every pattern solved in pass 1 teaches us where its two places are (its first and last
  // stops). Feed those in as extra named points and try the rest again.
  const learned = drafts.flatMap((d) => {
    if (d.mode === "train" || d.loop || !d.towards || !d.endpoints) return [];
    const { first, last } = ends(d);
    const from = d.towards === d.endpoints[0] ? d.endpoints[1] : d.endpoints[0];
    return [
      { name: d.towards, lat: last.lat, lon: last.lon },
      { name: from, lat: first.lat, lon: first.lon },
    ];
  });
  resolveDirections(new PlaceMatcher([...stopById.values(), ...landmarkPoints, ...learned]));

  // Reverse twins: if one direction of "A – B" is known, its twin heads the other way.
  const byName = new Map<string, typeof drafts>();
  for (const d of drafts) {
    if (d.mode === "train" || d.loop) continue;
    const k = normalizeForMatch(d.rawName);
    let g = byName.get(k);
    if (!g) byName.set(k, (g = []));
    g.push(d);
  }
  for (const group of byName.values()) {
    for (const d of group) {
      if (d.towards) continue;
      const first = stopById.get(d.stopIds[0]!)!;
      const last = stopById.get(d.stopIds.at(-1)!)!;
      const twin = group.find((o) => {
        if (o === d || !o.towards || !o.endpoints) return false;
        const oFirst = stopById.get(o.stopIds[0]!)!;
        const oLast = stopById.get(o.stopIds.at(-1)!)!;
        return haversineM(first.lat, first.lon, oLast.lat, oLast.lon) < TWIN_MAX_M && haversineM(last.lat, last.lon, oFirst.lat, oFirst.lon) < TWIN_MAX_M;
      });
      if (twin?.endpoints) {
        d.endpoints = twin.endpoints;
        d.name = twin.name;
        d.towards = twin.towards === twin.endpoints[0] ? twin.endpoints[1] : twin.endpoints[0];
      }
    }
  }

  // ---------- drop exact duplicates (same name, same stops) ----------
  const seen = new Set<string>();
  let duplicatesDropped = 0;
  const kept = drafts.filter((d) => {
    const key = `${normalizeForMatch(d.rawName)}|${d.stopIds.join(">")}`;
    if (seen.has(key)) {
      duplicatesDropped++;
      warnings.push(`dropped duplicate pattern ${d.draftId} ("${d.rawName}")`);
      return false;
    }
    seen.add(key);
    return true;
  });

  // ---------- compact stop list (only stops some pattern uses) ----------
  const used = new Set(kept.flatMap((d) => d.stopIds));
  const stops = [...stopById.values()].filter((s) => used.has(s.id)).sort((a, b) => a.id.localeCompare(b.id));
  const indexOf = new Map(stops.map((s, i) => [s.id, i]));

  const patterns: Pattern[] = kept.map((d) => {
    const { draftId, stopIds, ...rest } = d;
    const dist: number[] = [0];
    for (let i = 1; i < stopIds.length; i++) {
      const a = stopById.get(stopIds[i - 1]!)!;
      const b = stopById.get(stopIds[i]!)!;
      dist.push(dist[i - 1]! + haversineM(a.lat, a.lon, b.lat, b.lon));
    }
    return { id: draftId, ...rest, stops: stopIds.map((id) => indexOf.get(id)!), dist: dist.map(Math.round) };
  });
  patterns.sort((a, b) => a.id.localeCompare(b.id));

  const transfers = nearbyPairs(stops, radius);

  const network = NetworkSchema.parse({
    version: 1,
    builtAt: opts.builtAt,
    feed: { name: "sakayph/gtfs (DOTC, 2015) + data/corrections.json", note: opts.feedNote ?? "" },
    params: { transferRadiusM: radius },
    stops,
    patterns,
    transfers,
  });

  const byMode: Record<Mode, number> = { train: 0, bus: 0, jeep: 0, uv: 0 };
  for (const p of patterns) byMode[p.mode]++;
  const roads = patterns.filter((p) => p.mode !== "train" && !p.loop);
  const report: BuildReport = {
    counts: {
      feedRoutes: feed.routes.length,
      removedRoutes: removedCount,
      addedRoutes: addedCount,
      patterns: patterns.length,
      patternsByMode: byMode,
      stops: stops.length,
      transfers: transfers.length,
      withShape: patterns.filter((p) => p.shape).length,
      loops: patterns.filter((p) => p.loop).length,
      directionKnown: roads.filter((p) => p.towards).length,
      directionUnknown: roads.filter((p) => !p.towards).length,
      splitGuessed,
      duplicatesDropped,
    },
    warnings,
  };
  return { network, report };
}

type Pt = { lat: number; lon: number };

/** Index of the shape vertex nearest to `p`, searching from `from` onwards. */
function nearestVertex(pts: Pt[], p: Pt, from: number): number {
  let best = from;
  let bestD = Infinity;
  for (let i = from; i < pts.length; i++) {
    const d = haversineM(p.lat, p.lon, pts[i]!.lat, pts[i]!.lon);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Distance from `p` to the shape's line segments next to vertex `i` (vertices can be far apart). */
function distToLineNear(pts: Pt[], p: Pt, i: number): number {
  let best = haversineM(p.lat, p.lon, pts[i]!.lat, pts[i]!.lon);
  for (const j of [i - 1, i]) {
    const a = pts[j];
    const b = pts[j + 1];
    if (a && b) best = Math.min(best, pointToSegmentM(p, a, b));
  }
  return best;
}

/** Point-to-segment distance in metres, on a flat local projection (fine at city scale). */
export function pointToSegmentM(p: Pt, a: Pt, b: Pt): number {
  const kx = 111_320 * Math.cos((p.lat * Math.PI) / 180);
  const ky = 110_540;
  const ax = (a.lon - p.lon) * kx;
  const ay = (a.lat - p.lat) * ky;
  const bx = (b.lon - p.lon) * kx;
  const by = (b.lat - p.lat) * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** All stop pairs within `radius` metres, using a coarse grid so it isn't O(n²). */
export function nearbyPairs(stops: Array<{ lat: number; lon: number }>, radius: number): Transfer[] {
  // Cell size in degrees. 1° of longitude is ~107 km at Manila's latitude, so /100 km keeps a cell ≥ radius both ways.
  const cell = radius / 100_000;
  const key = (x: number, y: number) => `${x},${y}`;
  const grid = new Map<string, number[]>();
  stops.forEach((s, i) => {
    const k = key(Math.floor(s.lat / cell), Math.floor(s.lon / cell));
    let list = grid.get(k);
    if (!list) grid.set(k, (list = []));
    list.push(i);
  });
  const out: Transfer[] = [];
  stops.forEach((s, i) => {
    const cx = Math.floor(s.lat / cell);
    const cy = Math.floor(s.lon / cell);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const j of grid.get(key(cx + dx, cy + dy)) ?? []) {
          if (j <= i) continue;
          const t = stops[j]!;
          const m = haversineM(s.lat, s.lon, t.lat, t.lon);
          if (m <= radius) out.push([i, j, Math.round(m)]);
        }
  });
  return out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}
