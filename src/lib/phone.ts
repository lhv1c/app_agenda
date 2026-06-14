// Telefone BR para WhatsApp. Armazenamos só dígitos; exibimos com máscara e
// montamos o link wa.me com o código do país (55).

/** Só os dígitos de uma string (descarta máscara, espaços, etc.). */
export function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, '')
}

/**
 * Formata progressivamente no padrão BR enquanto o usuário digita:
 * `(44) 99999-9999` (celular, 11 dígitos) ou `(44) 9999-9999` (fixo, 10).
 */
export function maskPhone(raw: string): string {
  const d = phoneDigits(raw).slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** Telefone válido = DDD + número, 10 (fixo) ou 11 (celular) dígitos. */
export function isValidPhone(raw: string): boolean {
  const len = phoneDigits(raw).length
  return len === 10 || len === 11
}

/** Link de conversa no WhatsApp a partir dos dígitos BR (sem o 55). */
export function whatsappUrl(digits: string): string {
  return `https://wa.me/55${phoneDigits(digits)}`
}
