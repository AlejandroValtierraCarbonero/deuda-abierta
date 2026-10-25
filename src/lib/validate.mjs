import { valueAt } from './metrics.mjs'

/** @param {import('../types').Snapshot} data */
export function validateFinancialSnapshot(data) {
  const find = (table, code) => {
    const series = data.series.find(s => s.table === table && s.code === code)
    if (!series?.points.length) throw new Error(`Serie requerida ausente: ${table}:${code}`)
    return series
  }
  const required = [
    ['be11b', 'DMNPDE2010_P00000_PS_APU'],
    ['be1112', 'DTNPDE2010_P0000P_PS_APU'],
    ['be1113', 'DTNPDE2010_P00040_PS_APU'],
    ['be1113', 'DTNPDE2010_F30PRC_PS_APU'],
    ['be1113', 'DTNPDE2010_F40PRC_PS_APU'],
    ['be1113', 'DTNPDE2010_F30PRL_PS_APU'],
    ['be1113', 'DTNPDE2010_F40PRL_PS_APU'],
    ['be2108', 'DVL.M.N.ES.W0.S13.S1.N.LI.F.F3.T._Z.EUR._T.M.V.N._T'],
    ['be2109', 'DVL.M.N.ES.W0.S13.S1.N.L.F.F3.T._Z.EUR._T.M.V.N._T'],
  ]
  for (const [table, code] of required) find(table, code)
  for (const sector of ['AEC', 'ACS', 'ALS', 'ASG']) find('be1104', `DTNPDE2010_P00000_PS_${sector}`)
  const yields = data.series.filter(s => s.table === 'be2207' && s.unit === 'Porcentaje' && s.points.length)
  if (yields.length !== 5) throw new Error('Los tramos de rendimiento del cuadro 22.7 han cambiado; revisar la integración.')
  for (const table of ['be1309', 'be1310']) {
    if (data.series.filter(s => s.table === table && /_ACS_A[A-Z]{2}$/.test(s.code)).length !== 17) {
      throw new Error(`Cobertura territorial inesperada en ${table}`)
    }
  }
  const equal = (actual, expected, label) => {
    if (Math.abs(actual - expected) > 5) throw new Error(`Identidad contable no satisfecha (${label}): ${actual} frente a ${expected}`)
  }
  const sumAt = (table, codes, period) => {
    const values = codes.map(code => valueAt(find(table, code), period))
    // Las fechas historicas sin todos los componentes no se rellenan con cero.
    return values.some(v => v === null) ? null : values.reduce((a, b) => a + b, 0)
  }
  const total = find('be1112', 'DTNPDE2010_P00000_PS_APU')
  for (const [period, amount] of total.points.slice(-40)) {
    const instruments = sumAt('be1112', ['F20000', 'F30000', 'F40000'].map(c => `DTNPDE2010_${c}_PS_APU`), period)
    const holders = sumAt('be1113', ['P00020', 'P00050', 'P00060'].map(c => `DTNPDE2010_${c}_PS_APU`), period)
    if (instruments !== null) equal(instruments, amount, `instrumentos ${period}`)
    if (holders !== null) equal(holders, amount, `tenedores ${period}`)
  }
  const variation = find('be1108', 'DTNPDE2010_P00000_PF_APU')
  for (const [period, amount] of variation.points.slice(-40)) {
    const sum = sumAt('be1108', ['DTNSEC2010_S0000N_APU', 'DTNSEC2010_A00000_AF_APU', 'DTNPDE2010_AJO000_PF_APU'], period)
    if (sum !== null) equal(sum, amount, `conciliación ${period}`)
  }
  const keys = data.series.map(s => `${s.table}:${s.code}`)
  if (new Set(keys).size !== keys.length) throw new Error('Series duplicadas dentro de un mismo cuadro')
  for (const series of data.series) {
    if (!data.sources.some(s => s.id === series.table)) throw new Error(`Fuente ausente para ${series.table}`)
  }
}
