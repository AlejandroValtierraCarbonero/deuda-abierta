<script setup lang="ts">
defineProps<{ name: string; size?: number }>()
const paths: Record<string, string> = {
  chart: 'M4 19h16M7 15V9m5 6V4m5 11v-7',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  map: 'm3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15',
  layers: 'm12 3 10 6-10 6L2 9l10-6ZM2 15l10 6 10-6M2 12l10 6 10-6',
  flow: 'M3 7h12m-4-4 4 4-4 4M21 17H9m4-4-4 4 4 4',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  book: 'M4 3h6l2 2 2-2h6v17h-6l-2 2-2-2H4V3Zm8 2v17',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  external: 'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7',
  info: 'M12 11v6m0-10v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M6 18 18 6',
  clock: 'M12 6v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  check: 'm5 12 4 4L19 6',
}
</script>

<template>
  <svg :width="size ?? 20" :height="size ?? 20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="paths[name] ?? paths.chart" />
  </svg>
</template>
