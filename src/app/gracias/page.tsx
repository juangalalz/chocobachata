import type { Metadata } from "next";

import { offer } from "@/lib/offer";

export const metadata: Metadata = {
  title: "Gracias por tu compra",
  robots: { index: false, follow: false },
};

export default function GraciasPage() {
  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-20">
      <p className="text-sm font-semibold tracking-[0.16em] text-gold uppercase">
        Pago confirmado
      </p>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight">
        Te damos la bienvenida al curso
      </h1>
      <p className="mt-4 leading-7 text-muted">
        Te llegan dos correos: uno con la bienvenida al curso y otro para crear
        tu contraseña. Abre el segundo y crea la clave. Si no los ves en unos
        minutos, revisa spam o promociones.
      </p>
      <p className="mt-4 leading-7 text-muted">
        ¿Necesitas ayuda? Escríbenos a{" "}
        <a
          href={`mailto:${offer.email}`}
          className="font-semibold text-gold hover:text-gold-soft"
        >
          {offer.email}
        </a>
        .
      </p>
    </main>
  );
}
