<script setup lang="ts">
import { computed, onMounted, ref, useId } from 'vue'
import type { FinanceMonth, FinanceSnapshot } from '../types'
import { actualFinanceTotals, financeBulletinUrl, financeMonths, validateFinanceSnapshot } from '../lib/finance.mjs'
import { dateLabel, number } from '../lib/format'

const data = ref<FinanceSnapshot | null>(null)
const selectedYear = ref(0)
const loading = ref(false)
const error = ref('')
const tableOpen = ref(false)
const showForecast = ref(false)
const id = useId()
const base = import.meta.env.BASE_URL
const entry = computed(() => data.value?.years.find(row => row.year === selectedYear.value))
const actual = computed(() => entry.value?.months.filter(row => row.status === 'actual') ?? [])
const forecast = computed(() => entry.value?.months.filter(row => row.status === 'forecast') ?? [])
const rows = computed(() => entry.value?.months.filter(row => showForecast.value || row.status === 'actual') ?? [])
const totals = computed(() => actualFinanceTotals(actual.value))
const maximum = computed(() => Math.max(1, ...rows.value.flatMap(row => [row.redemptions, row.emissions ?? 0])))
const ticks = computed(() => Array.from({ length: 5 }, (_, index) => maximum.value * index / 4))
const height = (value: number) => value / maximum.value * 205
const x = (month: number) => 80 + (month - 1) * 65
const publicationLabel = computed(() => data.value ? `${financeMonths[Number(data.value.publication.slice(5)) - 1]} de ${data.value.publication.slice(0, 4)}` : '')
const period = computed(() => `enero–${financeMonths[(actual.value.at(-1)?.month ?? 1) - 1]?.toLowerCase()} de ${selectedYear.value}`)
const stale = computed(() => {
  if (!data.value) return false
  const end = new Date(`${data.value.publication}-01T00:00:00Z`)
  end.setUTCMonth(end.getUTCMonth() + 1)
  return Date.now() - end.getTime() > 65 * 86400000
})
const instruments = [
  { key: 'letras', label: 'Letras' }, { key: 'bonos', label: 'Bonos' },
  { key: 'obligaciones', label: 'Obligaciones' }, { key: 'indexados', label: 'Indexados' },
  { key: 'resto', label: 'Resto y asumidas' },
] as const
const rowLabel = (row: FinanceMonth) => `${financeMonths[row.month - 1]} de ${selectedYear.value}: ${
  row.status === 'forecast' ? 'previsión de amortizaciones' : 'amortizaciones realizadas'
}, ${number(row.redemptions, 1)} millones de euros.${
  row.emissions === null ? ' Emisiones y financiación neta no disponibles.' : ` Emisiones: ${number(row.emissions, 1)}. Financiación neta: ${number(row.net!, 1)} millones.`
}`
async function load() {
  loading.value = true
  error.value = ''
  try {
    const response = await fetch(`${base}data/tesoro-finance.json`, { cache: 'no-cache' })
    if (!response.ok) throw new Error(`No se pudo cargar la financiación del Tesoro (HTTP ${response.status}).`)
    const json: unknown = await response.json()
    validateFinanceSnapshot(json)
    data.value = json
    if (!json.years.some(entry => entry.year === selectedYear.value)) selectedYear.value = Math.max(...json.years.map(entry => entry.year))
  } catch (cause) {
    console.error('Error al cargar la financiación del Tesoro', cause)
    error.value = cause instanceof Error ? cause.message : 'Error desconocido al cargar la financiación del Tesoro.'
  } finally { loading.value = false }
}
onMounted(load)
</script>

