import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
import { load } from 'cheerio'
import { parseFinancePublication, parseFinanceWorkbook } from '../scripts/tesoro-finance.mjs'
import { actualFinanceTotals, financeEqual, validateFinanceSnapshot } from '../src/lib/finance.mjs'

const snapshot = JSON.parse(await readFile(new URL('../public/data/tesoro-finance.json', import.meta.url), 'utf8'))
const workbook = await readFile(new URL(`../public/${snapshot.source.rawUrl}`, import.meta.url))
const bulletin = await readFile(new URL(`../public/${snapshot.source.bulletinRawUrl}`, import.meta.url))
const zip = unzipSync(workbook)
const rewrite = (path, transform) => zipSync({ ...zip, [path]: strToU8(transform(strFromU8(zip[path]))) })
const rewriteCell = (address, transform) => rewrite('xl/worksheets/sheet1.xml', text => {
  const $ = load(text, { xmlMode: true })
  const cell = $(`c[r="${address}"]`)
  assert.equal(cell.length, 1)
  transform(cell, $)
  return $.xml()
})
const validateWorkbook = bytes => validateFinanceSnapshot({ ...snapshot, years: parseFinanceWorkbook(bytes, snapshot.publication) })

test('official finance originals reproduce the snapshot and its publication cutoff with matching hashes', () => {
  assert.equal(createHash('sha256').update(workbook).digest('hex'), snapshot.source.hash)
  assert.equal(createHash('sha256').update(bulletin).digest('hex'), snapshot.source.bulletinHash)
  assert.equal(parseFinancePublication(bulletin.toString('utf8')), '2026-09')
  assert.deepEqual(parseFinanceWorkbook(workbook, snapshot.publication), snapshot.years)
  assert.doesNotThrow(() => validateFinanceSnapshot(snapshot))
})

test('monthly rows count daily totals only once and exclude forecasts from actual indicators', () => {
  const year = snapshot.years.find(row => row.year === 2026)
  assert.equal(year.months.filter(row => row.status === 'actual').length, 9)
  assert.equal(year.months.filter(row => row.status === 'forecast').length, 3)
  const totals = actualFinanceTotals(year.months)
  assert.ok(financeEqual(totals.redemptions, 171489.31021376))
  assert.ok(financeEqual(totals.emissions, 234364.32640672))
  assert.ok(financeEqual(totals.net, 62875.01619296))
  assert.ok(financeEqual(totals.instruments.letras, 76712.58693496))
  assert.ok(financeEqual(totals.instruments.bonos, 44754.6298213))
  assert.ok(financeEqual(totals.instruments.obligaciones, 47509.55423503))
  assert.ok(financeEqual(totals.instruments.resto, 2512.53922247))
  assert.equal(totals.instruments.indexados, 0)
  assert.ok(financeEqual(year.months[7].redemptions, 8527.77107939))
  assert.ok(financeEqual(year.months[8].redemptions, 8462.47244846))
  assert.ok(financeEqual(year.months[9].redemptions, 38253.24828217))
  for (const row of year.months.slice(9)) {
    assert.equal(row.emissions, null)
    assert.equal(row.net, null)
  }
  assert.ok(financeEqual(year.months.reduce((sum, row) => sum + row.redemptions, 0), 231289.15785072))
  assert.notEqual(totals.redemptions, 231289.15785072)
  assert.equal(snapshot.years.find(row => row.year === 2025).months.every(row => row.status === 'actual'), true)
})

test('edition parsing fails explicitly on absent, unknown or conflicting publication months', () => {
  assert.equal(parseFinancePublication('<a>Boletín estadísticas Diciembre 2025</a>'), '2025-12')
  for (const html of ['<h1>Error</h1>', 'Boletín estadísticas Otro 2026',
    'Boletín estadísticas Septiembre 2026 Boletín estadísticas Octubre 2026']) {
    assert.throws(() => parseFinancePublication(html))
  }
  assert.throws(() => validateWorkbook(rewrite('xl/sharedStrings.xml', text => text.replaceAll('EN 2026', 'EN 2024'))))
})

test('workbook import rejects changed columns, units, missing totals, invalid numbers and inconsistent accounting', () => {
  const invalid = [
    rewrite('xl/sharedStrings.xml', text => text.replaceAll('(millones de EUROS)', '(miles de EUROS)')),
    rewrite('xl/sharedStrings.xml', text => text.replaceAll('AMORTIZACIONES', 'OTRO BLOQUE')),
    rewrite('xl/sharedStrings.xml', text => text.replaceAll('OBLIG.', 'OTRO')),
    rewriteCell('T13', cell => cell.remove()),
    rewriteCell('N13', cell => cell.children('v').text('1')),
    rewriteCell('T13', cell => cell.children('v').text('not-a-number')),
    rewriteCell('O13', cell => cell.children('v').text('-100')),
    rewriteCell('Z13', cell => cell.children('v').text('1')),
    rewriteCell('T38', cell => cell.children('v').text('1')),
    rewriteCell('B13', cell => cell.remove()),
    rewriteCell('P13', cell => cell.remove()),
  ]
  for (const bytes of invalid) assert.throws(() => validateWorkbook(bytes))
  assert.throws(() => parseFinanceWorkbook(new Uint8Array(), '2026-09'))
})

test('snapshot rejects altered provenance, cutoff, duplicate months, forecasts presented as actual and missing data', () => {
  for (const change of [
    data => { data.publication = '2099-09' },
    data => { data.publication = '2026-13' },
    data => { data.publication = '2026-08' },
    data => { data.years[0].months[9].status = 'actual' },
    data => { data.years[0].months[9].emissions = 0 },
    data => { data.years[0].months[9].net = -data.years[0].months[9].redemptions },
    data => { data.years[0].months[0].emissions = null },
    data => { data.years[0].months[0].redemptions = NaN },
    data => { data.years[0].months[0].instruments.letras = Infinity },
    data => { data.years[0].months[1].month = 1 },
    data => { data.years[0].months.pop() },
    data => { data.years[1] = data.years[0] },
    data => { data.unit = 'Euros' },
    data => { data.source.rawUrl = '../outside.xlsx' },
    data => { data.source.bulletinRawUrl = 'https://example.com/bulletin' },
    data => { data.source.hash = 'invalid' },
    data => { data.source.url = 'https://example.com/workbook' },
  ]) {
    const data = structuredClone(snapshot)
    change(data)
    assert.throws(() => validateFinanceSnapshot(data))
  }
  for (const data of [null, {}, { ...snapshot, years: [] }]) assert.throws(() => validateFinanceSnapshot(data))
})
