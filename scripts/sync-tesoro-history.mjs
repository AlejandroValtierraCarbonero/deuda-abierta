import { mkdir, rename, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { parseTesoro } from './tesoro.mjs'
import { maturitySourceUrl, validateMaturityHistory } from '../src/lib/maturities.mjs'

// One genuine capture per year, selected from the public CDX index, not year-end estimates.
const captures = ['20190107022517', '20200205010519', '20210513053701', '20220308051950', '20230329025523', '20240419143738', '20250210055916']
const out = new URL('../public/data/', import.meta.url)
const retrievedAt = new Date().toISOString()
const snapshots = []
for (const stamp of captures) {
  const original = Number(stamp.slice(0, 4)) <= 2020
    ? maturitySourceUrl.replace('https:', 'http:').replace('.es/', '.es:80/') : maturitySourceUrl
  const url = `https://web.archive.org/web/${stamp}id_/${original}`
  const response = await fetch(url, { signal: AbortSignal.timeout(90000) })
  if (!response.ok) throw new Error(`Captura ${stamp}: HTTP ${response.status}`)
  if (response.url !== url) throw new Error(`El archivo ha redirigido la captura ${stamp} a otra URL: ${response.url}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const rawUrl = `data/raw/tesoro-history-${stamp}/tesoro-valores.html.txt`
  const capturedAt = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(8, 10)}:${stamp.slice(10, 12)}:${stamp.slice(12, 14)}Z`
  const snapshot = {
    version: 1, retrievedAt, unit: 'Millones de euros',
    source: {
      title: 'Tesoro Público · Valores en circulación (copia de Internet Archive)', url: maturitySourceUrl,
      rawUrl, hash: createHash('sha256').update(bytes).digest('hex'), archive: { capturedAt, url },
    },
    ...parseTesoro(new TextDecoder('utf-8', { fatal: true }).decode(bytes), true),
  }
  validateMaturityHistory({ version: 1, snapshots: [snapshot] })
  await mkdir(new URL(`raw/tesoro-history-${stamp}/`, out), { recursive: true })
  await writeFile(new URL(`../public/${rawUrl}`, import.meta.url), bytes)
  snapshots.push(snapshot)
  console.log(`${capturedAt}: ${snapshot.securities.length} valores; letras ${snapshot.referenceDates.letras}; bonos ${snapshot.referenceDates.bonos}`)
}
const history = { version: 1, snapshots }
validateMaturityHistory(history)
await writeFile(new URL('maturity-history.json.tmp', out), JSON.stringify(history))
await rename(new URL('maturity-history.json.tmp', out), new URL('maturity-history.json', out))
console.log(`Histórico publicado: ${snapshots.length} capturas verificadas.`)
