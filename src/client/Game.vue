<script setup lang="ts">
import { context } from '@devvit/web/client';
import MapCanvas from './components/MapCanvas.vue';
import DebugPanel from './components/DebugPanel.vue';
import { useCity } from './composables/useCity';
import { usePins } from './composables/usePins';

const subName = context.subredditName ?? 'unknown';
const { cities, source, failedLines, debug, loading: loadingCity, error: cityError } = useCity();
const { pins, loading: loadingPins, error: pinsError } = usePins();
</script>

<template>
  <div class="rm-root">
    <div v-if="loadingCity" class="rm-status">Loading map…</div>
    <div v-else-if="cityError" class="rm-status rm-error">{{ cityError }}</div>
    <div v-else-if="!cities.length" class="rm-status rm-empty">
      <div class="rm-empty-emoji">🗺️</div>
      <div class="rm-empty-title">No cities configured</div>
      <div class="rm-empty-sub">
        Open the app's <b>Installation Settings</b> on developers.reddit.com
        and fill the <b>Map cities</b> field — one city per line (e.g.
        "Quito, Ecuador"). Server geocodes each via OpenStreetMap.
      </div>
      <div v-if="failedLines.length" class="rm-debug rm-debug-fail">
        Couldn't resolve:
        <ul style="margin: 4px 0 0 12px; padding: 0;">
          <li v-for="l in failedLines" :key="l">{{ l }}</li>
        </ul>
      </div>

      <pre class="rm-debug">source: {{ source }}
subreddit: {{ debug?.subredditName ?? '(none)' }}
citiesSetting: {{ JSON.stringify(debug?.citiesSettingText ?? '') }}
legacyCityName: {{ JSON.stringify(debug?.normalizedSetting) }}
redisCityCount: {{ debug?.redisCityCount ?? 0 }}</pre>
    </div>
    <MapCanvas
      v-else
      :cities="cities"
      :subreddit-name="subName"
      :pins="pins"
    />

    <header class="rm-nav">
      <span class="rm-logo">Reddit<b>Maps</b></span>
      <span class="rm-sub">
        r/{{ subName }}
        <span v-if="!loadingPins && !pinsError" class="rm-pin-count">
          · {{ pins.length }} pin{{ pins.length === 1 ? '' : 's' }}
        </span>
      </span>
    </header>

    <DebugPanel />
  </div>
</template>

<style scoped>
.rm-root {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #f6f7f8;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.rm-nav {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 14px;
  background: rgba(255, 255, 255, 0.97);
  border-bottom: 1px solid #edeff1;
}
.rm-logo {
  font-size: 15px;
  font-weight: 900;
  color: #1c1c1c;
  letter-spacing: -0.3px;
}
.rm-logo b { color: #ff4500; }
.rm-sub {
  font-size: 12px;
  font-weight: 700;
  color: #878a8c;
  font-family: monospace;
}
.rm-pin-count { color: #ff4500; }

.rm-status {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  padding: 0 24px;
  color: #1c1c1c;
}
.rm-error { color: #c92a2a; }
.rm-empty-emoji { font-size: 56px; }
.rm-empty-title { font-size: 18px; font-weight: 800; letter-spacing: -0.3px; }
.rm-empty-sub { font-size: 13px; color: #878a8c; max-width: 360px; line-height: 1.5; }

.rm-debug {
  margin-top: 6px;
  padding: 10px 14px;
  background: #f6f7f8;
  border: 1px solid #edeff1;
  border-radius: 8px;
  font-size: 11px;
  color: #1c1c1c;
  font-family: 'SF Mono', Menlo, monospace;
  text-align: left;
  white-space: pre-wrap;
  max-width: 360px;
  line-height: 1.5;
}
.rm-debug-fail {
  background: #fff3bf;
  border-color: #ffd43b;
  color: #855506;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
</style>
