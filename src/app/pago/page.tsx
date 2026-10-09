import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pago",
  robots: { index: false, follow: false },
};

export default function PagoPage() {
  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-20">
      <p className="text-sm font-semibold tracking-[0.16em] text-gold uppercase">
        Pago con tarjeta
      </p>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight">
        El cobro se conecta aquí
      </h1>
      <p className="mt-4 leading-7 text-muted">
        Cuando la cuenta de Lemon Squeezy esté lista, esta pantalla deja de
        verse. Comprar ahora abre directo la tarjeta, sin crear cuenta.
      </p>
      <Link
        href="/"
        className="mt-8 text-sm font-semibold text-gold hover:text-gold-soft"
      >
        Volver a la oferta
      </Link>
    </main>
  );
}
