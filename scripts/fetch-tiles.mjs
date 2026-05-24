#!/usr/bin/env node
// Per-city tile fetcher. Each supported city ships its own z=11..13 tile slice
// to apps/reddit/public/maps/{z}/{x}/{y}.png so they can be served from the
// iframe's own origin (Devvit CSP allows 'self', blocks third-party img-src).
//
// Edit the CITIES array below to add/remove supported cities, then run:
//   node scripts/fetch-tiles.mjs
// Already-cached tiles are skipped.

import { mkdirSync, existsSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const ZOOMS = [11, 12, 13];

const CITIES = [
  { name: 'San Francisco', bbox: { west: -122.52, east: -122.34, north: 37.84, south: 37.70 } },
  { name: 'New York City', bbox: { west: -74.06,  east: -73.70,  north: 40.92, south: 40.55 } },
  { name: 'London',        bbox: { west: -0.31,   east:  0.03,   north: 51.62, south: 51.40 } },
  { name: 'Barcelona',     bbox: { west:  2.07,   east:  2.24,   north: 41.48, south: 41.32 } },
  { name: 'Bogotá',        bbox: { west: -74.20,  east: -73.99,  north:  4.83, south:  4.50 } },
  { name: 'Quito',         bbox: { west: -78.65,  east: -78.35,  north:  0.00, south: -0.40 } },
];

// Multi-city scopes (e.g. Andes = Quito + Bogotá) need lower zoom tiles
// to render the regional view that fits both cities at once. Per-city
// tiles above cover z=11..13; these scopes cover z=6..10 for the bbox
// that encloses every city in the scope.
const SCOPE_ZOOMS = [6, 7, 8, 9, 10];
const SCOPES = [
  { name: 'Andes', bbox: { west: -79.50, east: -73.00, north: 5.50, south: -1.00 } },
];

const PUBLIC_DIR = resolve(import.meta.dirname, '..', 'public', 'maps');
const UA = 'RedditMaps/0.1 (educational, dev contact: aldas)';
const SLEEP_MS = 60;

const lonToX = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const latToY = (lat, z) =>
  Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) /
      2) *
      2 ** z,
  );

async function fetchTile(z, x, y, dest) {
  if (existsSync(dest) && statSync(dest).size > 0) return 'cached';
  const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  await new Promise((r) => setTimeout(r, SLEEP_MS));
  return `${buf.length}B`;
}

async function fetchRegion(label, bbox, zooms) {
  let regionTotal = 0;
  let regionBytes = 0;
  for (const z of zooms) {
    const xMin = lonToX(bbox.west, z);
    const xMax = lonToX(bbox.east, z);
    const yMin = latToY(bbox.north, z);
    const yMax = latToY(bbox.south, z);
    const total = (xMax - xMin + 1) * (yMax - yMin + 1);
    regionTotal += total;
    console.log(`[${label}] z=${z}: ${total} tiles  (x ${xMin}..${xMax}, y ${yMin}..${yMax})`);
    let i = 0;
    let bytes = 0;
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        i++;
        const dest = resolve(PUBLIC_DIR, String(z), String(x), `${y}.png`);
        try {
          const out = await fetchTile(z, x, y, dest);
          if (out !== 'cached') bytes += parseInt(out, 10);
          process.stdout.write(`\r  ${i}/${total}                 `);
        } catch (e) {
          console.error(`\n  FAILED ${z}/${x}/${y}: ${e.message}`);
        }
      }
    }
    regionBytes += bytes;
    process.stdout.write(`\n  done z=${z}, fetched ${(bytes / 1024).toFixed(0)} KB this zoom\n`);
  }
  return { regionTotal, regionBytes };
}

let grandTotal = 0;
let grandBytes = 0;
for (const city of CITIES) {
  const { regionTotal, regionBytes } = await fetchRegion(city.name, city.bbox, ZOOMS);
  grandTotal += regionTotal;
  grandBytes += regionBytes;
}
for (const scope of SCOPES) {
  const { regionTotal, regionBytes } = await fetchRegion(`scope:${scope.name}`, scope.bbox, SCOPE_ZOOMS);
  grandTotal += regionTotal;
  grandBytes += regionBytes;
}
console.log(`\nall done. ${grandTotal} tiles total, ${(grandBytes / 1024).toFixed(0)} KB downloaded.`);
