import { load } from 'cheerio'
import { isCalendarDate } from '../src/lib/maturities.mjs'

function calendarDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  const date = match && `${match[3]}-${match[2]}-${match[1]}`
  if (!isCalendarDate(date)) throw new Error(`Fecha del Tesoro inválida: ${value}`)
  return date
}

export function parseTesoro(html, legacy = false) {
  const $ = load(html)
  const securities = []
  const referenceDates = {}
  for (const [id, instrument, columns] of [['tablaLetras', 'letras', 3], ['tablaByo', 'bonos', 5]]) {
    const table = legacy
      ? $('.view-valores-del-tesoro table').filter((_, element) => $(element).find('thead th').length === columns)
      : $(`table#${id}`)
    const section = table.closest(legacy ? '.view-valores-del-tesoro' : '.circ-section')
    const headers = table.find('thead th').map((_, cell) => $(cell).text().trim()).get()
    if (table.length !== 1 || headers.length !== columns || headers[0] !== 'Código ISIN'
      || headers[1] !== 'Fecha de vencimiento' || !headers[2].startsWith('Saldo en circulación')
      || !/Importes en millones de euros/.test(legacy ? section.children('.view-header').text() : section.find('.circ-section-sub').text())
      || (legacy && !(instrument === 'letras' ? /Letras del Tesoro/ : /Bonos y Obligaciones/).test(section.children('.view-header').text()))) {
      throw new Error(`Tabla del Tesoro ausente o con formato inesperado: ${id}`)
    }
    const footer = legacy ? section.children('.view-footer').clone() : section.find('.circ-footnote')
    if (legacy) footer.find('.view-valores-del-tesoro').remove()
    const reference = /Datos a (\d{2}\/\d{2}\/\d{4})/.exec(footer.text())
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
