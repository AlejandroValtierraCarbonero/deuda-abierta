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
