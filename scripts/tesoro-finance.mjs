import { load } from 'cheerio'
import { unzipSync, strFromU8 } from 'fflate'
import { posix } from 'node:path'
import { financeEqual, financeMonths, financeInstruments } from '../src/lib/finance.mjs'

const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim().toUpperCase()

export function parseFinancePublication(html) {
  const $ = load(html)
  const editions = [...$.text().matchAll(/Boletín\s+estadísticas\s+([a-záéíóú]+)\s+(\d{4})/gi)]
  const unique = new Set(editions.map(([, month, year]) => {
    const index = financeMonths.findIndex(name => normalize(name) === normalize(month))
    if (index < 0) throw new Error('Mes del boletín del Tesoro desconocido.')
    return `${year}-${String(index + 1).padStart(2, '0')}`
  }))
  if (unique.size !== 1) throw new Error('No se puede determinar una única edición del boletín del Tesoro.')
  return [...unique][0]
}

export function parseFinanceWorkbook(bytes, publication) {
  const zip = unzipSync(bytes)
  const xml = path => {
    if (!zip[path]) throw new Error(`Falta un documento del Excel: ${path}.`)
    return load(strFromU8(zip[path]), { xmlMode: true })
  }
  const strings = xml('xl/sharedStrings.xml')('si').toArray().map(node => {
    const $ = load(node, { xmlMode: true })
    return $('t').toArray().map(t => $(t).text()).join('')
  })
  const relations = xml('xl/_rels/workbook.xml.rels')
  const targets = new Map(relations('Relationship').toArray().map(node => {
    const el = relations(node)
    const target = el.attr('Target')
    if (!target || el.attr('TargetMode') === 'External') throw new Error('Relación Excel no admitida.')
    return [el.attr('Id'), posix.normalize(target.startsWith('/') ? target.slice(1) : `xl/${target}`)]
  }))
  const workbook = xml('xl/workbook.xml')
  const years = []
  for (const sheet of workbook('sheet').toArray()) {
    const target = targets.get(workbook(sheet).attr('r:id'))
    const $ = xml(target)
    const rows = $('sheetData > row').toArray().map(node => {
      const row = {}
      $(node).children('c').each((_, cell) => {
        const c = $(cell)
        const address = c.attr('r')?.replace(/\d+$/, '')
        const type = c.attr('t')
        const v = c.children('v').text()
        if (!address) throw new Error('Celda Excel sin dirección.')
        if (type === 's') {
          if (!/^\d+$/.test(v) || strings[Number(v)] === undefined) throw new Error('Texto Excel no válido.')
          row[address] = strings[Number(v)]
        } else if (type === 'inlineStr') row[address] = c.children('is').text()
        else if (v !== '') {
          if (type || !Number.isFinite(Number(v))) throw new Error(`Celda numérica no válida: ${c.attr('r')}.`)
          row[address] = Number(v)
        }
      })
      return row
    })
    if (!rows.some(row => normalize(row.B) === '(IMPORTES EFECTIVOS)')) continue
    const title = rows.map(row => normalize(row.B)).find(text => /^DEUDA DEL ESTADO\s*: FINANCIACIÓN NETA EN \d{4}$/.test(text))
    if (!title) throw new Error('Título de financiación no reconocido.')
    const year = Number(title.slice(-4))
    if (![Number(publication.slice(0, 4)), Number(publication.slice(0, 4)) - 1].includes(year)) throw new Error('El año del Excel no coincide con la edición del boletín.')
    const header = rows.find(row => normalize(row.O) === 'LETRAS')
    if (!header || !rows.some(row => normalize(row.Z) === '(MILLONES DE EUROS)')
      || !rows.some(row => normalize(row.O) === 'AMORTIZACIONES' && normalize(row.U) === 'FINANCIACION NETA')
      || !['BONOS', 'OBLIG.', 'BONOS Y OBLIG. INDEX.', 'RESTO Y ASUMIDAS', 'TOTAL'].every((text, i) => normalize(header[['P', 'Q', 'R', 'S', 'T'][i]]) === text)
      || normalize(header.N) !== 'TOTAL' || normalize(header.Z) !== 'TOTAL') {
      throw new Error('Han cambiado las unidades o columnas del cuadro de financiación.')
    }
    const amount = (row, column, blankZero = false) => {
      const value = row[column]
      if (value === undefined && blankZero) return 0
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Falta un importe numérico en ${column}, ${year}.`)
      return value
    }
    const months = []
    let pending = null
    const add = (row, month) => {
      const actual = year < Number(publication.slice(0, 4)) || month <= Number(publication.slice(5))
      const redemptions = amount(row, 'T')
      const instruments = Object.fromEntries(financeInstruments.map((key, i) => [key, amount(row, ['O', 'P', 'Q', 'R', 'S'][i], true)]))
      const emissions = actual ? amount(row, 'N') : null
      const net = actual ? amount(row, 'Z') : null
      if (actual && !financeEqual('CDEFGHIJKLM'.split('').reduce((sum, col) => sum + amount(row, col, true), 0), emissions)) {
        throw new Error(`No cuadra el total de emisiones de ${year}-${month}.`)
      }
      if (!actual && row.N !== undefined) throw new Error('Hay emisiones posteriores al corte del boletín; revisar la edición.')
      months.push({ month, status: actual ? 'actual' : 'forecast', emissions, redemptions, net, instruments })
    }
    for (const row of rows) {
      const month = financeMonths.findIndex(name => normalize(name) === normalize(row.B)) + 1
      if (month) {
        if (pending !== null) throw new Error('Falta un total mensual en el Excel.')
        if (row.T !== undefined) add(row, month)
        else pending = month
      } else if (normalize(row.B) === 'TOTAL' && pending !== null) {
        add(row, pending)
        pending = null
      }
    }
    if (pending !== null || months.length !== 12) throw new Error(`Faltan meses o totales en ${year}.`)
    const annual = rows.find(row => normalize(row.B) === 'TOTAL AÑO')
    if (!annual || !financeEqual(months.reduce((sum, row) => sum + row.redemptions, 0), amount(annual, 'T'))) {
      throw new Error(`No cuadra el total anual de amortizaciones de ${year}.`)
    }
    years.push({ year, months })
  }
  return years.sort((a, b) => b.year - a.year)
}
