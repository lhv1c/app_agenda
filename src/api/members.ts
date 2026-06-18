import { supabase } from '../lib/supabase'
import type { Member, Role } from '../types'

/** Todos os perfis, ordenados por nome (admin gerencia). */
export async function fetchMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nome, email, telefone, role, ativo')
    .order('nome', { ascending: true })
  if (error) throw error
  return (data ?? []) as Member[]
}

/** Promove/rebaixa papel. As travas anti-lockout vivem no trigger; o update
 *  falha com a mensagem do raise, que a UI mostra. */
export async function setRole(id: string, role: Role): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', id)
  if (error) throw error
}

/** Desativa/reativa conta (flag; preserva histórico). */
export async function setActive(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ ativo })
    .eq('id', id)
  if (error) throw error
}
