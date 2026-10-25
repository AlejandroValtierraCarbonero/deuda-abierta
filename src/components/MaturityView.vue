<script setup lang="ts">
import { computed, onMounted, ref, useId, watch } from 'vue'
import type { MaturitySnapshot } from '../types'
import { annualMaturities, validateMaturityHistory, validateMaturitySnapshot } from '../lib/maturities.mjs'
import { dateLabel, number } from '../lib/format'
import AppIcon from './AppIcon.vue'
import FinancePanel from './FinancePanel.vue'

const current = ref<MaturitySnapshot | null>(null)
const historical = ref<MaturitySnapshot[]>([])
const selection = ref(new URLSearchParams(location.search).get('tesoroFoto') ?? 'actual')
const data = computed(() => selection.value === 'actual' ? current.value
  : historical.value.find(snapshot => snapshot.source.archive?.capturedAt === selection.value) ?? null)
const loading = ref(false)
const error = ref('')
const tableOpen = ref(false)
const activeYear = ref<number | null>(null)
const id = useId()
const base = import.meta.env.BASE_URL
const rows = computed(() => data.value ? annualMaturities(data.value.securities) : [])
const chartWidth = computed(() => Math.max(680, rows.value.length * 34 + 100))
const maximum = computed(() => Math.max(1, ...rows.value.map(row => row.total)))
const ticks = computed(() => Array.from({ length: 5 }, (_, i) => maximum.value * i / 4))
const height = (amount: number) => amount / maximum.value * 245
const x = (index: number) => 80 + index * (chartWidth.value - 100) / rows.value.length
const active = computed(() => rows.value.find(row => row.year === activeYear.value))
const reference = computed(() => data.value ? [data.value.referenceDates.letras, data.value.referenceDates.bonos].sort()[0]! : '')
const stale = computed(() => selection.value === 'actual' && reference.value && Date.now() - Date.parse(reference.value) > 35 * 86400000)
const rowLabel = (row: { year: number; letras: number; bonos: number; total: number }) =>
  `${row.year}: letras ${number(row.letras, 1)}, bonos y obligaciones ${number(row.bonos, 1)}, total ${number(row.total, 1)} millones de euros.`

