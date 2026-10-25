<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Snapshot, Series } from '../types'
import { requiredSeries, lineFor, palette } from '../lib/data'
import { valueAt, annualChange, yearAgo, seriesCsv } from '../lib/metrics.mjs'
import { maturitySourceUrl } from '../lib/maturities.mjs'
import { number, periodLabel, displayValue, dateLabel } from '../lib/format'
import AppIcon from './AppIcon.vue'
import TimeChart from './TimeChart.vue'
import MaturityView from './MaturityView.vue'

const props = defineProps<{ data: Snapshot }>()
const nav = [
  { id: 'resumen', label: 'Vista general', icon: 'grid', title: 'La deuda, en perspectiva.', subtitle: 'Una mirada clara a las finanzas públicas de España.' },
  { id: 'territorios', label: 'Administraciones y territorios', icon: 'map', title: 'Un país, distintas realidades.', subtitle: 'Explora la deuda de las administraciones y compara comunidades autónomas.' },
  { id: 'composicion', label: 'Tenedores y plazos', icon: 'layers', title: 'Más allá de la cifra.', subtitle: 'Quién tiene la deuda, cómo se instrumenta y qué plazos tiene.' },
  { id: 'cambios', label: 'Por qué cambia', icon: 'flow', title: 'Entender el movimiento.', subtitle: 'Del déficit a la deuda: las piezas que explican su variación.' },
  { id: 'mercados', label: 'Financiación y mercados', icon: 'chart', title: 'El pulso de la financiación.', subtitle: 'Emisiones de valores y rendimientos en el mercado secundario.' },
  { id: 'vencimientos', label: 'Vencimientos por año', icon: 'clock', title: 'La deuda, en el calendario.', subtitle: 'Perfil anual de vencimientos de los valores del Estado publicados por el Tesoro Público.' },
  { id: 'explorador', label: 'Explorador de datos', icon: 'search', title: 'Los datos, sin barreras.', subtitle: 'Consulta, visualiza y descarga las series que hay detrás del observatorio.' },
  { id: 'metodologia', label: 'Fuentes y metodología', icon: 'book', title: 'La confianza está en el detalle.', subtitle: 'Definiciones, trazabilidad y límites para interpretar los datos con rigor.' },
]
const params = new URLSearchParams(location.search)
const section = ref(nav.some(n => n.id === location.hash.slice(1)) ? location.hash.slice(1) : 'resumen')
const menuOpen = ref(false)
const mobile = ref(false)
const mobileMedia = window.matchMedia('(max-width: 760px)')
const updateMobile = () => { mobile.value = mobileMedia.matches }
const currentNav = computed(() => nav.find(n => n.id === section.value)!)
const get = (table: string, code: string) => requiredSeries(props.data, table, code)
const debt = get('be1112', 'DTNPDE2010_P00000_PS_APU')
const debtRatio = get('be1112', 'DTNPDE2010_P0000P_PS_APU')
const monthly = get('be11b', 'DMNPDE2010_P00000_PS_APU')
const periods = debt.points.map(p => p[0]).filter(p => valueAt(debtRatio, p) !== null).reverse()
const period = ref(periods.includes(params.get('periodo') ?? '') ? params.get('periodo')! : periods[0]!)
const years = ref([0, 5, 10, 20].includes(Number(params.get('anos') ?? 10)) ? Number(params.get('anos') ?? 10) : 10)
const unit = ref(params.get('unidad') === 'ratio' ? 'ratio' : 'euros')
const comparisonPeriod = ref(periods.includes(params.get('comparar') ?? '') ? params.get('comparar')! : periods[Math.min(4, periods.length - 1)]!)
const comparison = computed(() => {
  const before = valueAt(debt, comparisonPeriod.value)
  const beforeRatio = valueAt(debtRatio, comparisonPeriod.value)
  if (before === null || beforeRatio === null || total.value === null || ratio.value === null) return null
  return { absolute: total.value - before, percent: (total.value / before - 1) * 100, ratio: ratio.value - beforeRatio }
})
const total = computed(() => valueAt(debt, period.value))
const ratio = computed(() => valueAt(debtRatio, period.value))
const change = computed(() => annualChange(debt, period.value))
const ratioChange = computed(() => {
  const old = valueAt(debtRatio, yearAgo(period.value))
  return old === null || ratio.value === null ? null : ratio.value - old
})
const overviewLines = computed(() => [lineFor(unit.value === 'ratio' ? debtRatio : debt, unit.value === 'ratio' ? 'Deuda / PIB' : 'Deuda pública consolidada', period.value, years.value, unit.value === 'ratio')])
const latestMonthly = monthly.points.at(-1)!
const staleDays = Math.floor((Date.now() - Date.parse(props.data.retrievedAt)) / 86400000)
const subsectors = [
  { name: 'Administración Central', suffix: 'AEC', color: palette[0] },
  { name: 'Comunidades autónomas', suffix: 'ACS', color: palette[1] },
  { name: 'Corporaciones locales', suffix: 'ALS', color: palette[2] },
  { name: 'Seguridad Social', suffix: 'ASG', color: palette[3] },
].map(s => ({ ...s, series: get('be1104', `DTNPDE2010_P00000_PS_${s.suffix}`) }))
const sectorValues = computed(() => subsectors.map(s => ({ ...s, value: valueAt(s.series, period.value) })))
const maxSector = computed(() => Math.max(1, ...sectorValues.value.map(s => s.value ?? 0)))
const regionUnit = ref(params.get('regionUnidad') === 'euros' ? 'euros' : 'ratio')
const regionCodes = ref<string[]>((params.get('regiones') ?? 'ACT,AMA,AVA').split(',').filter(c => /^A[A-Z]{2}$/.test(c)))
const regionSeries = computed(() => props.data.series.filter(s => s.table === (regionUnit.value === 'ratio' ? 'be1310' : 'be1309') && /_ACS_A[A-Z]{2}$/.test(s.code)))
const regionName = (s: Series) => s.description.replace(/^PDE \(SEC 2010\)\. CCAA\. /, '').replace(/\. Deuda PDE\..*$/, '')
const regions = computed(() => regionSeries.value.map(s => ({ code: s.code.slice(-3), name: regionName(s), series: s, value: valueAt(s, period.value) })).sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity)))
const maxRegion = computed(() => Math.max(1, ...regions.value.map(r => r.value ?? 0)))
const regionLines = computed(() => regions.value.filter(r => regionCodes.value.includes(r.code)).map((r, i) => lineFor(r.series, r.name, period.value, years.value, regionUnit.value === 'ratio', palette[i % palette.length])))
function toggleRegion(code: string) {
  regionCodes.value = regionCodes.value.includes(code) ? regionCodes.value.filter(c => c !== code) : [...regionCodes.value, code]
}
const compositionTab = ref(['tenedores', 'instrumentos', 'plazos'].includes(params.get('composicion') ?? '') ? params.get('composicion')! : 'tenedores')
const compositionGroups = computed(() => {
  if (compositionTab.value === 'instrumentos') return [
    { name: 'Valores representativos de deuda', code: 'F30000', table: 'be1112' },
    { name: 'Préstamos', code: 'F40000', table: 'be1112' },
    { name: 'Efectivo y depósitos', code: 'F20000', table: 'be1112' },
  ]
  if (compositionTab.value === 'plazos') return [
    { name: 'Valores · hasta 1 año', code: 'F30PRC', table: 'be1113' },
    { name: 'Valores · más de 1 año', code: 'F30PRL', table: 'be1113' },
    { name: 'Préstamos · hasta 1 año', code: 'F40PRC', table: 'be1113' },
    { name: 'Préstamos · más de 1 año', code: 'F40PRL', table: 'be1113' },
  ]
  // El Banco de Espana es un subconjunto de instituciones financieras, no una categoria adicional.
  return [
    { name: 'Instituciones financieras (incluye BdE)', code: 'P00020', table: 'be1113' },
    { name: 'Otros sectores residentes', code: 'P00050', table: 'be1113' },
    { name: 'Resto del mundo', code: 'P00060', table: 'be1113' },
  ]
})
const compositionItems = computed(() => compositionGroups.value.map((g, i) => {
  const series = get(g.table, `DTNPDE2010_${g.code}_PS_APU`)
  const value = valueAt(series, period.value)
  return { ...g, series, value, percent: value === null || total.value === null ? null : value / total.value * 100, color: palette[i]! }
}))
const compositionLines = computed(() => compositionItems.value.map(i => lineFor(i.series, i.name, period.value, years.value, false, i.color)))
const centralBank = get('be1113', 'DTNPDE2010_P00040_PS_APU')
const flowCodes = [
  ['Necesidad de financiación', 'DTNSEC2010_S0000N_APU'],
  ['Adquisición neta de activos financieros', 'DTNSEC2010_A00000_AF_APU'],
  ['Ajustes déficit-deuda', 'DTNPDE2010_AJO000_PF_APU'],
]
const flow = computed(() => {
  let cumulative = 0
  return flowCodes.map(([name, code]) => {
    const value = valueAt(get('be1108', code!), period.value)
    const start = cumulative
    if (value !== null) cumulative += value / 1e6
    return { name: name!, value: value === null ? null : value / 1e6, start, end: cumulative }
  })
})
const flowTotal = computed(() => valueAt(get('be1108', 'DTNPDE2010_P00000_PF_APU'), period.value))
const flowReady = computed(() => flow.value.every(f => f.value !== null) && flowTotal.value !== null)
const flowBounds = computed(() => {
  const vals = [0, ...flow.value.flatMap(f => [f.start, f.end]), (flowTotal.value ?? 0) / 1e6]
  return { min: Math.min(...vals), max: Math.max(...vals, 1) }
})
const flowY = (v: number) => 235 - (v - flowBounds.value.min) / (flowBounds.value.max - flowBounds.value.min) * 180
const yields = props.data.series.filter(s => s.table === 'be2207' && s.unit === 'Porcentaje')
const yieldSeries = ref(params.get('rendimiento') && yields.some(s => s.code === params.get('rendimiento')) ? params.get('rendimiento')! : yields[2]!.code)
const selectedYield = computed(() => yields.find(s => s.code === yieldSeries.value)!)
const marketPeriod = ref(params.get('mes') && /^\d{4}-\d{2}$/.test(params.get('mes')!) ? params.get('mes')! : yields[2]!.points.at(-1)![0])
const gross = get('be2108', 'DVL.M.N.ES.W0.S13.S1.N.LI.F.F3.T._Z.EUR._T.M.V.N._T')
const net = get('be2109', 'DVL.M.N.ES.W0.S13.S1.N.L.F.F3.T._Z.EUR._T.M.V.N._T')
const marketPeriods = [...new Set([...gross.points, ...yields.flatMap(s => s.points)].map(p => p[0]))].sort().reverse()
const marketLines = computed(() => [lineFor(gross, 'Emisiones brutas · AAPP', marketPeriod.value, years.value), lineFor(net, 'Emisiones netas · AAPP', marketPeriod.value, years.value, false, palette[2])])
const query = ref(params.get('buscar') ?? '')
const explorerTable = ref(props.data.sources.some(s => s.id === params.get('cuadro')) ? params.get('cuadro')! : '')
const explorerUnit = ref(params.get('filtroUnidad') ?? '')
const explorerFrequency = ref(params.get('frecuencia') ?? '')
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const filteredSeries = computed(() => props.data.series.filter(s => (!explorerTable.value || s.table === explorerTable.value)
  && (!explorerUnit.value || s.unit === explorerUnit.value)
  && (!explorerFrequency.value || s.frequency === explorerFrequency.value)
  && normalize(`${s.code} ${s.description}`).includes(normalize(query.value))))
