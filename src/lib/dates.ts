import {
  addDays,
  startOfDay,
  isWithinInterval,
  format,
  parseISO,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

/**
 * Reservation window: opens 60 days before, closes 3 days before the event.
 * "Fecha 3 dias antes" = bloqueado quando faltam 3 dias ou menos, logo o
 * primeiro dia reservável é hoje + 4 (ex.: sexta → terça).
 */
export const MIN_DAYS_AHEAD = 4
export const MAX_DAYS_AHEAD = 60

export interface WindowBounds {
  min: Date
  max: Date
}

/** First and last bookable dates, relative to today (local time). */
export function windowBounds(today = new Date()): WindowBounds {
  const base = startOfDay(today)
  return {
    min: addDays(base, MIN_DAYS_AHEAD),
    max: addDays(base, MAX_DAYS_AHEAD),
  }
}

/** True when a date falls inside the bookable window. */
export function isBookable(date: Date, today = new Date()): boolean {
  const { min, max } = windowBounds(today)
  return isWithinInterval(startOfDay(date), { start: min, end: max })
}

/** Serialize to the `yyyy-MM-dd` form stored in Postgres `date` columns. */
export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/** Parse a `yyyy-MM-dd` string as a local date (no timezone shift). */
export function fromISODate(iso: string): Date {
  return parseISO(iso)
}

/** Human label like "quinta-feira, 11 de junho de 2026". */
export function formatLong(date: Date): string {
  return format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
}

/** Short label like "11/06/2026". */
export function formatShort(date: Date): string {
  return format(date, 'dd/MM/yyyy', { locale: ptBR })
}
