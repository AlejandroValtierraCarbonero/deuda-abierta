import { mkdir, writeFile, rename } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { parseTesoro } from './tesoro.mjs'
import { maturitySourceUrl, validateMaturitySnapshot } from '../src/lib/maturities.mjs'

const response = await fetch(maturitySourceUrl, { signal: AbortSignal.timeout(60000) })
if (!response.ok) throw new Error(`Tesoro: HTTP ${response.status}`)
const bytes = new Uint8Array(await response.arrayBuffer())
const parsed = parseTesoro(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
const retrievedAt = new Date().toISOString()
const batch = retrievedAt.replace(/[:.]/g, '-')
const out = new URL('../public/data/', import.meta.url)
const rawUrl = `data/raw/${batch}/tesoro-valores.html.txt`
const snapshot = {
  version: 1, retrievedAt, unit: 'Millones de euros',
  source: { title: 'Tesoro Público · Valores en circulación', url: maturitySourceUrl, rawUrl, hash: createHash('sha256').update(bytes).digest('hex') },
  ...parsed,
}
validateMaturitySnapshot(snapshot)
await mkdir(new URL(`raw/${batch}/`, out), { recursive: true })
await writeFile(new URL(`../public/${rawUrl}`, import.meta.url), bytes)
await writeFile(new URL('maturities.json.tmp', out), JSON.stringify(snapshot))
await rename(new URL('maturities.json.tmp', out), new URL('maturities.json', out))
console.log(`Vencimientos publicados: ${parsed.securities.length} valores; letras a ${parsed.referenceDates.letras}; bonos a ${parsed.referenceDates.bonos}.`)
