const months = { ENE: '01', FEB: '02', MAR: '03', ABR: '04', MAY: '05', JUN: '06', JUL: '07', AGO: '08', SEP: '09', OCT: '10', NOV: '11', DIC: '12' }

export function parseCsv(text) {
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++ }
      else quoted = !quoted
    } else if (c === ',' && !quoted) { row.push(field); field = '' }
    else if (c === '\n' && !quoted) {
      row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''
    } else field += c
  }
  if (quoted) throw new Error('CSV con comillas sin cerrar')
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row) }
  return rows.filter(r => r.some(cell => cell.trim()))
}

export function parsePeriod(label) {
  const match = label.trim().match(/^([A-Z]{3}) (\d{4})$/)
  if (!match || !months[match[1]]) throw new Error(`Periodo no reconocido: ${label}`)
  return `${match[2]}-${months[match[1]]}`
}

export function decodeCsv(bytes) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch (error) {
    if (!(error instanceof TypeError)) throw error
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

export function parseBde(text, table) {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''))
  if (!rows[0]?.[0].includes('CÓDIGO DE LA SERIE')) throw new Error(`${table}: cabecera oficial ausente`)
  const metadata = (label) => {
    const row = rows.find(r => r[0] === label)
    if (!row) throw new Error(`${table}: faltan metadatos ${label}`)
    return row
  }
  const descriptions = metadata('DESCRIPCIÓN DE LA SERIE')
  const units = metadata('DESCRIPCIÓN DE LAS UNIDADES')
  const frequencies = metadata('FRECUENCIA')
  const data = rows.filter(r => /^[A-Z]{3} \d{4}$/.test(r[0]))
  if (!data.length) throw new Error(`${table}: no hay observaciones`)
  const series = rows[0].slice(1).map((code, i) => ({
    code, description: descriptions[i + 1], unit: units[i + 1],
    frequency: frequencies[i + 1], table, points: [],
  }))
  for (const row of data) {
    if (row.length !== series.length + 1) throw new Error(`${table}: columnas incompletas en ${row[0]}`)
    const period = parsePeriod(row[0])
    series.forEach((s, i) => {
      const cell = row[i + 1].trim()
      if (['_', '...', ''].includes(cell)) return
      if (!/^[+-]?\d+(?:\.\d+)?$/.test(cell)) throw new Error(`${table}: valor no reconocido "${cell}" en ${s.code}`)
      const value = Number(cell)
      if (!Number.isFinite(value)) throw new Error(`${table}: valor no finito`)
      s.points.push([period, Object.is(value, -0) ? 0 : value])
    })
  }
  for (const s of series) {
    s.points.sort((a, b) => a[0].localeCompare(b[0]))
    if (new Set(s.points.map(p => p[0])).size !== s.points.length) throw new Error(`${table}: periodos duplicados en ${s.code}`)
  }
  return series
}
