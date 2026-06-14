export type Role = 'member' | 'admin'

export type ReservationStatus =
  | 'pendente'
  | 'confirmada'
  | 'recusada'
  | 'cancelada'

export interface Profile {
  id: string
  nome: string
  email: string
  telefone: string | null
  role: Role
  created_at: string
}

export interface Reservation {
  id: string
  data: string // yyyy-MM-dd
  user_id: string
  num_convidados: number | null
  observacoes: string | null
  status: ReservationStatus
  created_at: string
  decided_at: string | null
  decided_by: string | null
}

/** Reservation joined with the requester's profile (admin views). */
export interface ReservationWithProfile extends Reservation {
  profile: Pick<Profile, 'nome' | 'email' | 'telefone'> | null
}

/** Aggregated availability per date, exposed to all members (no personal data). */
export interface DateAvailability {
  data: string // yyyy-MM-dd
  tem_confirmada: boolean
  qtd_pendentes: number
}
