import { supabase } from '../lib/supabase'
import type { DateAvailability } from '../types'

/** Availability rows between two ISO dates (inclusive). */
export async function fetchAvailability(
  fromISO: string,
  toISO: string,
): Promise<DateAvailability[]> {
  const { data, error } = await supabase
    .from('date_availability')
    .select('*')
    .gte('data', fromISO)
    .lte('data', toISO)
  if (error) throw error
  return (data ?? []) as DateAvailability[]
}
