export const financeSourceUrl = 'https://www.tesoro.es/documents/d/tesoro/13-xlsx'
export const financePdfUrl = 'https://www.tesoro.es/documents/d/tesoro/13-pdf'
export const financeBulletinUrl = 'https://www.tesoro.es/deuda-publica/estad%C3%ADsticas-mensuales'
export const financeMonths = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
export const financeInstruments = ['letras', 'bonos', 'obligaciones', 'indexados', 'resto']

/** @param {number} a @param {number} b */
export const financeEqual = (a, b) => Math.abs(a - b) < 0.00001

/**
 * @param {unknown} data
 * @returns {asserts data is import('../types').FinanceSnapshot}
 */
export function validateFinanceSnapshot(data) {
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1
    || !('retrievedAt' in data) || typeof data.retrievedAt !== 'string' || !Number.isFinite(Date.parse(data.retrievedAt))
    || !('publication' in data) || typeof data.publication !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(data.publication)
    || data.publication > data.retrievedAt.slice(0, 7)
    || !('unit' in data) || data.unit !== 'Millones de euros'
    || !('source' in data) || !data.source || typeof data.source !== 'object'
    || !('years' in data) || !Array.isArray(data.years) || data.years.length !== 2) {
    throw new Error('El fichero de financiación del Tesoro no tiene el formato esperado.')
  }
  const source = data.source
  if (!('url' in source) || source.url !== financeSourceUrl || !('pdfUrl' in source) || source.pdfUrl !== financePdfUrl
    || !('rawUrl' in source) || typeof source.rawUrl !== 'string' || !/^data\/raw\/[\w-]+\/tesoro-finance\.xlsx$/.test(source.rawUrl)
    || !('bulletinRawUrl' in source) || typeof source.bulletinRawUrl !== 'string' || !/^data\/raw\/[\w-]+\/tesoro-bulletin\.html\.txt$/.test(source.bulletinRawUrl)
    || !('hash' in source) || typeof source.hash !== 'string' || !/^[a-f0-9]{64}$/.test(source.hash)
    || !('bulletinHash' in source) || typeof source.bulletinHash !== 'string' || !/^[a-f0-9]{64}$/.test(source.bulletinHash)) {
    throw new Error('La procedencia de la financiación del Tesoro no es válida.')
  }
  const year = Number(data.publication.slice(0, 4))
  const cutoff = Number(data.publication.slice(5))
  const seen = new Set()
  for (const entry of data.years) {
    if (!entry || ![year, year - 1].includes(entry.year) || seen.has(entry.year)
      || !Array.isArray(entry.months) || entry.months.length !== 12) {
      throw new Error('Faltan años o meses de financiación, o están duplicados.')
    }
    seen.add(entry.year)
    for (const [index, row] of entry.months.entries()) {
      const actual = entry.year < year || index < cutoff
      if (!row || row.month !== index + 1 || row.status !== (actual ? 'actual' : 'forecast')
        || typeof row.redemptions !== 'number' || !Number.isFinite(row.redemptions) || row.redemptions < 0
        || !row.instruments || typeof row.instruments !== 'object'
        || !financeInstruments.every(key => typeof row.instruments[key] === 'number'
          && Number.isFinite(row.instruments[key]) && row.instruments[key] >= 0)
        || !financeEqual(financeInstruments.reduce((sum, key) => sum + row.instruments[key], 0), row.redemptions)
        || (actual ? typeof row.emissions !== 'number' || !Number.isFinite(row.emissions) || row.emissions < 0
          || typeof row.net !== 'number' || !Number.isFinite(row.net) || !financeEqual(row.emissions - row.redemptions, row.net)
          : row.emissions !== null || row.net !== null)) {
        throw new Error(`Importes o estado de financiación inválidos: ${entry.year}-${index + 1}.`)
      }
    }
  }
}

/** @param {import('../types').FinanceMonth[]} months */
export function actualFinanceTotals(months) {
  const actual = months.filter(row => row.status === 'actual')
  return {
    emissions: actual.reduce((sum, row) => sum + row.emissions, 0),
    redemptions: actual.reduce((sum, row) => sum + row.redemptions, 0),
    net: actual.reduce((sum, row) => sum + row.net, 0),
    instruments: Object.fromEntries(financeInstruments.map(key => [key, actual.reduce((sum, row) => sum + row.instruments[key], 0)])),
  }
}
