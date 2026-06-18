import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/context'
import { fetchMembers, setActive, setRole } from '../../api/members'
import { maskPhone, whatsappUrl } from '../../lib/phone'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
} from '../../components/ui'
import type { Member } from '../../types'

export function MembersPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const meId = profile?.id ?? null
  const [erro, setErro] = useState<string | null>(null)

  const membersQuery = useQuery({
    queryKey: ['members'],
    queryFn: fetchMembers,
  })

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'admin' | 'member' }) =>
      setRole(id, role),
    onSuccess: () => {
      setErro(null)
      queryClient.invalidateQueries({ queryKey: ['members'] })
    },
    onError: (e: unknown) =>
      setErro(e instanceof Error ? e.message : 'Falha ao alterar o papel.'),
  })

  const activeMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      setActive(id, ativo),
    onSuccess: () => {
      setErro(null)
      queryClient.invalidateQueries({ queryKey: ['members'] })
    },
    onError: (e: unknown) =>
      setErro(e instanceof Error ? e.message : 'Falha ao alterar o status.'),
  })

  const busy = roleMutation.isPending || activeMutation.isPending
  const members = membersQuery.data ?? []

  function promover(m: Member) {
    setErro(null)
    roleMutation.mutate({ id: m.id, role: 'admin' })
  }
  function rebaixar(m: Member) {
    if (!window.confirm(`Rebaixar ${m.nome} a membro?`)) return
    setErro(null)
    roleMutation.mutate({ id: m.id, role: 'member' })
  }
  function desativar(m: Member) {
    if (!window.confirm(`Desativar a conta de ${m.nome}? Ele não poderá entrar nem reservar até ser reativado.`)) return
    setErro(null)
    activeMutation.mutate({ id: m.id, ativo: false })
  }
  function reativar(m: Member) {
    setErro(null)
    activeMutation.mutate({ id: m.id, ativo: true })
  }

  return (
    <section className="space-y-6">
      <PageHeader as="h2" eyebrow="Secretaria" title="Membros" />

      {erro && <Alert tone="error">{erro}</Alert>}

      {membersQuery.isLoading ? (
        <div className="flex justify-center py-10 text-granada">
          <Spinner className="size-7" />
        </div>
      ) : members.length === 0 ? (
        <EmptyState>Nenhum membro cadastrado.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {members.map((m) => {
            const isSelf = m.id === meId
            const isAdmin = m.role === 'admin'
            return (
              <Card
                key={m.id}
                className={`space-y-3 ${m.ativo ? '' : 'opacity-60'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-lg text-granada">{m.nome}</p>
                    <p className="font-body text-sm text-tinta-mid break-all">
                      {m.email}
                    </p>
                    {m.telefone && (
                      <a
                        href={whatsappUrl(m.telefone)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-body text-sm text-granada underline decoration-ouro underline-offset-2"
                      >
                        {maskPhone(m.telefone)}
                      </a>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-block rounded-[4px] border px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.1em] ${
                        isAdmin
                          ? 'border-ouro/60 bg-ouro/10 text-ouro'
                          : 'border-linha bg-pergaminho text-tinta-mid'
                      }`}
                    >
                      {isAdmin ? 'Admin' : 'Membro'}
                    </span>
                    {!m.ativo && (
                      <span className="inline-block rounded-[4px] border border-linha bg-pergaminho px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.1em] text-tinta-mid">
                        Inativo
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {isAdmin ? (
                    <Button
                      variant="outline"
                      onClick={() => rebaixar(m)}
                      disabled={busy || isSelf}
                    >
                      Rebaixar a membro
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => promover(m)}
                      disabled={busy}
                    >
                      Tornar admin
                    </Button>
                  )}
                  {m.ativo ? (
                    <Button
                      variant="ghost"
                      onClick={() => desativar(m)}
                      disabled={busy || isSelf}
                    >
                      Desativar
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      onClick={() => reativar(m)}
                      disabled={busy}
                    >
                      Reativar
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </ul>
      )}
    </section>
  )
}
