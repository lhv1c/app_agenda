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
  ativo: boolean
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

/** Data bloqueada pelo admin (indisponível para reserva). */
export interface BlockedDate {
  data: string // yyyy-MM-dd
  motivo: string
}

/** Linha do relatório de receita (view revenue_entries). Uma por confirmada. */
export interface RevenueEntry {
  id: string
  user_id: string
  nome: string
  data: string // yyyy-MM-dd
  ano: number
  ordinal: number
  rate: number // 0.20 (1ª/2ª) | 0.40 (extra)
  sm: number | null // salário mínimo do ano, ou null se não cadastrado
}

/** Perfil enxuto para a tela de gestão de membros (admin). */
export interface Member {
  id: string
  nome: string
  email: string
  telefone: string | null
  role: Role
  ativo: boolean
}
