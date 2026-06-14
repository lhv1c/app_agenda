import { supabase } from '../lib/supabase'
import type { BlockedDate } from '../types'

/** Datas bloqueadas entre dois ISO dates (inclusive). */
export async function fetchBlockedDates(
  fromISO: string,
  toISO: string,
): Promise<BlockedDate[]> {
  const { data, error } = await supabase
    .from('blocked_dates')
    .select('data, motivo')
    .gte('data', fromISO)
    .lte('data', toISO)
    .order('data', { ascending: true })
  if (error) throw error
  return (data ?? []) as BlockedDate[]
}

/** Admin: bloqueia uma data. Trigger rejeita se houver reserva confirmada. */
export async function blockDate(data: string, motivo: string): Promise<void> {
  const { error } = await supabase
    .from('blocked_dates')
    .insert({ data, motivo })
  if (error) throw error
}

/** Admin: remove o bloqueio de uma data. */
export async function unblockDate(data: string): Promise<void> {
  const { error } = await supabase.from('blocked_dates').delete().eq('data', data)
  if (error) throw error
}
