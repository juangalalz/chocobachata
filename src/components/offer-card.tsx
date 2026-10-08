import { BuyButton } from "@/components/buy-button";
import { offer } from "@/lib/offer";

const buttonClass =
  "flex h-14 w-full items-center justify-center rounded-md bg-gold text-base font-semibold text-[#1a1408] transition hover:bg-gold-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

export function OfferCard() {
  return (
    <article className="relative mt-2 rounded-2xl sm:mt-3 border border-line bg-card shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <div className="h-1 bg-gold" />
      <p className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-gold px-3 py-1 text-xs font-bold tracking-wide text-[#1a1408]">
        Antes {offer.previousPrice} {offer.currency}
      </p>
      <div className="px-5 pt-5 pb-6 sm:px-6 sm:pt-6">
        <h2 className="text-center text-lg font-bold tracking-tight sm:text-xl">
          {offer.name}
        </h2>
        <p className="mt-2 text-center leading-none sm:mt-3">
          <span className="font-display text-5xl font-extrabold tracking-tight sm:text-6xl">
            {offer.price}
          </span>
          <span className="ml-1 align-top text-2xl font-semibold text-gold-soft">
            {offer.currency}
          </span>
        </p>
        <p className="mt-2 text-center text-xs font-semibold tracking-[0.18em] text-gold uppercase">
          Pago único · IVA incluido
        </p>
        <BuyButton className={`${buttonClass} mt-4`}>Comprar ahora</BuyButton>
        <p className="mt-4 text-center text-sm text-muted">
          Los tres niveles son tuyos. Los ves cuando quieras, las veces que
          quieras. Sin caducidad.
        </p>
        <p className="mt-3 text-center text-xs leading-5 text-muted">
          Pago seguro con tarjeta. Recibirás el acceso en tu correo, sin
          necesidad de crear una cuenta para comprar.
        </p>
        <ul className="mt-5 space-y-2 border-t border-white/10 pt-4 text-center text-sm text-ink">
          {offer.levels.map((level) => (
            <li key={level.name}>{level.name}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}