<template>
  <section class="panel finance-panel" aria-label="Amortizaciones realizadas y financiación del año">
    <div class="panel-header">
      <div><h2>Amortizaciones realizadas y financiación del año</h2><p>Flujos del Tesoro, no saldos pendientes de vencer. Este panel no cambia con la fotografía histórica seleccionada arriba.</p></div>
    </div>
    <div v-if="error" class="notice warning" role="alert">
      <p>{{ error }}</p><p>Actualización: <code>npm run data:sync:tesoro:finance</code>.</p>
      <button class="secondary-button" :disabled="loading" @click="load">Reintentar financiación</button>
    </div>
    <p v-else-if="loading" class="notice" role="status">Cargando amortizaciones y financiación…</p>
    <template v-else-if="data && entry">
      <div class="finance-controls">
        <label :for="`${id}-year`">Ejercicio
          <select :id="`${id}-year`" v-model="selectedYear"><option v-for="year in data.years" :key="year.year" :value="year.year">{{ year.year }}</option></select>
        </label>
        <span>Edición del boletín: {{ publicationLabel }} · Realizados: {{ period }}.</span>
      </div>
      <p v-if="stale" class="notice warning" role="status">El último mes del boletín tiene más de 65 días de antigüedad. Los datos no se actualizan en tiempo real; sincroniza la fuente para comprobar nuevas publicaciones.</p>
      <div class="finance-totals" aria-live="polite">
        <div><span>Amortizado · {{ period }}</span><strong>{{ number(totals.redemptions / 1000, 1) }}</strong><small>Miles de millones € · realizado</small></div>
        <div><span>Emitido · {{ period }}</span><strong>{{ number(totals.emissions / 1000, 1) }}</strong><small>Miles de millones € · realizado</small></div>
        <div><span>Financiación neta · {{ period }}</span><strong>{{ number(totals.net / 1000, 1) }}</strong><small>Miles de millones € · emisiones − amortizaciones</small></div>
      </div>
      <p class="footnote">Los tres indicadores excluyen las previsiones. Amortizar principal no implica reducir la deuda en ese importe: las nuevas emisiones pueden refinanciar los vencimientos.</p>
      <div class="finance-controls">
        <label v-if="forecast.length"><input v-model="showForecast" type="checkbox"> Mostrar también previsiones de amortización (no se suman a lo realizado)</label>
        <button class="text-button" :aria-expanded="tableOpen" :aria-controls="`${id}-table`" @click="tableOpen = !tableOpen">{{ tableOpen ? 'Ocultar tabla de financiación' : 'Ver tabla de financiación' }}</button>
      </div>
      <div class="chart-unit">Miles de millones de euros · Barras mensuales · La escala se adapta al ejercicio y a las previsiones visibles.</div>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Gráfico mensual de emisiones y amortizaciones, desplazable horizontalmente">
        <svg viewBox="0 0 880 285" class="finance-chart" role="img" :aria-labelledby="`${id}-title ${id}-desc`">
          <title :id="`${id}-title`">Emisiones y amortizaciones mensuales de {{ selectedYear }}</title>
          <desc :id="`${id}-desc`">Las barras verdes son emisiones realizadas y las azules amortizaciones realizadas. Las previsiones opcionales se dibujan solo con contorno discontinuo. Importes exactos y desglose por instrumentos en la tabla.</desc>
          <g v-for="tick in ticks" :key="tick">
            <line x1="65" x2="865" :y1="235 - height(tick)" :y2="235 - height(tick)" stroke="#e8ece8" stroke-dasharray="3 5" />
            <text x="57" :y="239 - height(tick)" text-anchor="end">{{ number(tick / 1000, 1) }}</text>
          </g>
          <g v-for="row in rows" :key="row.month" tabindex="0" role="img" :aria-label="rowLabel(row)" class="finance-bar">
            <title>{{ rowLabel(row) }}</title>
            <rect :x="x(row.month)" y="25" width="46" height="212" fill="transparent" />
            <rect v-if="row.emissions !== null" :x="x(row.month)" :y="235 - height(row.emissions)" width="20" :height="height(row.emissions)" fill="#24715b" />
            <rect :x="x(row.month) + 23" :y="235 - height(row.redemptions)" width="20" :height="height(row.redemptions)" :fill="row.status === 'actual' ? '#416c91' : 'none'" stroke="#416c91" :stroke-dasharray="row.status === 'forecast' ? '4 3' : undefined" />
            <text :x="x(row.month) + 22" y="257" text-anchor="middle">{{ financeMonths[row.month - 1]?.slice(0, 3) }}</text>
            <text v-if="row.status === 'forecast'" :x="x(row.month) + 22" y="274" text-anchor="middle">Prev.</text>
          </g>
        </svg>
      </div>
      <div class="legend finance-legend"><span><i style="background:#24715b"></i>Emisiones realizadas</span><span><i style="background:#416c91"></i>Amortizaciones realizadas</span><span v-if="showForecast && forecast.length">Contorno discontinuo: previsión de amortización; no hay datos de emisiones ni financiación neta para esos meses.</span></div>
      <div v-if="tableOpen" :id="`${id}-table`" class="table-scroll chart-table" tabindex="0" aria-label="Tabla mensual de financiación">
        <table>
          <caption>{{ selectedYear }} · Millones de euros · Amortizaciones por instrumento</caption>
          <thead><tr><th scope="col">Mes / estado</th><th scope="col">Emisiones</th><th scope="col">Amortizaciones</th><th scope="col">Financiación neta</th><th v-for="instrument in instruments" :key="instrument.key" scope="col">{{ instrument.label }}</th></tr></thead>
          <tbody><tr v-for="row in rows" :key="row.month"><th scope="row">{{ financeMonths[row.month - 1] }} · {{ row.status === 'actual' ? 'Realizado' : 'Previsión' }}</th><td>{{ row.emissions === null ? 'No disponible' : number(row.emissions, 1) }}</td><td>{{ number(row.redemptions, 1) }}</td><td>{{ row.net === null ? 'No disponible' : number(row.net, 1) }}</td><td v-for="instrument in instruments" :key="instrument.key">{{ number(row.instruments[instrument.key], 1) }}</td></tr></tbody>
          <tfoot><tr><th scope="row">Total realizado · {{ period }}</th><td>{{ number(totals.emissions, 1) }}</td><td>{{ number(totals.redemptions, 1) }}</td><td>{{ number(totals.net, 1) }}</td><td v-for="instrument in instruments" :key="instrument.key">{{ number(totals.instruments[instrument.key]!, 1) }}</td></tr></tfoot>
        </table>
      </div>
      <div class="finance-method prose">
        <h3>Por qué no se suma directamente al calendario pendiente</h3>
        <p>El cuadro 13 expresa importes efectivos de deuda del Estado, incluido «resto y asumidas». El perfil superior utiliza saldos en circulación de letras, bonos y obligaciones con otras fechas y cobertura. No son magnitudes directamente conciliables ni incluyen los intereses como principal amortizado.</p>
        <p>El Tesoro contabiliza las emisiones por su nominal cuando el efectivo es superior; la diferencia se registra en el capítulo 3 de ingresos. Se conserva esta convención del cuadro, no se presenta como un flujo de caja íntegro.</p>
        <p>El desglose no identifica ISIN ni separa por sí solo recompras y vencimientos ordinarios. No permite atribuir cada cambio entre fotografías a un pago concreto. El «total año» del original incluye meses futuros: aquí solo se acumulan los meses realizados hasta el corte de la edición, no hasta la fecha de descarga.</p>
      </div>
      <div class="panel-footer"><span>Fuente: Tesoro Público · Cuadro 13 · Descarga: {{ dateLabel(data.retrievedAt) }}</span><div class="source-links"><a :href="financeBulletinUrl" target="_blank" rel="noopener noreferrer">Boletín oficial ↗</a><a :href="data.source.pdfUrl" target="_blank" rel="noopener noreferrer">PDF ↗</a><a :href="data.source.url" target="_blank" rel="noopener noreferrer">Excel oficial ↗</a><a :href="`${base}${data.source.rawUrl}`" download>Excel guardado ↓</a><a :href="`${base}${data.source.bulletinRawUrl}`" download>Edición guardada ↓</a></div></div>
    </template>
  </section>
</template>

<style scoped>
.finance-controls{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:18px 0;font-size:12px;line-height:1.8}
.finance-controls label{display:flex;align-items:center;gap:10px}
.finance-totals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px;margin-top:20px}
.finance-totals>div{padding:18px;background:#f3f6f0;border-radius:8px;display:flex;flex-direction:column;gap:8px}
.finance-totals span,.finance-totals small{font-size:11px;line-height:1.7;color:#52614b}
.finance-totals strong{font-size:29px;color:#24715b}
.finance-chart{display:block;width:100%;min-width:880px}
.finance-chart text{font-family:"Segoe UI",sans-serif;font-size:11px;fill:#52614b}
.finance-bar:focus rect,.finance-bar:hover rect{stroke-width:2}
.finance-legend{flex-wrap:wrap;margin:12px 0;line-height:1.8}
.finance-method{margin-top:24px}
.finance-panel .panel-footer{flex-wrap:wrap;gap:12px}
.source-links{flex-wrap:wrap}
@media(max-width:760px){.finance-totals{grid-template-columns:1fr}.finance-controls{align-items:flex-start}.finance-controls label{flex-wrap:wrap}}
</style>
