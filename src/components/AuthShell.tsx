import type { ReactNode } from 'react'
import logo from '../assets/logo.png'
import { isSupabaseConfigured } from '../lib/supabase'
import { Alert, Eyebrow } from './ui'

export function AuthShell({
  title,
  children,
  footer,
}: {
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <img src={logo} alt="Brasão da Loja" className="size-20" />
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-wide text-granada">
            Agenda do Salão
          </h1>
          <p className="font-display text-lg text-ouro">Irmão Cristiano Cano</p>
          <Eyebrow className="mt-1.5">Ciência e Justiça · Marialva</Eyebrow>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-4">
            <Alert tone="info">
              Configure <code>VITE_SUPABASE_URL</code> e{' '}
              <code>VITE_SUPABASE_ANON_KEY</code> em <code>.env.local</code> para
              ativar o acesso.
            </Alert>
          </div>
        )}

        <div className="plaque overflow-hidden">
          <div className="mosaico" />
          <div className="p-5">
            <h2 className="mb-5 text-center font-display text-xl font-semibold text-tinta">
              {title}
            </h2>
            {children}
          </div>
        </div>

        {footer && (
          <div className="mt-5 text-center font-body text-sm text-tinta-mid">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
