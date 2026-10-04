// The Metro Manila box B.AI covers. Same box as the Nominatim `viewbox` in CLAUDE.md.
export const METRO_MANILA = { west: 120.9, north: 14.8, east: 121.15, south: 14.35 } as const;

export const insideMetroManila = (lat: number, lon: number): boolean =>
  lat >= METRO_MANILA.south && lat <= METRO_MANILA.north && lon >= METRO_MANILA.west && lon <= METRO_MANILA.east;
