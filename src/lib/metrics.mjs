/** @param {import('../types').Series | undefined} series @param {string} period */
export function valueAt(series, period) {
  return series?.points.find(p => p[0] === period)?.[1] ?? null
}

/** @param {string} period */
export function yearAgo(period) {
  return `${Number(period.slice(0, 4)) - 1}${period.slice(4)}`
}

/** @param {import('../types').Series | undefined} series @param {string} period */
export function annualChange(series, period) {
  const current = valueAt(series, period)
  const before = valueAt(series, yearAgo(period))
  if (current === null || before === null || before === 0) return null
  return { absolute: current - before, percent: (current / before - 1) * 100 }
}

/** @param {import('../types').Series[]} series */
export function commonPeriods(series) {
  if (!series.length) return []
  return series[0].points.map(p => p[0]).filter(p => series.every(s => s.points.some(point => point[0] === p)))
}

/** @param {string | number} value */
export function escapeCsv(value) {
  return `"${String(value).replaceAll('"', '""')}"`
}

/** @param {import('../types').Series} series */
export function seriesCsv(series) {
  return '\uFEFF' + [['periodo', 'valor', 'unidad', 'codigo', 'cuadro'], ...series.points.map(([p, v]) => [p, v, series.unit, series.code, series.table])]
    .map(row => row.map(escapeCsv).join(',')).join('\r\n')
}
