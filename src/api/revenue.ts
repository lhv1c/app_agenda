import { supabase } from '../lib/supabase'
import type { RevenueEntry } from '../types'

/** Anos distintos com reserva confirmada (pra preencher o seletor). */
export async function fetchRevenueYears(): Promise<number[]> {
  const { data, error } = await supabase
    .from('revenue_entries')
    .select('ano')
  if (error) throw error
  const anos = new Set<number>((data ?? []).map((r) => (r as { ano: number }).ano))
  anos.add(new Date().getFullYear())
  return [...anos].sort((a, b) => b - a) // mais recente primeiro
}

/** Linhas de receita de um ano (admin vê todas; RLS governa). */
export async function fetchRevenueEntries(ano: number): Promise<RevenueEntry[]> {
  const { data, error } = await supabase
    .from('revenue_entries')
    .select('*')
    .eq('ano', ano)
    .order('data', { ascending: true })
  if (error) throw error
  return (data ?? []) as RevenueEntry[]
}

/** Mapa id -> ordinal das confirmadas do próprio membro (selo na tela dele). */
export async function fetchMyRevenueOrdinals(
  userId: string,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('revenue_entries')
    .select('id, ordinal')
    .eq('user_id', userId)
  if (error) throw error
  const map: Record<string, number> = {}
  for (const r of data ?? []) {
    const row = r as { id: string; ordinal: number }
    map[row.id] = row.ordinal
  }
  return map
}

/** Salário mínimo cadastrado de um ano, ou null. */
export async function fetchSalarioMinimo(ano: number): Promise<number | null> {
  const { data, error } = await supabase
    .from('salario_minimo')
    .select('valor')
    .eq('ano', ano)
    .maybeSingle()
  if (error) throw error
  return data ? (data as { valor: number }).valor : null
}

/** Admin: cria/atualiza o salário mínimo de um ano. */
export async function upsertSalarioMinimo(
  ano: number,
  valor: number,
): Promise<void> {
  const { error } = await supabase
    .from('salario_minimo')
    .upsert(
      { ano, valor, updated_at: new Date().toISOString() },
      { onConflict: 'ano' },
    )
  if (error) throw error
}
