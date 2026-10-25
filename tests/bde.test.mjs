import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parseCsv, parsePeriod, parseBde, decodeCsv } from '../scripts/bde.mjs'
import { valueAt, annualChange, commonPeriods, seriesCsv } from '../src/lib/metrics.mjs'
import { validateFinancialSnapshot } from '../src/lib/validate.mjs'

const fixture = '"CÓDIGO DE LA SERIE",ABC,DEF\n"NÚMERO SECUENCIAL",1,2\n"ALIAS DE LA SERIE","a","b"\n"DESCRIPCIÓN DE LA SERIE","Deuda, nominal","Ratio"\n"DESCRIPCIÓN DE LAS UNIDADES","Miles de euros","Porcentaje"\n"FRECUENCIA","TRIMESTRAL","TRIMESTRAL"\n"DIC 2024",100,"_"\n"MAR 2025",0,12.5\n"DIC 2025",110,"..."\n'
test('CSV handles commas, CRLF, multiline fields and escaped quotes', () => {
  assert.deepEqual(parseCsv('"a,b","say ""hola"""\r\n"line\nbreak",3'), [['a,b', 'say "hola"'], ['line\nbreak', '3']])
  assert.throws(() => parseCsv('"unclosed'))
})
test('Spanish calendar is parsed without converting month into quarter start', () => {
  assert.equal(parsePeriod('JUN 2026'), '2026-06')
  assert.equal(parsePeriod('DIC 2025'), '2025-12')
  assert.throws(() => parsePeriod('XXX 2026'))
})
test('UTF-8 and legacy Spanish encodings', () => {
  assert.equal(decodeCsv(new TextEncoder().encode('España')), 'España')
  assert.equal(decodeCsv(Uint8Array.from([69, 115, 112, 97, 241, 97])), 'España')
})
test('BDE metadata, zero and missing observations remain distinct', () => {
  const series = parseBde(fixture, 'test')
  assert.equal(series[0].description, 'Deuda, nominal')
  assert.equal(valueAt(series[0], '2025-03'), 0)
  assert.equal(valueAt(series[1], '2024-12'), null)
  assert.equal(series[1].points.length, 1)
  assert.deepEqual(commonPeriods(series), ['2025-03'])
  assert.throws(() => parseBde(fixture.replace(',110,', ',bad,'), 'test'))
  assert.throws(() => parseBde(fixture + '"DIC 2025",3,4\n', 'test'))
  assert.throws(() => parseBde('<html>error</html>', 'test'))
})
test('year-on-year changes compare exact matching months, not last available value', () => {
  const [series] = parseBde(fixture, 'test')
  const result = annualChange(series, '2025-12')
  assert.equal(result.absolute, 10)
  assert.ok(Math.abs(result.percent - 10) < 1e-9)
  assert.equal(annualChange(series, '2025-03'), null)
  assert.equal(valueAt(series, '2025-06'), null)
})
test('CSV export preserves original values, units and provenance', () => {
  const [series] = parseBde(fixture, 'test')
  const rows = parseCsv(seriesCsv(series).replace(/^\uFEFF/, ''))
  assert.deepEqual(rows[0], ['periodo', 'valor', 'unidad', 'codigo', 'cuadro'])
  assert.deepEqual(rows[1], ['2024-12', '100', 'Miles de euros', 'ABC', 'test'])
})

const data = JSON.parse(await readFile(new URL('../public/data/snapshot.json', import.meta.url), 'utf8'))
const get = (table, code) => {
  const series = data.series.find(s => s.table === table && s.code === code)
  assert.ok(series, `Missing series ${table}:${code}`)
  return series
}
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) <= 5, `${label}: ${actual} ≠ ${expected}`)
test('snapshot contains every required official table and numeric series', () => {
  assert.equal(data.sources.length, 12)
  assert.ok(data.series.length >= 150)
  for (const s of data.series) {
    assert.ok(s.points.every(p => Number.isFinite(p[1])))
    assert.equal(new Set(s.points.map(p => p[0])).size, s.points.length)
  }
})
test('publication validator rejects incomplete or inconsistent data explicitly', () => {
  assert.doesNotThrow(() => validateFinancialSnapshot(data))
  const missing = { ...data, series: data.series.filter(s => s.table !== 'be11b') }
  assert.throws(() => validateFinancialSnapshot(missing), /Serie requerida ausente/)
  const altered = structuredClone(data)
  altered.series.find(s => s.table === 'be1112' && s.code === 'DTNPDE2010_F30000_PS_APU').points.at(-1)[1] += 1000
  assert.throws(() => validateFinancialSnapshot(altered), /Identidad contable/)
})
test('latest 40 quarters: instruments and holders reconcile without double counting BdE', () => {
  const total = get('be1112', 'DTNPDE2010_P00000_PS_APU')
  for (const [period, amount] of total.points.slice(-40)) {
    const sum = (table, codes) => codes.reduce((acc, code) => acc + valueAt(get(table, `DTNPDE2010_${code}_PS_APU`), period), 0)
    close(sum('be1112', ['F20000', 'F30000', 'F40000']), amount, `Instruments ${period}`)
    close(sum('be1113', ['P00020', 'P00050', 'P00060']), amount, `Holders ${period}`)
  }
})
test('latest 40 quarters: waterfall reproduces the official quarterly debt variation', () => {
  const total = get('be1108', 'DTNPDE2010_P00000_PF_APU')
  for (const [period, amount] of total.points.slice(-40)) {
    const deficit = valueAt(get('be1108', 'DTNSEC2010_S0000N_APU'), period)
    const assets = valueAt(get('be1108', 'DTNSEC2010_A00000_AF_APU'), period)
    const adjustments = valueAt(get('be1108', 'DTNPDE2010_AJO000_PF_APU'), period)
    close(deficit + assets + adjustments, amount, `Waterfall ${period}`)
  }
})
test('regional comparisons contain 17 regions in both units with shared periods', () => {
  const regional = (table) => data.series.filter(s => s.table === table && /_ACS_A[A-Z]{2}$/.test(s.code))
  assert.equal(regional('be1309').length, 17)
  assert.equal(regional('be1310').length, 17)
  assert.ok(commonPeriods([...regional('be1309'), ...regional('be1310')]).length > 50)
})
test('raw downloads match snapshot source SHA-256 fingerprints', async () => {
  const { createHash } = await import('node:crypto')
  for (const source of data.sources) {
    const raw = await readFile(new URL(`../public/${source.rawUrl}`, import.meta.url))
    assert.equal(createHash('sha256').update(raw).digest('hex'), source.hash)
    const parsed = parseBde(decodeCsv(raw), source.id)
    assert.deepEqual(parsed, data.series.filter(s => s.table === source.id))
  }
})
