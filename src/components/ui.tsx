import { useState } from 'react'
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from 'react'

type Variant = 'primary' | 'gold' | 'outline' | 'ghost'

const variants: Record<Variant, string> = {
  primary:
    'bg-granada text-pergaminho-2 hover:bg-granada-dark disabled:bg-granada/45 shadow-sm',
  gold: 'bg-ouro text-pergaminho-2 hover:bg-ouro/85 disabled:bg-ouro/45 shadow-sm',
  outline:
    'border border-ouro/60 text-granada bg-transparent hover:bg-ouro/10',
  ghost: 'text-granada hover:bg-granada/5',
}

export function Button({
  variant = 'primary',
  className = '',
  loading = false,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  loading?: boolean
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 font-mono text-xs font-medium uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  )
}

const fieldClass =
  'w-full rounded-[var(--radius-prancha)] border border-linha bg-pergaminho-2 px-3 py-2.5 font-body text-sm text-tinta outline-none transition-colors placeholder:text-tinta-mid/60 focus:border-ouro focus:ring-2 focus:ring-ouro/20'

export function Input({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldClass} ${className}`} {...props} />
}

/** Campo de senha com botão de mostrar/ocultar. */
export function PasswordInput({
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        className={`${fieldClass} pr-10 ${className}`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-tinta-mid/70 transition-colors hover:text-granada"
      >
        {visible ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4.5" aria-hidden>
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
            <line x1="2" x2="22" y1="2" y2="22" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4.5" aria-hidden>
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  )
}

export function Textarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldClass} ${className}`} {...props} />
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  )
}

/** Framed plaque surface — the double-rule diploma frame. */
export function Card({
  className = '',
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return <div className={`plaque p-5 ${className}`}>{children}</div>
}

/** Standardized page/section heading: eyebrow + title + optional description. */
export function PageHeader({
  eyebrow,
  title,
  description,
  as: Tag = 'h1',
}: {
  eyebrow: string
  title: string
  description?: string
  as?: 'h1' | 'h2'
}) {
  return (
    <div>
      <span className="eyebrow">{eyebrow}</span>
      <Tag className="mt-1 font-display text-3xl font-semibold leading-tight text-granada">
        {title}
      </Tag>
      {description && (
        <p className="mt-2 font-body text-sm leading-snug text-tinta-mid">
          {description}
        </p>
      )}
    </div>
  )
}

/** Small-caps engraved label, for eyebrows and data captions. */
export function Eyebrow({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <span className={`eyebrow ${className}`}>{children}</span>
}

/** Gold hairline divider with a centered lozenge — section break. */
export function Rule({ className = '' }: { className?: string }) {
  return (
    <div className={`rule-ornament ${className}`} aria-hidden>
      <span className="text-xs leading-none">&#9670;</span>
    </div>
  )
}

export function Spinner({ className = 'size-6' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin text-current ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Carregando"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  )
}

export function Alert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'success' | 'info'
  children: ReactNode
}) {
  const tones = {
    error: 'border-granada/30 bg-granada/5 text-granada-dark',
    success: 'border-ouro/40 bg-ouro/10 text-tinta',
    info: 'border-linha bg-pergaminho text-tinta-mid',
  }
  return (
    <div
      className={`rounded-[var(--radius-prancha)] border px-3 py-2 font-body text-sm ${tones[tone]}`}
    >
      {children}
    </div>
  )
}
