import { redis } from '@devvit/web/server';
import {
  CITY_REGIONS,
  SCOPE_REGIONS,
  type CityName,
  type ScopeName,
  type TileCoord,
  tileInBounds,
} from '../../shared';

const TILE_PROVIDER = 'https://tile.openstreetmap.org';
const TILE_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;
const TILE_CACHE_VERSION = 'v1';
const USER_AGENT = 'RedditMaps/0.1 (https://redditmaps.com; hello@redditmaps.com)';
const CONTENT_TYPE = 'image/png';
const CACHE_CONTROL = `public, max-age=${TILE_CACHE_TTL_SECONDS}, stale-while-revalidate=86400`;

const cacheKey = (tile: TileCoord) =>
  `tile:${TILE_CACHE_VERSION}:${tile.z}:${tile.x}:${tile.y}`;

export type TileScope = {
  cities: readonly CityName[];
  scopeName: ScopeName | null;
};

export type TileResponse =
  | {
      ok: true;
      bytes: Buffer;
      contentType: string;
      cacheControl: string;
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

export async function loadMapTile(
  tile: TileCoord,
  scope: TileScope,
): Promise<TileResponse> {
  if (!isValidTile(tile)) {
    return { ok: false, status: 400, message: 'Invalid tile coordinate' };
  }
  if (!isTileAllowed(tile, scope)) {
    return { ok: false, status: 404, message: 'Tile outside configured map area' };
  }

  const cached = await redis.get(cacheKey(tile));
  if (cached) {
    return {
      ok: true,
      bytes: Buffer.from(cached, 'base64'),
      contentType: CONTENT_TYPE,
      cacheControl: CACHE_CONTROL,
    };
  }

  const upstream = await fetch(`${TILE_PROVIDER}/${tile.z}/${tile.x}/${tile.y}.png`, {
    headers: {
      'User-Agent': USER_AGENT,
      Referer: 'https://redditmaps.com/',
    },
  });

  if (!upstream.ok) {
    return {
      ok: false,
      status: upstream.status,
      message: `Tile provider returned HTTP ${upstream.status}`,
    };
  }

  const arrayBuffer = await upstream.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);
  await redis.set(cacheKey(tile), bytes.toString('base64'));
  await redis.expire(cacheKey(tile), TILE_CACHE_TTL_SECONDS);

  return {
    ok: true,
    bytes,
    contentType: upstream.headers.get('content-type') ?? CONTENT_TYPE,
    cacheControl: CACHE_CONTROL,
  };
}

function isValidTile(tile: TileCoord): boolean {
  const maxIndex = 2 ** tile.z - 1;
  return (
    Number.isInteger(tile.z) &&
    Number.isInteger(tile.x) &&
    Number.isInteger(tile.y) &&
    tile.z >= 0 &&
    tile.z <= 19 &&
    tile.x >= 0 &&
    tile.x <= maxIndex &&
    tile.y >= 0 &&
    tile.y <= maxIndex
  );
}

function isTileAllowed(tile: TileCoord, scope: TileScope): boolean {
  if (scope.scopeName) {
    const region = SCOPE_REGIONS[scope.scopeName];
    return (
      tile.z >= region.minZoom &&
      tile.z <= region.maxZoom &&
      tileInBounds(tile, region.bounds)
    );
  }

  return scope.cities.some((cityName) => {
    const region = CITY_REGIONS[cityName];
    return (
      tile.z >= region.minZoom &&
      tile.z <= region.maxZoom &&
      tileInBounds(tile, region.bounds)
    );
  });
}
