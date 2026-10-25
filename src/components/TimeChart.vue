<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { ChartLine } from '../types'
import { number, periodLabel } from '../lib/format'

const props = defineProps<{ lines: ChartLine[]; unit: string; title: string; frequency?: string }>()
const id = useId()
const tableOpen = ref(false)
const periods = computed(() => [...new Set(props.lines.flatMap(l => l.points.map(p => p[0])))].sort())
const values = computed(() => props.lines.flatMap(l => l.points.map(p => p[1])))
const min = computed(() => Math.min(0, ...values.value))
const max = computed(() => Math.max(...values.value, min.value + 1))
const ticks = computed(() => Array.from({ length: 5 }, (_, i) => min.value + (max.value - min.value) * i / 4))
const x = (period: string) => 80 + periods.value.indexOf(period) / Math.max(1, periods.value.length - 1) * 800
const y = (v: number) => 235 - (v - min.value) / (max.value - min.value) * 210
const path = (line: ChartLine) => line.points.map(([period, value], i) => `${i ? 'L' : 'M'}${x(period)},${y(value)}`).join(' ')
const short = (n: number) => number(n, Math.abs(n) >= 100 ? 0 : 1)
const labelIndices = computed(() => [...new Set([0, Math.floor((periods.value.length - 1) / 3), Math.floor((periods.value.length - 1) * 2 / 3), periods.value.length - 1])].filter(i => i >= 0))
</script>

<template>
  <div class="time-chart">
    <div v-if="!values.length" class="empty-state">No hay observaciones para esta selección.</div>
    <template v-else>
      <div class="chart-unit">{{ unit }}</div>
      <svg viewBox="0 0 920 280" role="img" :aria-labelledby="id" class="line-chart">
        <title :id="id">{{ title }}. La tabla inferior contiene los valores exactos.</title>
        <defs>
          <linearGradient :id="`${id}-fill`" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="lines[0]?.color" stop-opacity=".13" />
            <stop offset="100%" :stop-color="lines[0]?.color" stop-opacity=".005" />
          </linearGradient>
        </defs>
        <g v-for="tick in ticks" :key="tick">
          <line x1="80" x2="880" :y1="y(tick)" :y2="y(tick)" stroke="#e8ece8" stroke-dasharray="3 5" />
          <text x="65" :y="y(tick) + 4" text-anchor="end">{{ short(tick) }}</text>
        </g>
        <path v-if="lines.length === 1 && lines[0]?.points.length" :d="`${path(lines[0])} L${x(lines[0].points.at(-1)![0])},235 L${x(lines[0].points[0]![0])},235 Z`" :fill="`url(#${id}-fill)`" />
        <g v-for="line in lines" :key="line.name">
          <path :d="path(line)" fill="none" :stroke="line.color" stroke-width="2.7" stroke-linejoin="round" />
          <circle v-for="[p, v] in line.points" :key="p" :cx="x(p)" :cy="y(v)" r="4" :fill="line.color" class="chart-point">
            <title>{{ line.name }} · {{ periodLabel(p, frequency) }}: {{ number(v, 2) }} {{ unit }}</title>
          </circle>
          <circle v-if="line.points.at(-1)" :cx="x(line.points.at(-1)![0])" :cy="y(line.points.at(-1)![1])" r="4" :fill="line.color" stroke="white" stroke-width="2" />
        </g>
        <text v-for="index in labelIndices" :key="index" :x="x(periods[index]!)" y="269" :text-anchor="index === 0 ? 'start' : index === periods.length - 1 ? 'end' : 'middle'">{{ periodLabel(periods[index]!, frequency) }}</text>
      </svg>
      <div class="chart-bottom">
        <div class="legend"><span v-for="line in lines" :key="line.name"><i :style="{ background: line.color }"></i>{{ line.name }}</span></div>
        <button class="text-button" :aria-expanded="tableOpen" @click="tableOpen = !tableOpen">{{ tableOpen ? 'Ocultar tabla' : 'Ver datos en tabla' }}</button>
      </div>
      <div v-if="tableOpen" class="table-scroll chart-table" tabindex="0" aria-label="Tabla de valores">
        <table><caption>{{ title }} · {{ unit }}</caption><thead><tr><th>Periodo</th><th v-for="line in lines" :key="line.name">{{ line.name }}</th></tr></thead>
          <tbody><tr v-for="period in [...periods].reverse()" :key="period"><th>{{ periodLabel(period, frequency) }}</th><td v-for="line in lines" :key="line.name">{{ line.points.find(p => p[0] === period) ? number(line.points.find(p => p[0] === period)![1], 2) : '—' }}</td></tr></tbody>
        </table>
      </div>
    </template>
  </div>
</template>
