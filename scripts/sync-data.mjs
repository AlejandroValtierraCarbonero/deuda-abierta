import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { parseBde, decodeCsv } from './bde.mjs'
import { validateFinancialSnapshot } from '../src/lib/validate.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const out = new URL('../public/data/', import.meta.url)
const tables = {
  be11b: 'Avance mensual de deuda PDE',
  be1101: 'Deuda, pasivos y PIB',
  be1102: 'Deuda y pasivos en porcentaje del PIB',
  be1104: 'Deuda por subsectores',
  be1108: 'Conciliación entre déficit y deuda',
  be1112: 'Deuda por instrumentos',
  be1113: 'Tenedores, monedas y plazos residuales',
  be1309: 'Deuda de las comunidades autónomas',
  be1310: 'Deuda de las comunidades en porcentaje del PIB',
  be2108: 'Emisiones brutas de valores de deuda',
  be2109: 'Emisiones netas de valores de deuda',
  be2207: 'Bonos y obligaciones: negociación y tipos de interés',
}
await mkdir(out, { recursive: true })
const retrievedAt = new Date().toISOString()
const batch = retrievedAt.replace(/[:.]/g, '-')
const rawDir = new URL(`raw/${batch}/`, out)
await mkdir(rawDir, { recursive: true })
const sources = []
const allSeries = []

for (const [id, title] of Object.entries(tables)) {
  const url = `https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/${id}.csv`
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) })
  if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const series = parseBde(decodeCsv(bytes), id)
  await writeFile(new URL(`${id}.csv`, rawDir), bytes)
  const chapter = id.slice(2, 4)
  sources.push({
    id, title, url, retrievedAt,
    publishedAt: null,
    chapterUrl: `https://www.bde.es/webbe/es/estadisticas/otras-clasificaciones/publicaciones/boletin-estadistico/capitulo-${Number(chapter)}.html`,
    rawUrl: `data/raw/${batch}/${id}.csv`,
    hash: createHash('sha256').update(bytes).digest('hex'),
  })
  allSeries.push(...series)
  console.log(`${id}: ${series.length} series`)
}
const catalog = JSON.parse(await readFile(`${root}catalogos/banco-de-espana/catalogo_datasets_deuda.json`, 'utf8'))
const previousPath = new URL('snapshot.json', out)
let previous = null
try { previous = JSON.parse(await readFile(previousPath, 'utf8')) }
catch (error) { if (error.code !== 'ENOENT') throw error }
const revisions = []
if (previous) {
  for (const series of allSeries) {
    const old = previous.series.find(s => s.table === series.table && s.code === series.code)
    if (!old) continue
    const currentValues = new Map(series.points)
    for (const [period, value] of old.points) {
      const current = currentValues.get(period)
      if (current !== value) revisions.push({ table: series.table, code: series.code, period, before: value, after: current ?? null })
    }
  }
}
const snapshot = { version: 1, retrievedAt, previousRetrievedAt: previous?.retrievedAt ?? null, revisions, sources, series: allSeries, catalog: catalog.datasets }
validateFinancialSnapshot(snapshot)
await writeFile(new URL('snapshot.json.tmp', out), JSON.stringify(snapshot))
await rename(new URL('snapshot.json.tmp', out), previousPath)
console.log(`Snapshot publicado: ${allSeries.length} series; ${revisions.length} revisiones históricas`)
