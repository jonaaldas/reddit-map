import { onMounted, ref } from 'vue';
import type { MapCity } from '@redditmap/shared';

type CityResolution = {
  cities: MapCity[];
  source:
    | 'setting-cities-cached'
    | 'setting-cities-geocoded'
    | 'redis-menu'
    | 'setting-cityname'
    | 'inferred-scope'
    | 'inferred-city'
    | 'none';
  failedLines?: string[];
  debug: {
    rawSetting: unknown;
    normalizedSetting: string | undefined;
    citiesSettingText: string | undefined;
    subredditName: string | undefined;
    redisCityCount: number;
  };
};

export function useCity() {
  const cities = ref<MapCity[]>([]);
  const source = ref<CityResolution['source']>('none');
  const failedLines = ref<string[]>([]);
  const debug = ref<CityResolution['debug'] | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);

  onMounted(async () => {
    try {
      const res = await fetch('/api/config', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as CityResolution;
      cities.value = data.cities ?? [];
      source.value = data.source;
      failedLines.value = data.failedLines ?? [];
      debug.value = data.debug;
    } catch (e) {
      console.error('Failed to load city config', e);
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  });

  return { cities, source, failedLines, debug, loading, error };
}
