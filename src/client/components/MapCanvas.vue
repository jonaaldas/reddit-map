<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Map as LMap, Marker } from 'leaflet';
import { navigateTo } from '@devvit/web/client';
import {
  TILE_URL,
  TILE_MIN_ZOOM,
  TILE_MAX_ZOOM,
  combinedMapCityBounds,
  type MapCity,
  type Pin,
} from '@redditmap/shared';

const props = defineProps<{
  cities: MapCity[];
  subredditName: string;
  pins: Pin[];
}>();

// Live OSM tiles, so any geocoded bbox renders without bundled assets.
// Combined bounds for the picked cities → used for fitBounds + maxBounds
// (with some breathing room so users can pan slightly around each city).
const baseBounds = combinedMapCityBounds(props.cities);
const padLatLng: [number, number] = [
  Math.max(0.1, (baseBounds[1][0] - baseBounds[0][0]) * 0.25),
  Math.max(0.1, (baseBounds[1][1] - baseBounds[0][1]) * 0.25),
];
const bounds: [[number, number], [number, number]] = [
  [baseBounds[0][0] - padLatLng[0], baseBounds[0][1] - padLatLng[1]],
  [baseBounds[1][0] + padLatLng[0], baseBounds[1][1] + padLatLng[1]],
];
const isMulti = props.cities.length > 1;
const minZoom = TILE_MIN_ZOOM;
const maxZoom = TILE_MAX_ZOOM;

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
    const only = props.cities[0]!;
    map.setView([only.lat, only.lng], 12);
  }
  map.setMaxBounds(bounds);

  // Bundled per-city tile assets, served same-origin from /maps/{z}/{x}/{y}.png.
  // Coverage is whatever apps/reddit/scripts/fetch-tiles.mjs pre-fetched.
  // For cities outside that coverage you'll see blank tiles — re-run that
  // script after adding a new city to public/maps/.
  L.tileLayer(TILE_URL, {
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
