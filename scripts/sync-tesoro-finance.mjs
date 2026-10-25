import { mkdir, writeFile, rename } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { parseFinancePublication, parseFinanceWorkbook } from './tesoro-finance.mjs'
import { financeSourceUrl, financePdfUrl, financeBulletinUrl, validateFinanceSnapshot } from '../src/lib/finance.mjs'

async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) })
  if (!response.ok) throw new Error(`Tesoro: HTTP ${response.status} (${url}).`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (!bytes.length || bytes.length > 5000000) throw new Error('Tamaño de documento del Tesoro no admitido.')
  return bytes
}
const [bulletin, workbook] = await Promise.all([download(financeBulletinUrl), download(financeSourceUrl)])
const publication = parseFinancePublication(new TextDecoder('utf-8', { fatal: true }).decode(bulletin))
const retrievedAt = new Date().toISOString()
const batch = `tesoro-finance-${retrievedAt.replace(/[:.]/g, '-')}`
const rawUrl = `data/raw/${batch}/tesoro-finance.xlsx`
const bulletinRawUrl = `data/raw/${batch}/tesoro-bulletin.html.txt`
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const snapshot = {
  version: 1, retrievedAt, publication, unit: 'Millones de euros',
  source: { url: financeSourceUrl, pdfUrl: financePdfUrl, rawUrl, hash: hash(workbook), bulletinRawUrl, bulletinHash: hash(bulletin) },
  years: parseFinanceWorkbook(workbook, publication),
}
validateFinanceSnapshot(snapshot)
const out = new URL('../public/data/', import.meta.url)
await mkdir(new URL(`raw/${batch}/`, out), { recursive: true })
await writeFile(new URL(`../public/${rawUrl}`, import.meta.url), workbook)
await writeFile(new URL(`../public/${bulletinRawUrl}`, import.meta.url), bulletin)
await writeFile(new URL('tesoro-finance.json.tmp', out), JSON.stringify(snapshot))
await rename(new URL('tesoro-finance.json.tmp', out), new URL('tesoro-finance.json', out))
console.log(`Financiación publicada: boletín ${publication}; años ${snapshot.years.map(entry => entry.year).join(', ')}.`)
