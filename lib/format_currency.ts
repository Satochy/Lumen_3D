const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/**
 * Formata um valor em reais ("R$ 1.234,56").
 *
 * Recebe sempre `number`: no servidor, converta `Prisma.Decimal` com
 * `.toNumber()` (ou use `serializeProduct`) antes de chamar.
 */
export function formatCurrency(value: number): string {
  return brl.format(value)
}
