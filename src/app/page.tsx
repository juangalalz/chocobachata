import Image from "next/image";

import { BuyButton } from "@/components/buy-button";
import { OfferCard } from "@/components/offer-card";
import { VisitTracker } from "@/components/visit-tracker";
import { offer } from "@/lib/offer";

const buttonClass =
  "flex h-14 w-full items-center justify-center rounded-md bg-gold px-10 text-base font-semibold text-[#1a1408] transition hover:bg-gold-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:w-auto";

const highlights = [
  {
    title: "3 niveles progresivos",
    detail: "Del paso básico a combinaciones y estilo, con una ruta clara.",
  },
  {
    title: "Desde casa, a tu ritmo",
    detail: "Sin horarios ni desplazamientos. Practicas cuando te venga bien.",
  },
  {
    title: "Acceso sin caducidad",
    detail: "Las clases son tuyas: repítelas todas las veces que necesites.",
  },
  {
    title: "Pago único",
    detail: `${offer.price} ${offer.currency}, IVA incluido. Sin suscripciones ni cuotas mensuales.`,
  },
];

const steps = [
  {
    title: "Realizas el pago",
    detail: `Un único cobro de ${offer.price} ${offer.currency} con tarjeta. No necesitas crear una cuenta para comprar.`,
  },
  {
    title: "Recibes tu acceso por correo",
    detail:
      "Te enviamos un enlace para crear tu contraseña y entrar a las clases.",
  },
  {
    title: "Empiezas con el nivel 1",
    detail:
      "El curso es tuyo. Avanzas por los tres niveles cuando quieras, sin fecha de caducidad.",
  },
];

const faqs = [
  {
    question: "¿Necesito experiencia previa?",
    answer:
      "No. El curso empieza desde cero: el nivel 1 te enseña el paso básico y a contar la música antes de pasar a giros y combinaciones.",
  },
  {
    question: "¿Es una suscripción?",
    answer: `No. Es un pago único de ${offer.price} ${offer.currency}, IVA incluido. Lo compras y lo ves cuando quieras, sin fecha de caducidad.`,
  },
  {
    question: "¿Cómo accedo a las clases después de pagar?",
    answer:
      "Recibirás un correo con un enlace para crear tu contraseña. A partir de ahí entras a la plataforma y empiezas con el nivel 1.",
  },
  {
    question: "¿Puedo practicar por mi cuenta en casa?",
    answer:
      "Sí. Choco explica cada paso por partes para que puedas practicarlo en casa, a tu ritmo y sin prisas.",
  },
];

