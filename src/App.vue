<template>
  <div class="app-container">
    <input
      class="data-source"
      id="data-source"
      type="url"
      placeholder="Where net data is fetched from..."
      @input="onInput"
    />
    <GraphView v-if="graphData" :data="graphData" />
    <div v-else class="loading">Loading graph data...</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import GraphView from './GraphView.vue';
import type { MapData } from './types'; // 假设 MapData 导出自 types

const graphData = ref<MapData | null>(null);

const loadData = async (url: string | null) => {
  graphData.value = null; // 可选：清空以触发重新挂载或显示 Loading
  if (!url) return;
  try {
    const r = await fetch(url);
    graphData.value = await r.json();
  } catch (e) {
    console.error('Failed to load data:', e);
  }
};

const onInput = (e: Event) => {
  const target = e.target as HTMLInputElement | null;
  const value = target?.value ?? null;
  loadData(value);
};

onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const source = urlParams.get('source');
  const el = document.getElementById('data-source');
  const inputEl = el as HTMLInputElement | null;
  inputEl?.focus();
  if (inputEl) inputEl.value = source ?? '';
  loadData(source);
});
</script>

<style>
body {
  margin: 0;
  background-color: #000;
  color: #fff;
}

.app-container {
  position: relative;
  width: 100vw;
  height: 100vh;
}

.loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #00bcd4;
  font-size: 1.2rem;
}

.data-source {
  position: absolute;
  top: 20px;
  left: 290px;
  z-index: 40;
  display: flex;
  background: rgba(20, 20, 25, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  overflow: hidden;
  color: #888;
  padding: 10px 16px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  width: 50%;
}

</style>
