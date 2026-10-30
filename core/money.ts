/** Redondeo monetario a 2 decimales (PEN). */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function calcIgvFromTotal(
  totalConIgv: number,
  igvPorcentaje: number,
  afectacion: '10' | '20' | '30'
): { subtotal: number; igv: number; total: number } {
  const total = roundMoney(totalConIgv)

  if (afectacion !== '10') {
    return { subtotal: total, igv: 0, total }
  }

  const factor = 1 + igvPorcentaje / 100
  const subtotal = roundMoney(total / factor)
  const igv = roundMoney(total - subtotal)
  return { subtotal, igv, total }
}

export function formatPen(value: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN'
  }).format(value)
}
