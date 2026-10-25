export const number = (n: number, digits = 1) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n)
export function periodLabel(period: string, frequency = 'TRIMESTRAL'): string {
  const [year, month] = period.split('-')
  if (frequency === 'TRIMESTRAL') return `${Math.ceil(Number(month) / 3)}T ${year}`
  return new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${period}-01T00:00:00Z`))
}
export function displayValue(value: number | null, unit: string): string {
  if (value === null) return 'No disponible'
  if (/porcentaje|porcentajes|por cien|%/i.test(unit)) return `${number(value)} %`
  if (unit === 'Miles de euros') return `${number(value / 1e6)} mil M€`
  if (unit === 'Millones de euros') return `${number(value / 1e3)} mil M€`
  if (unit === 'Euros') return `${number(value / 1e9)} mil M€`
  return `${number(value)} ${unit}`
}
export const dateLabel = (date: string) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date))
