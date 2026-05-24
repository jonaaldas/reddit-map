import { ref } from 'vue';

export type LlmLogOutcome =
  | 'hit'
  | 'miss-not-found'
  | 'drop-bbox'
  | 'parse-error'
  | 'http-error'
  | 'fetch-error'
  | 'no-api-key';

export type LlmLogEntry = {
  ts: number;
  city: string;
  candidateId: string;
  candidateKind: 'post' | 'comment';
  title: string;
  body: string;
  permalink: string;
  outcome: LlmLogOutcome;
  llmRaw?: unknown;
  errorMessage?: string;
};

export type LlmLogResponse = {
  total: number;
  counts: Record<string, number>;
  entries: LlmLogEntry[];
};

export function useLlmLog() {
  const data = ref<LlmLogResponse | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function load(outcome?: LlmLogOutcome) {
    loading.value = true;
    error.value = null;
    try {
      const qs = outcome ? `?outcome=${encodeURIComponent(outcome)}` : '';
      const res = await fetch(`/api/llm-log${qs}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data.value = (await res.json()) as LlmLogResponse;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  return { data, loading, error, load };
}
