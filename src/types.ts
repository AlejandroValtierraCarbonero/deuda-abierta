export type Point = [string, number]
export interface Series {
  code: string
  description: string
  unit: string
  frequency: string
  table: string
  points: Point[]
}
export interface Source {
  id: string
  title: string
  url: string
  rawUrl: string
  chapterUrl: string
  retrievedAt: string
  publishedAt: string | null
  hash: string
}
export interface Snapshot {
  version: number
  retrievedAt: string
  previousRetrievedAt: string | null
  revisions: { table: string; code: string; period: string; before: number; after: number | null }[]
  sources: Source[]
  series: Series[]
  catalog: { id: string; titulo: string; url: string; bloque: string; frecuencia: string }[]
}
export interface ChartLine {
  name: string
  color: string
  points: Point[]
}
export interface MaturitySecurity {
  isin: string
  instrument: 'letras' | 'bonos'
  maturity: string
  amount: number
}
export interface MaturitySnapshot {
  version: 1
  retrievedAt: string
  source: {
    title: string
    url: string
    rawUrl: string
    hash: string
  }
  referenceDates: { letras: string; bonos: string }
  unit: 'Millones de euros'
  securities: MaturitySecurity[]
}
