import logo from '../assets/logo.png'

export function Header() {
  return (
    <header className="bg-pergaminho-2">
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-4">
        <img src={logo} alt="Brasão da Loja" className="size-16 shrink-0" />
        <div className="flex flex-col justify-center">
          <p className="font-display text-2xl font-semibold leading-none text-granada">
            Ciência e Justiça
          </p>
          <p className="font-display text-lg leading-tight text-ouro">
            Loja Maçônica
          </p>
          <p className="eyebrow mt-1 block">Oriente de Marialva</p>
        </div>
      </div>
      {/* Assinatura: piso mosaico da Loja. */}
      <div className="mosaico" />
    </header>
  )
}
