"use client";

import { offer } from "@/lib/offer";
import { sendVisit, visitContext } from "@/lib/visit-client";

type BuyButtonProps = {
  children: React.ReactNode;
  className?: string;
};

export function BuyButton({ children, className }: BuyButtonProps) {
  return (
    <a
      href={offer.checkoutUrl || "/pago"}
      onClick={(event) => {
        if (!offer.checkoutUrl) {
          return;
        }

        event.preventDefault();
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

        window.location.href = url.toString();
      }}
      className={className}
    >
      {children}
    </a>
  );
}