export default function HomePage() {
  return (
    <>
      <VisitTracker />
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-5 sm:h-16">
          <Image
            src="/logo.png"
            alt="Choco Bachata"
            width={3255}
            height={958}
            preload
            className="h-9 w-auto sm:h-11"
          />
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-5 px-5 pt-5 pb-12 sm:gap-6 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-x-14 lg:pt-14">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-gold uppercase sm:text-sm">
              Curso online de bachata
            </p>
            <h1 className="mt-2 max-w-xl lg:max-w-2xl lg:text-balance text-[2.1rem] leading-[1.05] sm:mt-3 sm:leading-[1.02] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Aprende a bailar bachata desde cero
            </h1>
            <p className="mt-3 max-w-lg text-base leading-6 text-muted sm:mt-4 sm:text-lg sm:leading-7">
              Tres niveles para entender la música, soltar el cuerpo y llegar a
              la pista con seguridad. Desde casa y a tu ritmo.
            </p>
          </div>

          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-6">
            <OfferCard />
          </div>

          <ul className="hidden max-w-xl gap-x-8 gap-y-6 border-t border-white/10 pt-8 lg:grid lg:grid-cols-2">
            {highlights.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/15 text-sm font-bold text-gold"
                >
                  ✓
                </span>
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {item.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-white/10">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <h2 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
              Lo que aprenderás en cada nivel
            </h2>
            <p className="mt-3 max-w-2xl text-muted">
              Una ruta clara, paso a paso, desde tu primer básico hasta bailar en
              social con soltura. Cada nivel se vende también por separado; aquí
              tienes los tres juntos en un único pago.
            </p>
            <ol className="mt-8 grid gap-4 lg:grid-cols-3">
              {offer.levels.map((level, index) => (
                <li
                  key={level.name}
                  className="rounded-2xl border border-white/10 bg-card p-5"
                >
                  <p className="text-sm font-semibold text-gold">
                    0{index + 1}
                  </p>
                  <h3 className="mt-2 text-lg font-bold">{level.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {level.detail}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-white/10">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-14 sm:grid-cols-[16rem_minmax(0,1fr)] lg:gap-14">
            <div className="mx-auto w-full max-w-xs overflow-hidden rounded-2xl sm:mx-0 border border-white/10">
              <Image
                src="/choco-1.jpg"
                alt="Choco sonriendo y tendiendo la mano a cámara"
                width={1400}
                height={1800}
                sizes="(min-width: 640px) 256px, 320px"
                className="aspect-[4/5] w-full object-cover object-top"
              />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.16em] text-gold uppercase">
                Tu profesor
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Hola, soy Choco
              </h2>
              <p className="mt-4 max-w-2xl leading-7 text-muted">
                Enseño bachata desde los 15 años y sé lo que se siente al
                empezar: no saber dónde poner los pies ni cuándo entrar en la
                música. Por eso explico cada paso por partes, te ayudo a contar
                la música y te lo pongo fácil para que practiques en casa, a tu
                ritmo y sin presión.
              </p>
              <p className="mt-4 max-w-2xl leading-7 text-muted">
                Mi objetivo es que, al terminar el curso, salgas a la pista con
                confianza y disfrutes bailando.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Empezar es muy sencillo
            </h2>
            <ol className="mt-8 grid gap-6 sm:grid-cols-3">
              {steps.map((step, index) => (
                <li key={step.title}>
                  <p className="font-display text-3xl font-extrabold text-gold">
                    {index + 1}
                  </p>
                  <h3 className="mt-2 text-lg font-bold">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {step.detail}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-white/10">
          <div className="mx-auto max-w-3xl px-5 py-14">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Preguntas frecuentes
            </h2>
            <div className="mt-8 divide-y divide-white/10 border-y border-white/10">
              {faqs.map((faq) => (
                <details key={faq.question} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                    {faq.question}
                    <span
                      aria-hidden
                      className="text-xl leading-none text-gold transition group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
            <p className="mt-6 text-sm text-muted">
              ¿Te queda alguna duda? Escríbenos a{" "}
              <a
                href={`mailto:${offer.email}`}
                className="font-semibold text-gold hover:text-gold-soft"
              >
                {offer.email}
              </a>{" "}
              y te ayudamos encantados.
            </p>
          </div>
        </section>

        <section className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-5 py-14 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Tu primer paso empieza hoy
              </h2>
              <p className="mt-2 text-sm font-semibold tracking-[0.16em] text-gold uppercase">
                Los 3 niveles en un único pago
              </p>
              <p className="mt-3 font-display text-5xl font-extrabold tracking-tight">
                <span className="mr-3 text-2xl font-semibold text-muted line-through">
                  <span className="sr-only">Precio anterior: </span>
                  {offer.previousPrice} {offer.currency}
                </span>
                <span className="sr-only">Precio actual: </span>
                {offer.price} {offer.currency}
              </p>
              <p className="mt-2 text-sm text-muted">
                IVA incluido · Lo compras y es tuyo, sin caducidad.
              </p>
            </div>
            <BuyButton className={buttonClass}>Comprar ahora</BuyButton>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <Image
            src="/logo.png"
            alt=""
            width={3255}
            height={958}
            className="h-9 w-auto"
          />
          <p>
            ¿Tienes dudas? Escríbenos a{" "}
            <a
              href={`mailto:${offer.email}`}
              className="text-ink hover:text-gold"
            >
              {offer.email}
            </a>
          </p>
          <p>© 2026 Choco Bachata. Todos los derechos reservados.</p>
        </div>
      </footer>
    </>
  );
}
