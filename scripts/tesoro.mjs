import { load } from 'cheerio'
import { isCalendarDate } from '../src/lib/maturities.mjs'

function calendarDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  const date = match && `${match[3]}-${match[2]}-${match[1]}`
  if (!isCalendarDate(date)) throw new Error(`Fecha del Tesoro inválida: ${value}`)
  return date
}

export function parseTesoro(html) {
  const $ = load(html)
  const securities = []
  const referenceDates = {}
  for (const [id, instrument, columns] of [['tablaLetras', 'letras', 3], ['tablaByo', 'bonos', 5]]) {
    const table = $(`table#${id}`)
    const section = table.closest('.circ-section')
    const headers = table.find('thead th').map((_, cell) => $(cell).text().trim()).get()
    if (table.length !== 1 || headers.length !== columns || headers[0] !== 'Código ISIN'
      || headers[1] !== 'Fecha de vencimiento' || !headers[2].startsWith('Saldo en circulación')
      || !/Importes en millones de euros/.test(section.find('.circ-section-sub').text())) {
      throw new Error(`Tabla del Tesoro ausente o con formato inesperado: ${id}`)
    }
    const reference = /Datos a (\d{2}\/\d{2}\/\d{4})/.exec(section.find('.circ-footnote').text())
    if (!reference) throw new Error(`Falta la fecha de referencia del Tesoro: ${id}`)
    referenceDates[instrument] = calendarDate(reference[1])
    const rows = table.find('tbody tr')
    if (!rows.length) throw new Error(`La tabla del Tesoro está vacía: ${id}`)
    rows.each((_, row) => {
      const cells = $(row).children('td').map((_, cell) => $(cell).text().trim()).get()
      const isin = /^ES[A-Z0-9]{10}(?=\s|$)/.exec(cells[0] ?? '')?.[0]
      if (cells.length !== columns || !isin || !/^(?:\d{1,3}(?:\.\d{3})+|\d+),\d$/.test(cells[2])) {
        throw new Error(`Fila del Tesoro inválida: ${cells.join(' | ')}`)
      }
      securities.push({ isin, instrument, maturity: calendarDate(cells[1]), amount: Number(cells[2].replaceAll('.', '').replace(',', '.')) })
    })
  }
  return { referenceDates, securities }
}
