import { onMounted, ref } from 'vue';
import type { Pin, PinsResponse } from '../../shared';

export function usePins() {
  const pins = ref<Pin[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);

  onMounted(async () => {
    try {
      const res = await fetch('/api/pins');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as PinsResponse;
      pins.value = data.pins;
    } catch (e) {
      console.error('Failed to load pins', e);
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  });

  return { pins, loading, error };
}
