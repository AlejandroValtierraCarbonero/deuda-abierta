export const maturitySourceUrl = 'https://www.tesoro.es/deuda-publica/valores-del-tesoro/valores-en-circulacion'

/** @param {unknown} value */
export function isCalendarDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}

/**
 * @param {unknown} data
 * @returns {asserts data is import('../types').MaturitySnapshot}
 */
export function validateMaturitySnapshot(data) {
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1
    || !('retrievedAt' in data) || typeof data.retrievedAt !== 'string' || !Number.isFinite(Date.parse(data.retrievedAt))
    || !('unit' in data) || data.unit !== 'Millones de euros'
    || !('source' in data) || !data.source || typeof data.source !== 'object'
    || !('referenceDates' in data) || !data.referenceDates || typeof data.referenceDates !== 'object'
    || !('securities' in data) || !Array.isArray(data.securities) || !data.securities.length) {
    throw new Error('El fichero de vencimientos no tiene el formato esperado.')
  }
  const { source, referenceDates, securities } = data
  if (!('url' in source) || source.url !== maturitySourceUrl
    || !('title' in source) || typeof source.title !== 'string' || !source.title.trim()
    || !('rawUrl' in source) || typeof source.rawUrl !== 'string'
    || !/^data\/raw\/[\w-]+\/tesoro-valores\.html\.txt$/.test(source.rawUrl)
    || !('hash' in source) || typeof source.hash !== 'string' || !/^[a-f0-9]{64}$/.test(source.hash)
    || !('letras' in referenceDates) || !isCalendarDate(referenceDates.letras)
    || !('bonos' in referenceDates) || !isCalendarDate(referenceDates.bonos)
    || referenceDates.letras > data.retrievedAt.slice(0, 10) || referenceDates.bonos > data.retrievedAt.slice(0, 10)) {
    throw new Error('Los metadatos de los vencimientos del Tesoro no son válidos.')
  }
  const seen = new Set()
  if ('archive' in source) {
    const archive = source.archive
    if (!archive || typeof archive !== 'object' || !('capturedAt' in archive) || typeof archive.capturedAt !== 'string'
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(archive.capturedAt)
      || !Number.isFinite(Date.parse(archive.capturedAt)) || new Date(archive.capturedAt).toISOString().replace('.000Z', 'Z') !== archive.capturedAt
      || archive.capturedAt > data.retrievedAt || !('url' in archive) || typeof archive.url !== 'string') {
      throw new Error('La procedencia de la captura histórica no es válida.')
    }
    const stamp = archive.capturedAt.replace(/\D/g, '')
    const allowedUrls = [maturitySourceUrl, maturitySourceUrl.replace('https:', 'http:').replace('.es/', '.es:80/')]
      .map(url => `https://web.archive.org/web/${stamp}id_/${url}`)
    if (!allowedUrls.includes(archive.url)
      || referenceDates.letras > archive.capturedAt.slice(0, 10) || referenceDates.bonos > archive.capturedAt.slice(0, 10)) {
      throw new Error('La URL o las fechas de la captura histórica no son válidas.')
    }
  }
  for (const security of securities) {
    if (!security || typeof security !== 'object' || !/^ES[A-Z0-9]{10}$/.test(security.isin)
      || seen.has(security.isin) || !['letras', 'bonos'].includes(security.instrument)
      || !isCalendarDate(security.maturity) || security.maturity < referenceDates[security.instrument]
      || typeof security.amount !== 'number' || !Number.isFinite(security.amount) || security.amount < 0
      || !Number.isSafeInteger(Math.round(security.amount * 10))
      || Math.abs(security.amount * 10 - Math.round(security.amount * 10)) > 1e-6) {
      throw new Error(`Valor del Tesoro inválido o duplicado: ${security?.isin ?? 'sin ISIN'}.`)
    }

    seen.add(security.isin)
  }
  if (!['letras', 'bonos'].every(instrument => securities.some(s => s.instrument === instrument))) {
    throw new Error('Falta la cobertura de letras o bonos y obligaciones del Tesoro.')
  }
}

/**
 * @param {unknown} data
 * @returns {asserts data is { version: 1, snapshots: import('../types').MaturitySnapshot[] }}
 */
export function validateMaturityHistory(data) {
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1
    || !('snapshots' in data) || !Array.isArray(data.snapshots) || !data.snapshots.length) {
    throw new Error('El histórico de vencimientos no tiene el formato esperado.')
  }
  const captures = new Set()
  for (const snapshot of data.snapshots) {
    validateMaturitySnapshot(snapshot)
    const capture = snapshot.source.archive?.capturedAt
    if (!capture || captures.has(capture)) throw new Error('Captura histórica ausente o duplicada.')
    captures.add(capture)
  }
}

/** @param {import('../types').MaturitySecurity[]} securities */
export function annualMaturities(securities) {
  if (!securities.length) return []
  const first = Math.min(...securities.map(s => Number(s.maturity.slice(0, 4))))
  const last = Math.max(...securities.map(s => Number(s.maturity.slice(0, 4))))
  const years = Array.from({ length: last - first + 1 }, (_, i) => ({ year: first + i, letras: 0, bonos: 0, total: 0 }))
  for (const security of securities) {
    const row = years[Number(security.maturity.slice(0, 4)) - first]
    // Sum in tenths of a million, the precision published by the Tesoro.
    row[security.instrument] += Math.round(security.amount * 10)
  }
  return years.map(row => ({ year: row.year, letras: row.letras / 10, bonos: row.bonos / 10, total: (row.letras + row.bonos) / 10 }))
}
