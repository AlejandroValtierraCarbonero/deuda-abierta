import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { parseTesoro } from '../scripts/tesoro.mjs'
import { annualMaturities, validateMaturityHistory, validateMaturitySnapshot, isCalendarDate } from '../src/lib/maturities.mjs'

function table(id, date, rows, bonos = false) {
  return `<div class="circ-section"><div class="circ-section-sub">(Importes en millones de euros)</div>
    <table id="${id}"><thead><tr><th>Código ISIN</th><th>Fecha de vencimiento</th><th>Saldo en circulación (*)</th>
    ${bonos ? '<th>Coeficiente de indexación</th><th>Valor facial</th>' : ''}</tr></thead>
    <tbody>${rows.map(cells => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <div class="circ-footnote">(*) Datos a ${date}.</div></div>`
}
const fixture = table('tablaLetras', '16/10/2026', [['ES0L02611066', '06/11/2026', '8.989,2']])
  + table('tablaByo', '20/10/2026', [
    ['ES00000128S2 O &euro;i 0,65**', '30/11/2027', '22.998,0', '1,31518', '17.486,6'],
    ['ES0000012I08 O 0,00**', '31/01/2029', '0,0', '', ''],
  ], true)
const snapshot = JSON.parse(await readFile(new URL('../public/data/maturities.json', import.meta.url), 'utf8'))
const fixtureSnapshot = () => ({ ...structuredClone(snapshot), ...parseTesoro(fixture) })

test('Tesoro parser reads ISIN, Spanish amounts and separate reference dates without adding indexed face values', () => {
  const parsed = parseTesoro(fixture)
  assert.deepEqual(parsed.referenceDates, { letras: '2026-10-16', bonos: '2026-10-20' })
  assert.deepEqual(parsed.securities, [
    { isin: 'ES0L02611066', instrument: 'letras', maturity: '2026-11-06', amount: 8989.2 },
    { isin: 'ES00000128S2', instrument: 'bonos', maturity: '2027-11-30', amount: 22998 },
    { isin: 'ES0000012I08', instrument: 'bonos', maturity: '2029-01-31', amount: 0 },
  ])
})

test('Tesoro parser rejects missing coverage, dates, unexpected units and absent or malformed amounts', () => {
  for (const invalid of [
    '<html>Error</html>', fixture.replace('tablaByo', 'other'),
    fixture.replace('Datos a 16/10/2026', 'Sin fecha'),
    fixture.replace('06/11/2026', '31/02/2026'),
    fixture.replace('Importes en millones de euros', 'Importes en miles de euros'),
    fixture.replace('8.989,2', '_'), fixture.replace('8.989,2', ''), fixture.replace('8.989,2', '8,989.2'),
    fixture.replace('<td>8.989,2</td>', ''), fixture.replace('ES0L02611066', 'invalid'),
  ]) assert.throws(() => parseTesoro(invalid))
  assert.equal(isCalendarDate('2024-02-29'), true)
  assert.equal(isCalendarDate('2025-02-29'), false)
})

test('maturity validation rejects duplicate values, invalid dates, metadata and incomplete snapshots', () => {
  assert.doesNotThrow(() => validateMaturitySnapshot(fixtureSnapshot()))
  const invalidCases = [
    null, {}, { ...fixtureSnapshot(), securities: [] },
    { ...fixtureSnapshot(), referenceDates: { letras: '2026-02-30', bonos: '2026-10-20' } },
    { ...fixtureSnapshot(), referenceDates: { letras: '2099-01-01', bonos: '2026-10-20' } },
    { ...fixtureSnapshot(), unit: 'Euros' },
    { ...fixtureSnapshot(), source: { ...snapshot.source, rawUrl: '../outside.html' } },
    { ...fixtureSnapshot(), source: { ...snapshot.source, url: 'https://example.com' } },
    { ...fixtureSnapshot(), securities: [fixtureSnapshot().securities[0]] },
  ]
  const duplicate = fixtureSnapshot()
  duplicate.securities.push(duplicate.securities[0])
  invalidCases.push(duplicate)
  for (const change of [
    { amount: NaN }, { amount: Infinity }, { amount: -1 }, { amount: '8989.2' }, { amount: 1.234 },
    { maturity: '2026-10-01' }, { maturity: '2026-02-31' }, { instrument: 'other' }, { isin: null },
  ]) {
    const data = fixtureSnapshot()
    Object.assign(data.securities[0], change)
    invalidCases.push(data)
  }
  for (const invalid of invalidCases) assert.throws(() => validateMaturitySnapshot(invalid))
})

test('annual aggregation sums each ISIN once, preserves precision and includes zero years between maturities', () => {
  assert.deepEqual(annualMaturities(parseTesoro(fixture).securities), [
    { year: 2026, letras: 8989.2, bonos: 0, total: 8989.2 },
    { year: 2027, letras: 0, bonos: 22998, total: 22998 },
    { year: 2028, letras: 0, bonos: 0, total: 0 },
    { year: 2029, letras: 0, bonos: 0, total: 0 },
  ])
  assert.deepEqual(annualMaturities([]), [])
  const small = ['letras', 'bonos'].map((instrument, i) => ({ instrument, maturity: '2027-01-01', amount: (i + 1) / 10 }))
  assert.equal(annualMaturities(small)[0].total, 0.3)
})