async function load() {
  loading.value = true
  error.value = ''
  try {
    const responses = await Promise.all(['maturities.json', 'maturity-history.json'].map(file =>
      fetch(`${base}data/${file}`, { cache: 'no-cache' })))
    for (const response of responses) {
      if (!response.ok) throw new Error(`No se pudieron cargar los vencimientos (HTTP ${response.status}).`)
    }
    const json: unknown = await responses[0]!.json()
    const history: unknown = await responses[1]!.json()
    validateMaturitySnapshot(json)
    validateMaturityHistory(history)
    if (selection.value !== 'actual' && !history.snapshots.some(snapshot => snapshot.source.archive?.capturedAt === selection.value)) {
      throw new Error('La captura histórica del enlace no está disponible. Selecciona la vista actual.')
    }
    current.value = json
    historical.value = [...history.snapshots].sort((a, b) => b.source.archive!.capturedAt.localeCompare(a.source.archive!.capturedAt))
  } catch (cause) {
    console.error('Error al cargar los vencimientos del Tesoro', cause)
    error.value = cause instanceof Error ? cause.message : 'Error desconocido al cargar los vencimientos.'
  } finally { loading.value = false }
}
watch(selection, value => {
  activeYear.value = null
  const params = new URLSearchParams(location.search)
  if (value === 'actual') params.delete('tesoroFoto')
  else params.set('tesoroFoto', value)
  const query = params.toString()
  history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`)
})
function showCurrent() {
  selection.value = 'actual'
  load()
}
onMounted(load)
</script>

<template>
  <section v-if="error" class="notice warning" role="alert">
    <p>{{ error }}</p>
    <p>La actualización de esta fuente se realiza con <code>npm run data:sync:tesoro</code>.</p>
    <button class="secondary-button" :disabled="loading" @click="load">Reintentar</button>
    <button v-if="selection !== 'actual'" class="secondary-button" :disabled="loading" @click="showCurrent">Ver vista actual</button>
  </section>
  <p v-else-if="loading" class="notice" role="status">Cargando vencimientos del Tesoro…</p>
  <template v-else-if="data">
    <section class="panel history-selector">
      <label :for="`${id}-snapshot`">Ver el perfil tal como era en
        <select :id="`${id}-snapshot`" v-model="selection">
          <option value="actual">Vista actual · última descarga del Tesoro</option>
          <option v-for="snapshot in historical" :key="snapshot.source.archive!.capturedAt" :value="snapshot.source.archive!.capturedAt">Captura del {{ dateLabel(snapshot.source.archive!.capturedAt) }}</option>
        </select>
      </label>
      <p>Elige una fotografía real del listado de valores de aquella época, no un filtro sobre la deuda actual. Hay una captura por año entre 2019 y 2025; no son cierres anuales ni una serie mensual completa.</p>
    </section>
    <div class="context-bar maturity-context">
      <div><span class="status-dot"></span><strong>Valores del Estado · Tesoro Público</strong></div>
      <span>Letras: {{ dateLabel(data.referenceDates.letras) }} · Bonos y obligaciones: {{ dateLabel(data.referenceDates.bonos) }}</span>
    </div>
    <div v-if="data.source.archive" class="notice" role="status">
      <strong>Vista histórica · captura del {{ dateLabel(data.source.archive.capturedAt) }}.</strong>
      Copia del sitio oficial del Tesoro conservada por Internet Archive. Las fechas de los saldos son las indicadas arriba, no la fecha de captura ni la de descarga.
      <a class="text-button" :href="data.source.archive.url" target="_blank" rel="noopener noreferrer">Consultar captura archivada ↗</a>
    </div>
    <p v-if="stale" class="notice warning" role="status">Hay datos de referencia con más de 35 días de antigüedad. El perfil no se actualiza en tiempo real; sincroniza la fuente del Tesoro para comprobar cambios.</p>
    <section class="panel">
      <div class="panel-header">
        <div><h2>Vencimientos de deuda del Estado por año</h2><p>Saldo en circulación de letras, bonos y obligaciones agrupado por su fecha de vencimiento.</p></div>
        <button class="text-button" :aria-expanded="tableOpen" :aria-controls="`${id}-table`" @click="tableOpen = !tableOpen">{{ tableOpen ? 'Ocultar tabla' : 'Ver datos en tabla' }}</button>
      </div>
      <div class="info-strip"><AppIcon name="info" :size="18" /><span>No es el total de deuda pública PDE: solo incluye los valores publicados en el listado del Tesoro. No incluye deuda autonómica o local, préstamos ni intereses. Son saldos vivos en las fechas de referencia seleccionadas, no una previsión de emisiones futuras.</span></div>
      <div class="maturity-chart">
        <div class="chart-unit">Miles de millones de euros · Desplázate horizontalmente para ver todos los años.</div>
        <div class="table-scroll maturity-scroll" tabindex="0" role="region" aria-label="Gráfico de vencimientos anuales, desplazable horizontalmente">
          <svg :viewBox="`0 0 ${chartWidth} 330`" :style="{ minWidth: `${chartWidth}px` }" role="img" :aria-labelledby="`${id}-title ${id}-desc`" class="maturity-svg">
            <title :id="`${id}-title`">Vencimientos anuales de valores del Estado, {{ rows[0]?.year }}–{{ rows.at(-1)?.year }}</title>
            <desc :id="`${id}-desc`">Barras apiladas de letras y bonos y obligaciones. La tabla contiene los importes exactos. Los años sin valores con vencimiento en el listado se representan con cero.</desc>
            <g v-for="tick in ticks" :key="tick">
              <line x1="70" :x2="chartWidth - 15" :y1="275 - height(tick)" :y2="275 - height(tick)" stroke="#e8ece8" stroke-dasharray="3 5" />
              <text x="60" :y="279 - height(tick)" text-anchor="end">{{ number(tick / 1000) }}</text>
            </g>
            <g v-for="(row, index) in rows" :key="row.year" tabindex="0" role="img" :aria-label="rowLabel(row)" class="maturity-bar" @mouseenter="activeYear = row.year" @focus="activeYear = row.year">
              <title>{{ rowLabel(row) }}</title>
              <rect :x="x(index)" y="28" width="24" height="249" fill="transparent" />
              <rect :x="x(index)" :y="275 - height(row.letras)" width="24" :height="height(row.letras)" fill="#809d55" />
              <rect :x="x(index)" :y="275 - height(row.total)" width="24" :height="height(row.bonos)" fill="#24715b" />
              <text :x="x(index) + 12" y="299" text-anchor="middle">{{ row.year }}</text>
            </g>
          </svg>
        </div>
        <div class="chart-bottom"><div class="legend"><span><i style="background: #809d55"></i>Letras</span><span><i style="background: #24715b"></i>Bonos y obligaciones</span></div></div>
        <p class="maturity-detail" aria-live="polite">{{ active ? rowLabel(active) : 'Sitúa el cursor sobre una barra o enfócala con el teclado para consultar su importe.' }}</p>
        <div v-if="tableOpen" :id="`${id}-table`" class="table-scroll chart-table" tabindex="0" aria-label="Tabla de vencimientos anuales">
          <table>
            <caption>Saldo vivo por año de vencimiento · Millones de euros</caption>
            <thead><tr><th scope="col">Año</th><th scope="col">Letras</th><th scope="col">Bonos y obligaciones</th><th scope="col">Total</th></tr></thead>
            <tbody><tr v-for="row in rows" :key="row.year"><th scope="row">{{ row.year }}</th><td>{{ number(row.letras, 1) }}</td><td>{{ number(row.bonos, 1) }}</td><td>{{ number(row.total, 1) }}</td></tr></tbody>
          </table>
        </div>
      </div>
      <p class="footnote">El primer año solo recoge vencimientos de valores aún vivos en las fechas de referencia, no amortizaciones ya realizadas. Cero significa que no hay valores con vencimiento ese año en este listado, no que toda la deuda del Estado carezca de vencimientos. La escala vertical se adapta a cada captura: compara los importes, no solo la altura de las barras.</p>
      <div class="panel-footer"><span>Fuente: Tesoro Público · Descarga: {{ dateLabel(data.retrievedAt) }}</span><div class="source-links"><a :href="data.source.url" target="_blank" rel="noopener noreferrer">Listado oficial ↗</a><a :href="`${base}${data.source.rawUrl}`" download>Original guardado ↓</a></div></div>
    </section>
    <section class="panel prose">
      <h2>Cómo interpretar este perfil</h2>
      <p>Se suma una sola vez el saldo en circulación de cada ISIN en el año de su vencimiento. Letras y bonos tienen sus propias fechas de referencia; este perfil no constituye una fotografía a una única fecha ni se suma a la deuda PDE del Banco de España.</p>
      <p>Los bonos indexados se muestran con el saldo ajustado publicado por el Tesoro. La inflación futura puede modificar el importe final de amortización. No se añade el valor facial al saldo ni se cuentan los cupones como principal.</p>
      <p>Las nuevas emisiones, reaperturas, recompras y amortizaciones cambian el perfil. La descarga se guarda localmente para que esta vista no dependa del acceso en directo al Tesoro.</p>
      <p>Las vistas históricas se calculan a partir de los ISIN y saldos realmente publicados en cada captura archivada. No se reconstruyen restando vencimientos a la foto actual. Algunas capturas contienen datos del mes o año anterior: por ejemplo, la del 7 de enero de 2019 conserva saldos de diciembre de 2018.</p>
    </section>
  </template>
  <FinancePanel />
</template>

<style scoped>
.maturity-context{line-height:1.8}
.history-selector{padding:20px 25px}
.history-selector label{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:12px;font-weight:600}
.history-selector p{font-size:11px;line-height:1.8;color:#687660;margin:12px 0 0}
.maturity-chart{padding:20px 20px 0}
.maturity-scroll{margin-top:12px}
.maturity-svg{display:block;width:100%}
.maturity-svg text{font-family:"Segoe UI",sans-serif;font-size:11px;fill:#66765c}
.maturity-bar:hover rect:not(:first-of-type),.maturity-bar:focus rect:not(:first-of-type){filter:brightness(.8)}
.maturity-detail{font-size:11px;color:#65755d;line-height:1.8;min-height:40px}
.panel-header .text-button{flex-shrink:0}
@media(max-width:760px){.panel-header{flex-wrap:wrap}.maturity-chart{padding:15px 12px 0}}
</style>
