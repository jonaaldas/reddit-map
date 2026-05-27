import { onMounted, ref } from 'vue';
import type { CityName } from '../../shared';

type CityResolution = {
  cityNames: CityName[];
  source: 'setting' | 'inferred-scope' | 'inferred-city' | 'none';
  debug: {
    rawSetting: unknown;
    normalizedSetting: string | undefined;
    subredditName: string | undefined;
  };
};

export function useCity() {
  const cityNames = ref<CityName[]>([]);
  const source = ref<CityResolution['source']>('none');
  const debug = ref<CityResolution['debug'] | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);

  onMounted(async () => {
    try {
      const res = await fetch('/api/config', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as CityResolution;
      cityNames.value = data.cityNames ?? [];
      source.value = data.source;
      debug.value = data.debug;
    } catch (e) {
      console.error('Failed to load city config', e);
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  });

  return { cityNames, source, debug, loading, error };
}
