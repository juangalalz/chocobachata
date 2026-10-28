"use client";

import { useEffect, useState } from "react";

import { offer } from "@/lib/offer";
import { rememberCheckout } from "@/components/checkout-rescue";
import { isInternal, sendVisit, visitContext } from "@/lib/visit-client";

type BuyButtonProps = {
  children: React.ReactNode;
  // Dónde está el botón, para ver en el tablero cuál usa la gente.
  cta: "oferta" | "video" | "barra" | "final";
  className?: string;
};

export function BuyButton({ children, cta, className }: BuyButtonProps) {
  const [loading, setLoading] = useState(false);

  // Al volver atrás desde el pago el navegador puede restaurar la página tal cual,
  // con el botón todavía en "Abriendo el pago…".
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setLoading(false);
      }
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  return (
    <a
      href={offer.checkoutUrl || "/pago"}
      aria-busy={loading}
      aria-disabled={loading}
      onClick={(event) => {
        if (!offer.checkoutUrl || loading) {
          if (loading) {
            event.preventDefault();
          }
          return;
        }

        event.preventDefault();
        setLoading(true);

        const context = visitContext();
        const eventId = crypto.randomUUID();
        const url = new URL(offer.checkoutUrl);

        sendVisit("cta_click", { eventId, cta });
        rememberCheckout();
        if (!isInternal()) {
          window.fbq?.(
            "track",
            "InitiateCheckout",
            { boton: cta },
            { eventID: eventId },
          );
        }

        // Lemon solo necesita la sesión: el webhook recupera de Supabase los datos de Meta.
        url.searchParams.set("checkout[custom][session_id]", context.sessionId);
        url.searchParams.set("checkout[billing_address][country]", offer.checkoutCountry);

        const destination = url.toString();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.location.href = destination;
          });
        });
      }}
      className={`${className ?? ""} ${loading ? "pointer-events-none" : ""}`}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Abriendo el pago…
        </span>
      ) : (
        children
      )}
    </a>
  );
}
