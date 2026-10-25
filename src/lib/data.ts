import type { Snapshot, Series, ChartLine, Point } from '../types'

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const strings = (v: Record<string, unknown>, keys: string[]) => keys.every(k => typeof v[k] === 'string')
export function isSnapshot(v: unknown): v is Snapshot {
  if (!record(v) || v.version !== 1 || typeof v.retrievedAt !== 'string' || !Number.isFinite(Date.parse(v.retrievedAt))) return false
  if (!Array.isArray(v.sources) || !Array.isArray(v.series) || !Array.isArray(v.catalog) || !Array.isArray(v.revisions)) return false
  return v.sources.length > 0 && v.series.length > 0
    && v.sources.every(s => record(s) && strings(s, ['id', 'title', 'url', 'rawUrl', 'chapterUrl', 'retrievedAt', 'hash']))
    && v.catalog.every(s => record(s) && strings(s, ['id', 'titulo', 'url', 'bloque', 'frecuencia']))
    && v.series.every(s => record(s) && strings(s, ['code', 'description', 'unit', 'frequency', 'table'])
      && Array.isArray(s.points) && s.points.every(p => Array.isArray(p) && p.length === 2 && typeof p[0] === 'string'
        && /^\d{4}-(0[1-9]|1[0-2])$/.test(p[0]) && typeof p[1] === 'number' && Number.isFinite(p[1])))
}

export function requiredSeries(data: Snapshot, table: string, code: string): Series {
  const series = data.series.find(s => s.table === table && s.code === code)
  if (!series?.points.length) throw new Error(`La serie ${code} del cuadro ${table} no está disponible.`)
  return series
}
export const palette = ['#24715b', '#809d55', '#c38b54', '#7b91ad', '#a78eaa']
export function lineFor(series: Series, name: string, end: string, years: number, ratio = false, color = palette[0]): ChartLine {
  const start = years ? `${Number(end.slice(0, 4)) - years}${end.slice(4)}` : '0000-00'
  return { name, color, points: series.points.filter(([p]) => p >= start && p <= end)
    .map(([p, v]): Point => [p, ratio ? v : convertToBillions(v, series.unit)]) }
}
export function convertToBillions(value: number, unit: string): number {
  if (unit === 'Miles de euros') return value / 1e6
  if (unit === 'Millones de euros') return value / 1e3
  if (unit === 'Euros') return value / 1e9
  return value
}
