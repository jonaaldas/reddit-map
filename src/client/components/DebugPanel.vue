<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useLlmLog, type LlmLogOutcome } from '../composables/useLlmLog';

const open = ref(false);
const filter = ref<LlmLogOutcome | ''>('');
const { data, loading, error, load } = useLlmLog();

type PromptInfo = { default: string; active: string; source: 'default' | 'override' };
const promptInfo = ref<PromptInfo | null>(null);
const promptOpen = ref(false);
const promptLoading = ref(false);
const promptError = ref<string | null>(null);

onMounted(() => {
  void load();
});

async function refresh() {
  await load(filter.value || undefined);
}

function copyJson() {
  if (!data.value) return;
  navigator.clipboard.writeText(JSON.stringify(data.value, null, 2)).catch(() => {});
}

function fmtTime(ts: number): string {
  return new Date(ts).toISOString().slice(11, 19);
}

async function viewPrompt() {
  promptOpen.value = true;
  if (promptInfo.value) return;
  promptLoading.value = true;
  promptError.value = null;
  try {
    const res = await fetch('/api/llm-prompt', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    promptInfo.value = (await res.json()) as PromptInfo;
  } catch (e) {
    promptError.value = e instanceof Error ? e.message : String(e);
  } finally {
    promptLoading.value = false;
  }
}

function copy(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}
</script>

<template>
  <button
    v-if="false"
    class="dp-toggle"
    :aria-expanded="open"
    @click="open = !open"
  >
    🛠 {{ open ? 'Hide' : 'Debug' }}
    <span v-if="data" class="dp-toggle-count">{{ data.total }}</span>
  </button>

  <div v-if="open" class="dp-panel">
    <div class="dp-row">
      <strong>LLM call log</strong>
      <button @click="refresh" :disabled="loading">↻ Refresh</button>
      <button @click="copyJson" :disabled="!data">Copy JSON</button>
      <button @click="viewPrompt">View AI prompt</button>
    </div>

    <div v-if="promptOpen" class="dp-prompt">
      <div class="dp-row">
        <strong>AI system prompt</strong>
        <span v-if="promptInfo" class="dp-prompt-source" :class="`dp-prompt-source--${promptInfo.source}`">
          {{ promptInfo.source }}
        </span>
        <button @click="promptOpen = false" style="margin-left:auto">✕</button>
      </div>
      <div v-if="promptLoading" class="dp-status">Loading…</div>
      <div v-else-if="promptError" class="dp-status dp-error">{{ promptError }}</div>
      <div v-else-if="promptInfo">
        <div class="dp-prompt-section">
          <div class="dp-row">
            <strong>Active</strong>
            <button @click="copy(promptInfo.active)">Copy</button>
          </div>
          <pre class="dp-prompt-text">{{ promptInfo.active }}</pre>
        </div>
        <div v-if="promptInfo.source === 'override'" class="dp-prompt-section">
          <div class="dp-row">
            <strong>Default (built-in)</strong>
            <button @click="copy(promptInfo.default)">Copy default</button>
          </div>
          <pre class="dp-prompt-text">{{ promptInfo.default }}</pre>
        </div>
        <div class="dp-prompt-hint">
          Override via Mod tools → app settings → <b>AI system prompt (override)</b>.
          Leave empty to use the default.
        </div>
      </div>
    </div>

    <div v-if="data" class="dp-counts">
      <span
        v-for="(n, key) in data.counts"
        :key="key"
        class="dp-count"
        :class="`dp-count--${key}`"
      >
        {{ key }}: <b>{{ n }}</b>
      </span>
    </div>

    <div class="dp-row">
      <label>Filter:</label>
      <select v-model="filter" @change="refresh">
        <option value="">all</option>
        <option value="hit">hit</option>
        <option value="miss-not-found">miss-not-found</option>
        <option value="drop-bbox">drop-bbox</option>
        <option value="http-error">http-error</option>
        <option value="fetch-error">fetch-error</option>
        <option value="parse-error">parse-error</option>
        <option value="no-api-key">no-api-key</option>
      </select>
    </div>

    <div v-if="loading" class="dp-status">Loading…</div>
    <div v-else-if="error" class="dp-status dp-error">{{ error }}</div>
    <div v-else-if="!data || !data.entries.length" class="dp-status">
      No entries. Run a re-scan from the mod menu.
    </div>
    <div v-else class="dp-list">
      <div
        v-for="entry in data.entries.slice(0, 200)"
        :key="entry.candidateId + entry.ts"
        class="dp-item"
        :class="`dp-item--${entry.outcome}`"
      >
        <div class="dp-item-head">
          <span class="dp-item-time">{{ fmtTime(entry.ts) }}</span>
          <span class="dp-item-kind">{{ entry.candidateKind }}</span>
          <span class="dp-item-city">{{ entry.city }}</span>
          <span class="dp-item-outcome">{{ entry.outcome }}</span>
        </div>
        <div class="dp-item-title">{{ entry.title }}</div>
        <div v-if="entry.body" class="dp-item-body">{{ entry.body }}</div>
        <pre v-if="entry.llmRaw" class="dp-item-raw">{{ JSON.stringify(entry.llmRaw) }}</pre>
        <div v-if="entry.errorMessage" class="dp-item-err">{{ entry.errorMessage }}</div>
      </div>
      <div v-if="data.entries.length > 200" class="dp-status">
        showing 200 of {{ data.entries.length }} entries; use Copy JSON for the rest
      </div>
    </div>
  </div>
</template>

<style scoped>
.dp-toggle {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1000;
  border: 1px solid #d7d9da;
  background: rgba(255, 255, 255, 0.97);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.dp-toggle-count {
  margin-left: 6px;
  padding: 1px 6px;
  background: #ff4500;
  color: white;
  border-radius: 8px;
  font-size: 10px;
}

.dp-panel {
  position: absolute;
  top: 44px;
  right: 8px;
  bottom: 8px;
  width: min(440px, calc(100vw - 16px));
  z-index: 999;
  background: white;
  border: 1px solid #d7d9da;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  font-size: 12px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.dp-row { display: flex; align-items: center; gap: 8px; }
.dp-row button {
  padding: 3px 8px;
  border: 1px solid #d7d9da;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
}
.dp-row button:disabled { opacity: 0.5; cursor: not-allowed; }

.dp-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 0;
  border-bottom: 1px solid #edeff1;
}
.dp-count {
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 10px;
  background: #f6f7f8;
  padding: 2px 6px;
  border-radius: 4px;
}
.dp-count--hit { background: #d3f9d8; }
.dp-count--http-error,
.dp-count--fetch-error,
.dp-count--no-api-key { background: #ffe3e3; }

.dp-status { padding: 12px; color: #878a8c; text-align: center; }
.dp-error { color: #c92a2a; }

.dp-list {
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 11px;
}
.dp-item {
  border-left: 3px solid #d7d9da;
  padding: 4px 8px;
  background: #fafbfc;
  border-radius: 4px;
}
.dp-item--hit { border-left-color: #2f9e44; }
.dp-item--miss-not-found { border-left-color: #adb5bd; }
.dp-item--drop-bbox { border-left-color: #fab005; }
.dp-item--http-error,
.dp-item--fetch-error,
.dp-item--no-api-key,
.dp-item--parse-error { border-left-color: #c92a2a; }

.dp-item-head {
  display: flex;
  gap: 6px;
  font-size: 10px;
  color: #878a8c;
  margin-bottom: 2px;
}
.dp-item-outcome { margin-left: auto; font-weight: 700; }
.dp-item-title { color: #1c1c1c; font-weight: 600; word-break: break-word; }
.dp-item-body { color: #555; margin-top: 2px; word-break: break-word; }
.dp-item-raw {
  margin: 4px 0 0;
  padding: 4px 6px;
  background: white;
  border: 1px solid #edeff1;
  border-radius: 3px;
  font-size: 10px;
  white-space: pre-wrap;
  word-break: break-word;
}
.dp-item-err { color: #c92a2a; margin-top: 2px; }

.dp-prompt {
  border: 1px solid #edeff1;
  border-radius: 6px;
  padding: 8px;
  background: #fafbfc;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 60%;
  overflow-y: auto;
}
.dp-prompt-source {
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
}
.dp-prompt-source--default { background: #e7f5ff; color: #1971c2; }
.dp-prompt-source--override { background: #fff3bf; color: #855506; }
.dp-prompt-section { display: flex; flex-direction: column; gap: 4px; }
.dp-prompt-text {
  margin: 0;
  padding: 6px 8px;
  background: white;
  border: 1px solid #edeff1;
  border-radius: 4px;
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 220px;
  overflow-y: auto;
}
.dp-prompt-hint {
  font-size: 11px;
  color: #878a8c;
  line-height: 1.4;
}
</style>
