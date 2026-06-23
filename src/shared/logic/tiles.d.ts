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
export declare function lonToTileX(lon: number, z: number): number;
export declare function latToTileY(lat: number, z: number): number;
export declare function tileRangeForBounds(bounds: LatLngBounds, z: number): TileRange;
export declare function tileInBounds(tile: TileCoord, bounds: LatLngBounds): boolean;
