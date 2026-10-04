// Group nearby points so "12 stops on the same corner" counts as one place, not twelve.
import { haversineM } from "./haversine";

/** Greedy clustering: items in score order; each joins the first cluster whose top item is within `radiusM`. */
export function clusterByDistance<T extends { lat: number; lon: number }>(items: T[], radiusM: number): T[][] {
  const clusters: T[][] = [];
  for (const it of items) {
    const home = clusters.find((c) => haversineM(c[0]!.lat, c[0]!.lon, it.lat, it.lon) <= radiusM);
    if (home) home.push(it);
    else clusters.push([it]);
  }
  return clusters;
}
