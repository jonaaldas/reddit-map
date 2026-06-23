import type { LatLngBounds } from './mapBounds';

export type TileCoord = {
  z: number;
  x: number;
  y: number;
};

export type TileRange = {
  z: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

export function lonToTileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}

export function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
      2 ** z,
  );
}

export function tileRangeForBounds(bounds: LatLngBounds, z: number): TileRange {
  const [[south, west], [north, east]] = bounds;
  return {
    z,
    xMin: lonToTileX(west, z),
    xMax: lonToTileX(east, z),
    yMin: latToTileY(north, z),
    yMax: latToTileY(south, z),
  };
}

export function tileInBounds(tile: TileCoord, bounds: LatLngBounds): boolean {
  const range = tileRangeForBounds(bounds, tile.z);
  return (
    tile.x >= range.xMin &&
    tile.x <= range.xMax &&
    tile.y >= range.yMin &&
    tile.y <= range.yMax
  );
}
