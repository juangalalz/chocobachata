"use client";

import { useEffect, useState } from "react";

import { offer } from "@/lib/offer";
import { deviceType, isInternal, sendVisit, visitContext } from "@/lib/visit-client";
import { openWhatsApp } from "@/lib/whatsapp";

const checkoutKey = "choco_pago";
const shownKey = "choco_rescate";

// Se guarda al tocar Comprar; si la persona vuelve a la página sin haber pagado,
// sabemos cuánto estuvo en el pago y le preguntamos qué la frenó.
export function rememberCheckout(): void {
  try {
    sessionStorage.setItem(checkoutKey, String(Date.now()));
  } catch {}
}

export function forgetCheckout(): void {
  try {
    sessionStorage.removeItem(checkoutKey);
  } catch {}
}

const answers = [
  {
    key: "pensarlo",
    label: "Quiero pensarlo un poco",
    reply: "¡Sin prisa! Si te surge cualquier duda, Choco te responde por WhatsApp.",
    message: "¡Hola Choco! Estoy viendo el curso online de bachata y me gustaría preguntarte algo antes de comprar.",
  },
  {
    key: "pago",
    label: "Tuve un problema al pagar",
    reply: "Lo sentimos. Escríbele a Choco y te ayuda a terminar la compra.",
    message: "¡Hola Choco! Estaba comprando el curso online de bachata y tuve un problema con el pago.",
  },
  {
    key: "otra_forma",
    label: "Prefiero pagar de otra forma",
    reply: "Cuéntale a Choco cómo prefieres pagar y lo buscamos juntos.",
    message: "¡Hola Choco! Quiero el curso online de bachata, pero prefiero pagar de otra forma.",
  },
  {
    key: "duda",
    label: "Tengo una duda sobre el curso",
    reply: "Pregúntale directamente a Choco: te responde él.",
    message: "¡Hola Choco! Estoy viendo el curso online de bachata y tengo una duda antes de comprar.",
  },
] as const;

type Answer = (typeof answers)[number];

async function reportReturn(seconds: number): Promise<boolean> {
  if (isInternal()) {
    return false;
  }

  try {
    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...visitContext(),
        name: "checkout_return",
        seconds,
        path: window.location.pathname,
      }),
    });
    const data = (await response.json()) as { purchased?: boolean };
    return data.purchased === true;
  } catch {
    return false;
  }
}

export function CheckoutRescue() {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);

  useEffect(() => {
    async function check() {
      let startedAt: number;
      let alreadyShown: boolean;
      try {
        startedAt = Number(sessionStorage.getItem(checkoutKey));
        alreadyShown = sessionStorage.getItem(shownKey) === "1";
      } catch {
        return;
      }
      if (!startedAt) {
        return;
      }

      forgetCheckout();
      const purchased = await reportReturn(Math.round((Date.now() - startedAt) / 1000));
      if (purchased || alreadyShown) {
        return;
      }

      sessionStorage.setItem(shownKey, "1");
      setOpen(true);
    }

    void check();
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void check();
      }
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  if (!open) {
    return null;
  }

  function close() {
    if (!answer) {
      sendVisit("rescue_close");
    }
    setOpen(false);
  }

  function choose(item: Answer) {
    setAnswer(item);
    sendVisit("rescue_answer", { cta: item.key });
  }

  function writeToChoco() {
    sendVisit("whatsapp_click", { cta: answer?.key ?? "rescate" });
    openWhatsApp(offer.whatsapp, answer?.message ?? answers[3].message, deviceType());
  }

  return (
    <div
      role="dialog"
      aria-labelledby="rescate-titulo"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96 sm:px-0"
    >
      <div className="rounded-2xl border border-gold/30 bg-card p-5 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4">
          <h2 id="rescate-titulo" className="text-lg font-bold">
            {answer ? "¡Gracias por contarnos!" : "¿Algo te frenó?"}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar"
            className="-mt-1 -mr-1 rounded-full p-1 text-muted transition hover:text-ink"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {answer ? (
          <>
            <p className="mt-2 text-sm leading-6 text-muted">{answer.reply}</p>
            <button
              type="button"
              onClick={writeToChoco}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-gold text-base font-semibold text-[#1a1408] transition hover:bg-gold-soft"
            >
              Escribir a Choco por WhatsApp
            </button>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">Un toque y nos ayudas a mejorar.</p>
            <ul className="mt-4 grid gap-2">
              {answers.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => choose(item)}
                    className="w-full rounded-md border border-white/10 px-4 py-3 text-left text-sm font-semibold transition hover:border-gold/60 hover:text-gold"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

// En /gracias: quien ya pagó no debe ver el rescate si vuelve a la página.
export function ForgetCheckout() {
  useEffect(forgetCheckout, []);
  return null;
}
