const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/** Formata número em Real brasileiro (ex.: 1234.5 -> "R$ 1.234,50"). */
export function formatBRL(value: number): string {
  return brl.format(value)
}
