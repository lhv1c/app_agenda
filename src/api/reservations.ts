import { supabase } from '../lib/supabase'
import type { Reservation, ReservationWithProfile } from '../types'

export interface NewReservation {
  data: string // yyyy-MM-dd
  num_convidados: number | null
  observacoes: string | null
}

/** Create a pre-reservation (status defaults to 'pendente' in the DB). */
export async function createReservation(
  userId: string,
  input: NewReservation,
): Promise<Reservation> {
  const { data, error } = await supabase
    .from('reservations')
    .insert({
      user_id: userId,
      data: input.data,
      num_convidados: input.num_convidados,
      observacoes: input.observacoes,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Reservation
}

/** The signed-in member's own reservations, newest event first. */
export async function fetchMyReservations(
  userId: string,
): Promise<Reservation[]> {
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('user_id', userId)
    .order('data', { ascending: true })
  if (error) throw error
  return (data ?? []) as Reservation[]
}

/** Member cancels their own pending reservation. */
export async function cancelReservation(id: string): Promise<void> {
  const { error } = await supabase
    .from('reservations')
    .update({ status: 'cancelada' })
    .eq('id', id)
  if (error) throw error
}

/** Admin: all pending requests with requester info, grouped-friendly order. */
export async function fetchPendingReservations(): Promise<
  ReservationWithProfile[]
> {
  const { data, error } = await supabase
    .from('reservations')
    .select('*, profile:profiles(nome, email)')
    .eq('status', 'pendente')
    .order('data', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ReservationWithProfile[]
}

/** Admin: confirmed reservations, soonest event first (controle de agenda). */
export async function fetchConfirmedReservations(): Promise<
  ReservationWithProfile[]
> {
  const { data, error } = await supabase
    .from('reservations')
    .select('*, profile:profiles(nome, email)')
    .eq('status', 'confirmada')
    .order('data', { ascending: true })
  if (error) throw error
  return (data ?? []) as ReservationWithProfile[]
}

/**
 * Admin confirms a reservation. A DB trigger auto-rejects the other pending
 * requests for the same date.
 */
export async function confirmReservation(id: string): Promise<void> {
  const { error } = await supabase
    .from('reservations')
    .update({ status: 'confirmada' })
    .eq('id', id)
  if (error) throw error
}

/** Admin rejects a single pending reservation. */
export async function rejectReservation(id: string): Promise<void> {
  const { error } = await supabase
    .from('reservations')
    .update({ status: 'recusada' })
    .eq('id', id)
  if (error) throw error
}
