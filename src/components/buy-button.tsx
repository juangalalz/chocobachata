"use client";

import { useState } from "react";

import { offer } from "@/lib/offer";
import { sendVisit, visitContext } from "@/lib/visit-client";

type BuyButtonProps = {
  children: React.ReactNode;
  className?: string;
};

export function BuyButton({ children, className }: BuyButtonProps) {
  const [loading, setLoading] = useState(false);

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

        sendVisit("cta_click", { eventId });
        window.fbq?.(
          "track",
          "InitiateCheckout",
          {},
          { eventID: eventId },
        );

        url.searchParams.set("checkout[custom][session_id]", context.sessionId);
        if (context.fbclid) {
          url.searchParams.set("checkout[custom][fbclid]", context.fbclid);
        }
        if (context.fbc) {
          url.searchParams.set("checkout[custom][fbc]", context.fbc);
        }
        if (context.fbp) {
          url.searchParams.set("checkout[custom][fbp]", context.fbp);
        }

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
