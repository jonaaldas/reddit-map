export function lonToTileX(lon, z) {
    return Math.floor(((lon + 180) / 360) * 2 ** z);
}
export function latToTileY(lat, z) {
    const rad = (lat * Math.PI) / 180;
    return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
        2 ** z);
}
export function tileRangeForBounds(bounds, z) {
    const [[south, west], [north, east]] = bounds;
    return {
        z,
        xMin: lonToTileX(west, z),
        xMax: lonToTileX(east, z),
        yMin: latToTileY(north, z),
        yMax: latToTileY(south, z),
    };
}
export function tileInBounds(tile, bounds) {
    const range = tileRangeForBounds(bounds, tile.z);
    return (tile.x >= range.xMin &&
        tile.x <= range.xMax &&
        tile.y >= range.yMin &&
        tile.y <= range.yMax);
}
//# sourceMappingURL=tiles.js.map