const selectedKey = ref(params.get('serie') ?? 'be1112:DTNPDE2010_P00000_PS_APU')
const selectedSeries = computed(() => props.data.series.find(s => `${s.table}:${s.code}` === selectedKey.value))
const explorerVisible = computed(() => selectedSeries.value && filteredSeries.value.includes(selectedSeries.value) ? selectedSeries.value : filteredSeries.value[0])
const explorerEnd = computed(() => explorerVisible.value?.points.at(-1)?.[0] ?? period.value)
const explorerLines = computed(() => explorerVisible.value ? [lineFor(explorerVisible.value, 'Serie seleccionada', explorerEnd.value, years.value, explorerVisible.value.unit === 'Porcentaje')] : [])
const explorerUnitLabel = computed(() => explorerVisible.value?.unit.includes('euros') ? 'Miles de millones de euros' : explorerVisible.value?.unit ?? '')
const feedback = ref('')
function download(series: Series) {
  const url = URL.createObjectURL(new Blob([seriesCsv(series)], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url; link.download = `${series.table}-${series.code}.csv`
  document.body.append(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function sourceFor(table: string) { return props.data.sources.find(s => s.id === table)! }
function syncUrl() {
  const q = new URLSearchParams({
    periodo: period.value, anos: String(years.value), unidad: unit.value, regionUnidad: regionUnit.value,
    regiones: regionCodes.value.join(','), cuadro: explorerTable.value, buscar: query.value,
    serie: selectedKey.value, filtroUnidad: explorerUnit.value, frecuencia: explorerFrequency.value,
    rendimiento: yieldSeries.value, mes: marketPeriod.value, composicion: compositionTab.value, comparar: comparisonPeriod.value,
  })
  const maturitySnapshot = new URLSearchParams(location.search).get('tesoroFoto')
  if (maturitySnapshot) q.set('tesoroFoto', maturitySnapshot)
  history.replaceState(null, '', `${location.pathname}?${q}#${section.value}`)
}
async function share() {
  syncUrl()
  try { await navigator.clipboard.writeText(location.href); feedback.value = 'Enlace copiado' }
  catch (error) { console.error('No se pudo copiar el enlace', error); feedback.value = 'No se pudo copiar. Puedes copiar la dirección del navegador.' }
}
function navigate(id: string) { section.value = id; menuOpen.value = false; syncUrl(); window.scrollTo({ top: 0 }) }
function hashChanged() { const id = location.hash.slice(1); if (nav.some(n => n.id === id)) section.value = id }
function onEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && menuOpen.value) menuOpen.value = false
}
watch(menuOpen, async open => {
  await nextTick()
  document.querySelector<HTMLButtonElement>(open ? '.mobile-close' : '.mobile-toggle')?.focus()
})
watch([period, years, unit, regionUnit, regionCodes, explorerTable, query, selectedKey, explorerUnit, explorerFrequency, yieldSeries, marketPeriod, compositionTab, comparisonPeriod], syncUrl)
onMounted(() => {
  updateMobile()
  mobileMedia.addEventListener('change', updateMobile)
  window.addEventListener('hashchange', hashChanged)
  window.addEventListener('keydown', onEscape)
})
onUnmounted(() => {
  mobileMedia.removeEventListener('change', updateMobile)
  window.removeEventListener('hashchange', hashChanged)
  window.removeEventListener('keydown', onEscape)
})
const sign = (v: number) => v > 0 ? '+' : ''
</script>

<template>
  <a class="skip-link" href="#main">Saltar al contenido</a>
  <div v-if="menuOpen" class="sidebar-scrim" @click="menuOpen = false"></div>
  <aside class="sidebar" :class="{ 'is-open': menuOpen }" :inert="mobile && !menuOpen" aria-label="Navegación principal">
    <a href="#resumen" class="brand" @click.prevent="navigate('resumen')"><span class="brand-mark"><AppIcon name="chart" :size="25" /></span><span>deuda<span class="brand-light">abierta</span><small>OBSERVATORIO DE ESPAÑA</small></span></a>
    <button class="mobile-close icon-button" aria-label="Cerrar menú" @click="menuOpen = false"><AppIcon name="close" /></button>
    <div class="nav-heading">EXPLORAR LA DEUDA</div>
    <nav><a v-for="item in nav.slice(0, 6)" :key="item.id" :href="`#${item.id}`" :class="{ active: section === item.id }" :aria-current="section === item.id ? 'page' : undefined" @click.prevent="navigate(item.id)"><AppIcon :name="item.icon" /><span>{{ item.label }}</span><span v-if="section === item.id" class="active-dot"></span></a></nav>
    <div class="nav-heading second-heading">DATOS Y TRANSPARENCIA</div>
    <nav><a v-for="item in nav.slice(6)" :key="item.id" :href="`#${item.id}`" :class="{ active: section === item.id }" :aria-current="section === item.id ? 'page' : undefined" @click.prevent="navigate(item.id)"><AppIcon :name="item.icon" /><span>{{ item.label }}</span></a></nav>
    <div class="sidebar-note"><span class="small-label"><span class="status-dot"></span> DATOS OFICIALES</span><p>Información pública.<br>Una perspectiva abierta.</p><a :href="section === 'vencimientos' ? maturitySourceUrl : 'https://www.bde.es'" target="_blank" rel="noopener noreferrer">{{ section === 'vencimientos' ? 'Tesoro Público' : 'Banco de España' }} <AppIcon name="external" :size="14" /></a></div>
    <div class="sidebar-footer"><span>Un proyecto independiente</span><small>Rigor en los datos. Claridad al contarlos.</small></div>
  </aside>

  <div class="workspace" :inert="mobile && menuOpen">
    <header class="topbar">
      <button class="mobile-toggle icon-button" aria-label="Abrir menú" :aria-expanded="menuOpen" @click="menuOpen = true"><AppIcon name="menu" /></button>
      <div class="breadcrumb">Observatorio <span>/</span> <strong>{{ currentNav.label }}</strong></div>
      <div class="topbar-right"><span class="official-badge"><span class="status-dot"></span> Fuente: {{ section === 'vencimientos' ? 'Tesoro Público' : 'Banco de España' }}</span><button class="icon-button" aria-label="Ir a metodología" @click="navigate('metodologia')"><AppIcon name="info" :size="18" /></button></div>
    </header>
    <main id="main" tabindex="-1">
      <div class="page-heading">
        <div><div class="eyebrow">OBSERVATORIO DE LA DEUDA ESPAÑOLA</div><h1>{{ currentNav.title }}</h1><p>{{ currentNav.subtitle }}</p></div>
        <button class="secondary-button share-button" @click="share"><AppIcon name="external" :size="16" /> Compartir vista</button>
      </div>
      <p v-if="feedback" role="status" class="notice">{{ feedback }}</p>
      <p v-if="section !== 'vencimientos' && staleDays > 35" role="status" class="notice warning">La descarga tiene {{ staleDays }} días. Estos datos no se actualizan en tiempo real; ejecuta la sincronización para comprobar nuevas publicaciones.</p>

      <div v-if="!['explorador', 'metodologia', 'mercados', 'vencimientos'].includes(section)" class="context-bar">
        <div><span class="status-dot"></span><strong>Deuda pública · PDE</strong><span class="context-divider">|</span><span>Datos trimestrales</span></div>
        <label>Periodo de referencia <select v-model="period" aria-label="Periodo de referencia"><option v-for="p in periods" :key="p" :value="p">{{ periodLabel(p) }}</option></select></label>
      </div>

      <template v-if="section === 'resumen'">
        <section class="kpi-grid" aria-label="Indicadores principales">
          <article class="kpi-card featured"><div class="kpi-top"><span>Deuda pública total</span><AppIcon name="layers" :size="19" /></div><div class="kpi-value">{{ total === null ? '—' : number(total / 1e9, 3) }}<small>billones €</small></div><div class="kpi-bottom"><span class="subtle-tag">Consolidada</span><span>{{ periodLabel(period) }}</span></div></article>
          <article class="kpi-card"><div class="kpi-top"><span>Deuda sobre el PIB</span><span class="metric-glyph">%</span></div><div class="kpi-value">{{ ratio === null ? '—' : number(ratio) }}<small>%</small></div><div class="kpi-bottom"><span v-if="ratioChange !== null" class="change-chip" :class="{ down: ratioChange < 0 }">{{ sign(ratioChange) }}{{ number(ratioChange) }} pp</span><span>frente a {{ periodLabel(yearAgo(period)) }}</span></div></article>
          <article class="kpi-card"><div class="kpi-top"><span>Variación interanual del saldo</span><AppIcon name="flow" :size="19" /></div><div class="kpi-value">{{ change ? `${sign(change.percent)}${number(change.percent)}` : '—' }}<small>%</small></div><div class="kpi-bottom"><span v-if="change" class="change-chip">{{ sign(change.absolute) }}{{ number(change.absolute / 1e6) }} mil M€</span><span>respecto al mismo trimestre</span></div></article>
        </section>
        <section class="panel evolution-panel">
          <div class="panel-header"><div><h2>Una mirada a largo plazo</h2><p>Evolución de la deuda del conjunto de las administraciones públicas.</p></div><div class="segmented" role="group" aria-label="Unidad del gráfico"><button :class="{ selected: unit === 'euros' }" :aria-pressed="unit === 'euros'" @click="unit = 'euros'">En euros</button><button :class="{ selected: unit === 'ratio' }" :aria-pressed="unit === 'ratio'" @click="unit = 'ratio'">% del PIB</button></div></div>
          <div class="chart-toolbar"><span class="small-label">{{ unit === 'ratio' ? 'DEUDA / PIB' : 'DEUDA PÚBLICA CONSOLIDADA' }}</span><div class="range-buttons" role="group" aria-label="Rango histórico"><button v-for="range in [5, 10, 20, 0]" :key="range" :class="{ selected: years === range }" :aria-pressed="years === range" @click="years = range">{{ range ? `${range}A` : 'Todo' }}</button></div></div>
          <TimeChart :lines="overviewLines" :unit="unit === 'ratio' ? '% del PIB' : 'Miles de millones de euros'" title="Evolución de la deuda pública" />
          <div class="panel-footer"><span>Fuente: Banco de España · Cuadro 11.12 · {{ periodLabel(period) }}</span><button class="text-button" @click="download(unit === 'ratio' ? debtRatio : debt)"><AppIcon name="download" :size="15" /> Descargar serie</button></div>
        </section>
        <div class="comparison-bar"><label>Comparar {{ periodLabel(period) }} con <select v-model="comparisonPeriod" aria-label="Periodo de comparación"><option v-for="p in periods" :key="p" :value="p">{{ periodLabel(p) }}</option></select></label><span v-if="comparison">{{ sign(comparison.absolute) }}{{ number(comparison.absolute / 1e6) }} mil M€ <span class="comparison-separator">·</span> {{ sign(comparison.percent) }}{{ number(comparison.percent) }} % <span class="comparison-separator">·</span> {{ sign(comparison.ratio) }}{{ number(comparison.ratio) }} pp de PIB</span><span v-else>No hay datos comparables.</span></div>
        <div class="two-columns">
          <section class="panel"><div class="panel-header"><div><h2>¿Quién se endeuda?</h2><p>Deuda por nivel de administración.</p></div><span class="small-label">{{ periodLabel(period) }}</span></div><div class="bars"><div v-for="s in sectorValues" :key="s.name" class="bar-row"><div class="bar-label"><span>{{ s.name }}</span><strong>{{ displayValue(s.value, 'Miles de euros') }}</strong></div><div class="bar-track"><div :style="{ width: `${(s.value ?? 0) / maxSector * 100}%`, background: s.color }"></div></div></div></div><p class="footnote">Saldos de subsectores: no suman necesariamente el total consolidado.</p><button class="panel-link" @click="navigate('territorios')">Explorar administraciones <AppIcon name="arrow" :size="17" /></button></section>
          <section class="insight-card"><span class="small-label"><AppIcon name="book" :size="16" /> CLAVES PARA ENTENDER</span><h2>Más euros no siempre<br>significan más peso.</h2><p>La deuda puede crecer en euros y, a la vez, reducirse como porcentaje del PIB si la economía crece más rápido.</p><div class="insight-formula"><span>Deuda pública</span><span class="formula-line"></span><span>Producto interior bruto</span><b>× 100</b></div><button class="text-button" @click="navigate('metodologia')">Entender los indicadores <AppIcon name="arrow" :size="17" /></button></section>
        </div>
        <div class="monthly-note"><AppIcon name="clock" :size="20" /><div><strong>También disponible: avance mensual</strong><p>{{ periodLabel(latestMonthly[0], 'MENSUAL') }} · {{ displayValue(latestMonthly[1], monthly.unit) }}. Es un periodo diferente al de los indicadores trimestrales de esta página.</p></div><button class="text-button" @click="selectedKey = `be11b:${monthly.code}`; explorerTable = 'be11b'; query = ''; explorerUnit = ''; explorerFrequency = ''; navigate('explorador')">Ver serie <AppIcon name="arrow" :size="16" /></button></div>
      </template>

      <template v-else-if="section === 'territorios'">
        <section class="panel"><div class="panel-header"><div><h2>Las cuatro administraciones</h2><p>Saldos de deuda PDE por subsector · {{ periodLabel(period) }}</p></div></div><div class="bars"><div v-for="s in sectorValues" :key="s.name" class="bar-row"><div class="bar-label"><span>{{ s.name }}</span><strong>{{ displayValue(s.value, s.series.unit) }}</strong></div><div class="bar-track"><div :style="{ width: `${(s.value ?? 0) / maxSector * 100}%`, background: s.color }"></div></div></div></div><div class="info-strip"><AppIcon name="info" :size="18" /> La deuda entre administraciones se elimina al consolidar el total. No sumes estos saldos para obtener la deuda de España.</div></section>
        <section class="panel"><div class="panel-header"><div><h2>Tu comunidad, en contexto</h2><p>Selecciona comunidades para comparar su evolución.</p></div><div class="segmented"><button :class="{ selected: regionUnit === 'ratio' }" :aria-pressed="regionUnit === 'ratio'" @click="regionUnit = 'ratio'">% PIB regional</button><button :class="{ selected: regionUnit === 'euros' }" :aria-pressed="regionUnit === 'euros'" @click="regionUnit = 'euros'">En euros</button></div></div>
          <div class="region-grid"><div class="region-list"><label v-for="r in regions" :key="r.code" class="region-row"><input type="checkbox" :checked="regionCodes.includes(r.code)" @change="toggleRegion(r.code)" /><span class="region-detail"><span>{{ r.name }}</span><span class="bar-track"><span :style="{ width: `${(r.value ?? 0) / maxRegion * 100}%` }"></span></span></span><strong>{{ r.value === null ? '—' : regionUnit === 'ratio' ? `${number(r.value)} %` : `${number(r.value / 1e6)} mil M€` }}</strong></label></div><div class="region-chart"><div class="chart-toolbar"><span class="small-label">EVOLUCIÓN COMPARADA</span><label class="compact-label">Histórico <select v-model.number="years"><option :value="5">5 años</option><option :value="10">10 años</option><option :value="20">20 años</option><option :value="0">Todo</option></select></label></div><TimeChart :lines="regionLines" :unit="regionUnit === 'ratio' ? '% del PIB regional' : 'Miles de millones de euros'" title="Comparación entre comunidades autónomas" /><p class="footnote">El volumen no es una clasificación de solvencia. Cada ratio utiliza el PIB de su comunidad.</p></div></div>
          <div class="panel-footer">Fuente: Banco de España · Cuadros 13.9 y 13.10 · {{ periodLabel(period) }}</div>
        </section>
      </template>

      <template v-else-if="section === 'composicion'">
        <section class="panel"><div class="panel-header"><div><h2>La estructura de la deuda</h2><p>Una cifra, distintas perspectivas.</p></div><div class="segmented"><button v-for="tab in [{ id: 'tenedores', label: 'Tenedores' }, { id: 'instrumentos', label: 'Instrumentos' }, { id: 'plazos', label: 'Plazo residual' }]" :key="tab.id" :class="{ selected: compositionTab === tab.id }" :aria-pressed="compositionTab === tab.id" @click="compositionTab = tab.id">{{ tab.label }}</button></div></div>
          <div class="composition-stack" aria-hidden="true"><div v-for="i in compositionItems" :key="i.code" :style="{ width: `${i.percent ?? 0}%`, background: i.color }"></div></div>
          <div class="composition-grid"><article v-for="i in compositionItems" :key="i.code"><span class="small-label"><i class="legend-dot" :style="{ background: i.color }"></i>{{ i.name }}</span><h3>{{ i.percent === null ? '—' : `${number(i.percent)} %` }}</h3><span>{{ displayValue(i.value, i.series.unit) }}</span></article></div>
          <div v-if="compositionTab === 'tenedores'" class="info-strip"><AppIcon name="info" :size="18" /><span>Dentro de las instituciones financieras, el Banco de España tiene {{ displayValue(valueAt(centralBank, period), centralBank.unit) }}. Ya está incluido: no se suma de nuevo. «Resto del mundo» indica residencia, no nacionalidad.</span></div>
          <div v-if="compositionTab === 'plazos'" class="info-strip"><AppIcon name="info" :size="18" /><span>Plazo residual: tiempo restante hasta el vencimiento de valores y préstamos. El denominador es la deuda total; efectivo y depósitos no se representan en estos tramos. No es un calendario de pagos por emisión.</span></div>
          <TimeChart :lines="compositionLines" unit="Miles de millones de euros" title="Evolución de la composición de la deuda" /><div class="panel-footer">Fuente: Banco de España · Cuadros 11.12 y 11.13 · {{ periodLabel(period) }}</div>
        </section>
      </template>

      <template v-else-if="section === 'cambios'">
        <section class="panel"><div class="panel-header"><div><h2>Del déficit a la variación de deuda</h2><p>Conciliación del trimestre · miles de millones de euros.</p></div></div>
          <template v-if="flowReady">
          <svg class="waterfall" viewBox="0 0 850 315" role="img" aria-label="Conciliación de la variación trimestral de la deuda. Gráfico en cascada: cada componente parte del acumulado anterior; la línea horizontal marca el cero, no un suelo. Valores disponibles en la tabla inferior.">
            <line class="waterfall-zero" x1="50" x2="800" :y1="flowY(0)" :y2="flowY(0)" stroke="#66765c" />
            <text x="40" :y="flowY(0) + 4" text-anchor="end">0</text>
            <g v-for="(f, index) in flow" :key="f.name">
              <line class="waterfall-connector" :x1="185 + index * 190" :x2="260 + index * 190" :y1="flowY(f.end)" :y2="flowY(f.end)" stroke="#8d9888" stroke-dasharray="4 4" />
              <rect :x="70 + index * 190" :y="flowY(Math.max(f.start, f.end))" width="115" :height="Math.max(2, Math.abs(flowY(f.start) - flowY(f.end)))" :fill="f.value! >= 0 ? '#7c9b70' : '#c7956a'" rx="4">
                <title>{{ f.name }}: {{ sign(f.value!) }}{{ number(f.value!, 2) }} mil M€. Acumulado: {{ number(f.start, 2) }} → {{ number(f.end, 2) }} mil M€.</title>
              </rect>
              <text :x="127 + index * 190" :y="flowY(Math.max(f.start, f.end)) - 12" text-anchor="middle">{{ sign(f.value!) }}{{ number(f.value!, 2) }}</text>
              <text :x="127 + index * 190" y="275" text-anchor="middle">{{ index === 0 ? 'Necesidad financiación' : index === 1 ? 'Activos financieros' : 'Otros ajustes' }}</text>
            </g>
            <rect x="640" :y="flowY(Math.max(0, flowTotal! / 1e6))" width="115" :height="Math.max(2, Math.abs(flowY(0) - flowY(flowTotal! / 1e6)))" fill="#1f5e4b" rx="4" />
            <text x="697" :y="flowY(Math.max(0, flowTotal! / 1e6)) - 12" text-anchor="middle">{{ sign(flowTotal!) }}{{ number(flowTotal! / 1e6, 2) }}</text>
            <text x="697" y="275" text-anchor="middle">Variación de deuda</text>
          </svg>
          <p class="footnote">La línea continua marca el cero, no un suelo; su altura se adapta a los datos del trimestre. Las barras verdes suman y las naranjas restan al acumulado anterior, unido por líneas discontinuas. Por eso una barra negativa puede quedar por encima del cero o atravesarlo. La barra final muestra la variación total desde cero.</p>
          <div class="table-scroll"><table><caption>Conciliación · {{ periodLabel(period) }} · miles de millones de euros</caption><thead><tr><th>Componente</th><th>Importe</th></tr></thead><tbody><tr v-for="f in flow" :key="f.name"><th>{{ f.name }}</th><td>{{ number(f.value!, 3) }}</td></tr><tr class="total-row"><th>Variación total de deuda PDE</th><td>{{ number(flowTotal! / 1e6, 3) }}</td></tr></tbody></table></div></template><p v-else class="empty-state">La conciliación no está disponible para este periodo. Selecciona otro trimestre.</p>
          <div class="info-strip"><AppIcon name="info" :size="18" /><span>El déficit es un flujo y la deuda un saldo. La adquisición de activos financieros y otros ajustes explican por qué no varían en la misma cuantía. La necesidad de financiación se muestra con el signo utilizado en el cuadro 11.8.</span></div><div class="panel-footer"><span>Fuente: Banco de España · Cuadro 11.8</span><a :href="sourceFor('be1108').chapterUrl" target="_blank" rel="noopener noreferrer">Consultar cuadro oficial ↗</a></div>
        </section>
      </template>

      <template v-else-if="section === 'mercados'">
        <div class="context-bar"><div><span class="status-dot"></span><strong>Mercados de deuda</strong><span class="context-divider">|</span><span>Series mensuales · periodos independientes de la deuda PDE</span></div><label>Mes de referencia <select v-model="marketPeriod" aria-label="Mes de mercados"><option v-for="p in marketPeriods" :key="p" :value="p">{{ periodLabel(p, 'MENSUAL') }}</option></select></label></div>
        <section class="panel"><div class="panel-header"><div><h2>Emisiones de valores de las AAPP</h2><p>Emisiones brutas y netas · flujos mensuales a valor de mercado.</p></div></div><TimeChart :lines="marketLines" unit="Miles de millones de euros" frequency="MENSUAL" title="Emisiones brutas y netas de las AAPP" /><div class="info-strip"><AppIcon name="info" :size="18" /><span>{{ periodLabel(marketPeriod, 'MENSUAL') }}: brutas {{ displayValue(valueAt(gross, marketPeriod), gross.unit) }} · netas {{ displayValue(valueAt(net, marketPeriod), net.unit) }}. No son saldos PDE. No se infiere un calendario de amortizaciones de estas series.</span></div><div class="panel-footer">Fuente: Banco de España · Cuadros 21.8 y 21.9</div></section>
        <section class="panel"><div class="panel-header"><div><h2>Rendimientos del mercado secundario</h2><p>Bonos y obligaciones del Estado · tipo medio ponderado.</p></div><label class="compact-label">Tramo <select v-model="yieldSeries" aria-label="Tramo de rendimiento"><option v-for="(s, i) in yields" :key="s.code" :value="s.code">{{ ['2,5–3,5 años', '4,5–5,5 años', '9,5–10,5 años', '14,5–15,5 años', '29,5–30,5 años'][i] ?? s.code }}</option></select></label></div><TimeChart :lines="[lineFor(selectedYield, 'Rendimiento medio', marketPeriod, years, true)]" unit="Porcentaje" frequency="MENSUAL" title="Rendimiento de deuda pública en el mercado secundario" /><div class="info-strip"><AppIcon name="info" :size="18" /> El rendimiento de mercado no equivale al coste medio de la deuda en circulación ni a los intereses pagados.</div><div class="panel-footer"><span>Fuente: Banco de España · Cuadro 22.7 · Última observación de la serie: {{ periodLabel(selectedYield.points.at(-1)![0], 'MENSUAL') }}</span><button class="text-button" @click="download(selectedYield)">Descargar serie <AppIcon name="download" :size="15" /></button></div></section>
      </template>

      <template v-else-if="section === 'explorador'">
        <section class="panel"><div class="explorer-filters"><label class="search-field"><AppIcon name="search" /><input v-model="query" type="search" placeholder="Buscar una serie, un territorio, un código…" aria-label="Buscar series" /></label><label>Cuadro <select v-model="explorerTable"><option value="">Todos los cuadros</option><option v-for="s in data.sources" :key="s.id" :value="s.id">{{ s.id }} · {{ s.title }}</option></select></label><label>Unidad <select v-model="explorerUnit"><option value="">Todas</option><option v-for="u in [...new Set(data.series.map(s => s.unit))]" :key="u">{{ u }}</option></select></label><label>Frecuencia <select v-model="explorerFrequency"><option value="">Todas</option><option v-for="f in [...new Set(data.series.map(s => s.frequency))]" :key="f">{{ f }}</option></select></label></div>
          <div class="explorer-layout"><div class="series-list"><div class="list-heading">{{ filteredSeries.length }} series encontradas</div><button v-for="s in filteredSeries" :key="`${s.table}:${s.code}`" :class="{ selected: explorerVisible === s }" @click="selectedKey = `${s.table}:${s.code}`"><span>{{ s.description }}</span><small>{{ s.table }} · {{ s.frequency.toLowerCase() }} · {{ s.unit }}</small></button><p v-if="!filteredSeries.length" class="empty-state">No hay series con estos filtros.</p></div>
          <article v-if="explorerVisible" class="series-detail"><span class="small-label">SERIE OFICIAL · {{ explorerVisible.table }}</span><h2>{{ explorerVisible.description }}</h2><code class="series-code">{{ explorerVisible.code }}</code><div class="series-metadata"><span><b>Unidad original</b>{{ explorerVisible.unit }}</span><span><b>Frecuencia</b>{{ explorerVisible.frequency }}</span><span><b>Cobertura disponible</b>{{ explorerVisible.points[0]?.[0] }} → {{ explorerEnd }}</span></div><label class="compact-label">Histórico <select v-model.number="years"><option :value="5">5 años</option><option :value="10">10 años</option><option :value="20">20 años</option><option :value="0">Todo</option></select></label><TimeChart :lines="explorerLines" :unit="explorerUnitLabel" :frequency="explorerVisible.frequency" title="Serie seleccionada" /><div class="series-actions"><button class="primary-button" @click="download(explorerVisible)"><AppIcon name="download" :size="17" /> CSV completo · unidad original</button><a class="secondary-button" :href="sourceFor(explorerVisible.table).url" target="_blank" rel="noopener noreferrer">Fichero oficial <AppIcon name="external" :size="15" /></a></div><p class="footnote">La descarga conserva todos los periodos de la serie en su unidad original; el gráfico puede convertir importes a miles de millones.</p></article></div>
        </section>
      </template>

      <MaturityView v-else-if="section === 'vencimientos'" />

      <template v-else-if="section === 'metodologia'">
        <div class="two-columns methodology-grid"><section class="panel prose"><span class="small-label">01 · CONCEPTOS</span><h2>Qué estamos midiendo</h2><h3>Deuda pública PDE</h3><p>Deuda bruta consolidada del sector Administraciones Públicas a valor nominal, conforme al Protocolo de Déficit Excesivo y al SEC 2010. Incluye efectivo y depósitos, valores representativos de deuda y préstamos. No equivale a todos los pasivos ni a la deuda neta.</p><h3>Euros, porcentajes y puntos porcentuales</h3><p>Los importes de los paneles se expresan en miles de millones de euros; las tarjetas indican su escala. La variación interanual compara con el mismo periodo del año anterior. El cambio de deuda/PIB se expresa en puntos porcentuales, no como tasa de crecimiento.</p><h3>Consolidación y tenedores</h3><p>No se deben sumar sin ajustar los saldos de los subsectores. En el cuadro 11.13, el Banco de España está incluido en instituciones financieras y no se añade como una categoría independiente.</p></section><section class="panel prose"><span class="small-label">02 · ACTUALIZACIÓN</span><h2>Datos con trazabilidad</h2><h3>Una descarga, no un contador en directo</h3><p>Descarga realizada el {{ dateLabel(data.retrievedAt) }}. Cada serie muestra sus periodos. La fecha de descarga no es la fecha de publicación: los CSV utilizados no aportan esta última de forma inequívoca.</p><h3>Mensual y trimestral no son intercambiables</h3><p>El avance mensual se identifica por separado. Las tarjetas principales utilizan un trimestre común para deuda y ratio. Los mercados tienen su propio selector mensual; nunca se completa un dato ausente con cero.</p><h3>Revisiones históricas</h3><p>{{ data.revisions.length }} cambios respecto a la descarga anterior{{ data.previousRetrievedAt ? ` (${dateLabel(data.previousRetrievedAt)})` : ' (esta es la primera descarga)' }}. Los originales se conservan con una huella SHA-256 y la publicación del snapshot se realiza solo si toda la descarga termina correctamente.</p></section></div>
        <section class="panel"><div class="panel-header"><div><h2>Fuentes que alimentan esta versión</h2><p>{{ data.sources.length }} cuadros · {{ data.series.length }} series, incluyendo series repetidas entre cuadros.</p></div></div><div class="table-scroll"><table><caption>Ficheros descargados del Banco de España</caption><thead><tr><th>Cuadro</th><th>Contenido</th><th>Acceso</th></tr></thead><tbody><tr v-for="s in data.sources" :key="s.id"><th>{{ s.id }}</th><td>{{ s.title }}</td><td class="source-links"><a :href="s.url" target="_blank" rel="noopener noreferrer">CSV oficial ↗</a><a :href="`${importBase}${s.rawUrl}`" download>Original guardado ↓</a></td></tr></tbody></table></div></section>
        <section class="panel prose"><h2>Vencimientos anuales del Tesoro</h2><p>La vista «Vencimientos por año» utiliza una fuente independiente: el listado de valores en circulación del Tesoro Público. Agrupa saldos por año de vencimiento y muestra fechas separadas para letras y bonos. No cubre toda la deuda PDE ni intereses, y los bonos indexados están sujetos a inflación futura. La vista ofrece el enlace oficial y el original descargado. Para actualizarla, ejecutar <code>npm run data:sync:tesoro</code>.</p><p>El selector histórico ofrece copias reales del listado conservadas por Internet Archive entre 2019 y 2025. Cada captura indica sus propias fechas de saldos, que pueden pertenecer al año anterior. No son cierres anuales ni estimaciones a partir de la deuda actual. Se importan con <code>npm run data:sync:tesoro:history</code>.</p><a class="text-button" href="#vencimientos" @click.prevent="navigate('vencimientos')">Consultar los vencimientos <AppIcon name="arrow" :size="15" /></a></section>
        <section class="panel prose"><h2>Amortizaciones realizadas y financiación del Tesoro</h2><p>El panel dentro de «Vencimientos por año» utiliza el cuadro 13 del Tesoro, con emisiones, amortizaciones y financiación neta por ejercicio. La edición del boletín fija el corte de realizados; los meses posteriores se muestran solo como previsiones opcionales y nunca se suman a los indicadores realizados. Son importes efectivos según las convenciones contables del cuadro, con resto y deuda asumida: no se concilian directamente con saldos vivos ni identifican pagos por ISIN. Actualización: <code>npm run data:sync:tesoro:finance</code>.</p></section>
        <section class="panel"><div class="panel-header"><div><h2>Catálogo y próximos ámbitos</h2><p>El catálogo identifica conjuntos de datos; no todos están integrados en los gráficos.</p></div></div><div class="catalog-grid"><a v-for="d in data.catalog" :key="d.id" :href="d.url" target="_blank" rel="noopener noreferrer"><small>{{ d.id }} · {{ d.frecuencia }}</small><strong>{{ d.titulo }}</strong><span>{{ d.bloque }} <AppIcon name="external" :size="14" /></span></a></div><div class="info-strip"><AppIcon name="info" :size="18" /><span>Fuera del alcance actual: microdatos confidenciales BELab, deuda privada, deuda externa y calendario completo de vencimientos de todas las AAPP. La deuda externa se solapa con los sectores público y privado; no se suma a ellos.</span></div></section>
      </template>
      <footer class="page-footer"><span v-if="section === 'vencimientos'">Datos: Tesoro Público <span>·</span> Fechas y cobertura indicadas en esta vista</span><span v-else>Datos: Banco de España <span>·</span> Descarga: {{ dateLabel(data.retrievedAt) }}</span><span>Transparencia para entender, no para simplificar.</span></footer>
    </main>
  </div>
</template>

<script lang="ts">
const importBase = import.meta.env.BASE_URL
</script>