test('committed Tesoro snapshot matches the original, fingerprint and annual totals', async () => {
  validateMaturitySnapshot(snapshot)
  const raw = await readFile(new URL(`../public/${snapshot.source.rawUrl}`, import.meta.url))
  assert.equal(createHash('sha256').update(raw).digest('hex'), snapshot.source.hash)
  const parsed = parseTesoro(raw.toString('utf8'))
  assert.deepEqual(parsed.referenceDates, snapshot.referenceDates)
  assert.deepEqual(parsed.securities, snapshot.securities)
  const rows = annualMaturities(snapshot.securities)
  assert.equal(rows[0].year, Math.min(...snapshot.securities.map(s => Number(s.maturity.slice(0, 4)))))
  assert.equal(rows.at(-1).year, Math.max(...snapshot.securities.map(s => Number(s.maturity.slice(0, 4)))))
  assert.equal(rows.reduce((sum, row) => sum + Math.round(row.total * 10), 0),
    snapshot.securities.reduce((sum, s) => sum + Math.round(s.amount * 10), 0))
  for (const row of rows) {
    const securities = snapshot.securities.filter(s => Number(s.maturity.slice(0, 4)) === row.year)
    for (const instrument of ['letras', 'bonos']) {
      assert.equal(row[instrument], securities.filter(s => s.instrument === instrument).reduce((sum, s) => sum + Math.round(s.amount * 10), 0) / 10)
    }
  }
})

const history = JSON.parse(await readFile(new URL('../public/data/maturity-history.json', import.meta.url), 'utf8'))

test('historical captures reproduce archived official rows, reference dates and fingerprints for all seven years', async () => {
  validateMaturityHistory(history)
  assert.deepEqual(history.snapshots.map(s => s.source.archive.capturedAt.slice(0, 4)), ['2019', '2020', '2021', '2022', '2023', '2024', '2025'])
  for (const snapshot of history.snapshots) {
    const raw = await readFile(new URL(`../public/${snapshot.source.rawUrl}`, import.meta.url))
    assert.equal(createHash('sha256').update(raw).digest('hex'), snapshot.source.hash)
    const parsed = parseTesoro(raw.toString('utf8'), true)
    assert.deepEqual(parsed.referenceDates, snapshot.referenceDates)
    assert.deepEqual(parsed.securities, snapshot.securities)
    const rows = annualMaturities(snapshot.securities)
    assert.equal(Math.round(rows.reduce((sum, row) => sum + row.total, 0) * 10),
      snapshot.securities.reduce((sum, s) => sum + Math.round(s.amount * 10), 0))
  }
  // The January 2019 archive really contains December 2018 balances, not a 2019 year-end estimate.
  assert.deepEqual(history.snapshots[0].referenceDates, { letras: '2018-12-14', bonos: '2018-12-31' })
  const old2026 = annualMaturities(history.snapshots.at(-1).securities).find(row => row.year === 2026)
  assert.equal(old2026.total, 129705.3)
  assert.notEqual(old2026.total, annualMaturities(snapshot.securities).find(row => row.year === 2026).total)
  assert.ok(history.snapshots[0].securities.some(s => !snapshot.securities.some(current => current.isin === s.isin)))
})

test('historical validation rejects missing archives, duplicates, changed origin and dates beyond capture', () => {
  const invalidCases = [null, {}, { version: 1, snapshots: [] }, { version: 1, snapshots: [snapshot] },
    { version: 1, snapshots: [history.snapshots[0], history.snapshots[0]] }]
  for (const archive of [
    null, { capturedAt: 'not-a-date', url: 'https://example.com' },
    { ...history.snapshots[0].source.archive, url: 'https://example.com' },
    { ...history.snapshots[0].source.archive, capturedAt: '2019-02-30T02:25:17Z' },
    { ...history.snapshots[0].source.archive, capturedAt: '2018-01-01T00:00:00Z' },
  ]) {
    const data = structuredClone(history)
    data.snapshots[0].source.archive = archive
    invalidCases.push(data)
  }
  const futureReference = structuredClone(history)
  futureReference.snapshots[0].referenceDates.letras = '2019-01-08'
  invalidCases.push(futureReference)
  for (const invalid of invalidCases) assert.throws(() => validateMaturityHistory(invalid))
})

test('legacy parser explicitly rejects broken archival markup, empty tables and missing reference notes', async () => {
  const raw = await readFile(new URL(`../public/${history.snapshots.at(-1).source.rawUrl}`, import.meta.url), 'utf8')
  for (const invalid of [
    raw.replaceAll('Datos a', 'Sin fecha'),
    raw.replaceAll('Importes en millones de euros', 'Importes en euros'),
    raw.replaceAll('view-valores-del-tesoro', 'other-view'),
    raw.replace(/<tbody>[\s\S]*?<\/tbody>/, '<tbody></tbody>'),
  ]) assert.throws(() => parseTesoro(invalid, true))
  assert.throws(() => parseTesoro(raw), /Tabla del Tesoro/)
})
