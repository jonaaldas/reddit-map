<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Coords, DoneCallback, Map as LMap, Marker } from 'leaflet';
import { navigateTo } from '@devvit/web/client';
import {
  CITIES,
  CITY_REGIONS,
  CITY_SCOPES,
  SCOPE_REGIONS,
  TILE_URL,
  type CityName,
  type Pin,
  type ScopeName,
} from '../../shared';

const props = defineProps<{
  cityNames: CityName[];
  subredditName: string;
  pins: Pin[];
}>();

const primaryRegion = CITY_REGIONS[props.cityNames[0]!];
const primaryCity = CITIES[props.cityNames[0]!];

// If the cityNames exactly match a known scope (e.g. Quito+Bogotá → Andes),
// use the scope's pre-fetched tile bbox as BOTH the fitBounds target and
// the maxBounds. This guarantees the visible map area equals the cached
// tile area — no blue gaps, no panning into uncovered space.
function resolveScope(): ScopeName | null {
  if (props.cityNames.length < 2) return null;
  const sortedSet = [...props.cityNames].sort().join(',');
  for (const [name, list] of Object.entries(CITY_SCOPES) as [ScopeName, CityName[]][]) {
    if ([...list].sort().join(',') === sortedSet) return name;
  }
  return null;
}

const scopeName = resolveScope();
const scope = scopeName ? SCOPE_REGIONS[scopeName] : null;
const isMulti = !!scope;
const bounds = scope ? scope.bounds : primaryRegion.bounds;
const minZoom = scope ? scope.minZoom : primaryRegion.minZoom;
const maxZoom = primaryRegion.maxZoom;

const mapEl = ref<HTMLDivElement | null>(null);
let map: LMap | null = null;
let leaflet: typeof import('leaflet') | null = null;
let pinMarkers: Marker[] = [];

function clearPinMarkers() {
  pinMarkers.forEach((m) => m.remove());
  pinMarkers = [];
}

function renderPinMarkers(L: typeof import('leaflet'), m: LMap, pins: readonly Pin[]) {
  clearPinMarkers();
  if (!pins.length) return;

  const icon = L.divIcon({
    className: 'rm-pin-wrap',
    html: '<div class="rm-pin">📍</div>',
    iconSize: [28, 28],
    iconAnchor: [14, 26],
    tooltipAnchor: [0, -22],
  });

  for (const pin of pins) {
    const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(m);
    const escaped = pin.title.replace(/[<&>"']/g, (ch) =>
      ({ '<': '&lt;', '&': '&amp;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!),
    );
    marker.bindTooltip(
      `<div class="rm-tip">
        <div class="rm-tip-hood">📍 ${pin.hood}</div>
        <div class="rm-tip-title">${escaped}</div>
        <div class="rm-tip-meta">▲ ${pin.upvotes} · 💬 ${pin.numComments}</div>
      </div>`,
      { direction: 'top', offset: [0, -4] },
    );
    marker.on('click', () => {
      navigateTo(`https://www.reddit.com${pin.permalink}`);
    });
    pinMarkers.push(marker);
  }
}

function tileUrl(coords: Coords): string {
  return TILE_URL
    .replace('{z}', String(coords.z))
    .replace('{x}', String(coords.x))
    .replace('{y}', String(coords.y));
}

onMounted(async () => {
  const L = await import('leaflet');
  await import('leaflet/dist/leaflet.css');
  leaflet = L;

  map = L.map(mapEl.value!, {
    minZoom,
    maxZoom,
    zoomControl: true,
    attributionControl: true,
    worldCopyJump: false,
  });

  if (isMulti) {
    map.fitBounds(bounds, { padding: [24, 24] });
  } else {
    map.setView(primaryCity.c, primaryCity.z);
  }
  map.setMaxBounds(bounds);

  class AuthenticatedTileLayer extends L.GridLayer {
    override createTile(coords: Coords, done: DoneCallback): HTMLElement {
      const img = document.createElement('img');
      img.alt = '';

      fetch(tileUrl(coords), { credentials: 'include' })
        .then((res) => {
          if (!res.ok) throw new Error(`Tile HTTP ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          const objectUrl = URL.createObjectURL(blob);
          img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            done(undefined, img);
          };
          img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            done(new Error('Tile image decode failed'), img);
          };
          img.src = objectUrl;
        })
        .catch((error: unknown) => {
          done(error instanceof Error ? error : new Error(String(error)), img);
        });

      return img;
    }
  }

  new AuthenticatedTileLayer({
    minZoom,
    maxZoom,
    tileSize: 256,
    attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  renderPinMarkers(L, map, props.pins);

  setTimeout(() => map?.invalidateSize(), 200);
});

watch(
  () => props.pins,
  (newPins) => {
    if (leaflet && map) renderPinMarkers(leaflet, map, newPins);
  },
);

onBeforeUnmount(() => {
  clearPinMarkers();
  map?.remove();
  map = null;
  leaflet = null;
});
</script>

<template>
  <div ref="mapEl" class="map" />
</template>

<style scoped>
.map {
  position: absolute;
  inset: 0;
  background: #aad3df;
  cursor: grab;
}
.map :deep(.leaflet-grab) { cursor: grab; }
.map :deep(.leaflet-dragging .leaflet-grab) { cursor: grabbing; }
</style>

<style>
.rm-pin-wrap {
  background: transparent;
  border: none;
  cursor: pointer;
}
.rm-pin {
  font-size: 24px;
  line-height: 1;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.4));
  transition: transform 0.12s ease;
  text-align: center;
}
.rm-pin-wrap:hover .rm-pin {
  transform: scale(1.2);
}
.leaflet-control-attribution {
  font-size: 9px !important;
}
.leaflet-tooltip {
  font-size: 11px !important;
  font-weight: 700;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  padding: 6px 8px;
  max-width: 240px;
}
.rm-tip-hood { color: #0b7a6e; font-size: 10px; margin-bottom: 2px; }
.rm-tip-title { color: #1c1c1c; line-height: 1.35; white-space: normal; }
.rm-tip-meta { color: #878a8c; font-size: 10px; margin-top: 4px; font-weight: 600; }
</style>
