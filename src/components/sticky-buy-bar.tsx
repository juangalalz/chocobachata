"use client";

import { useEffect, useState } from "react";

import { BuyButton } from "@/components/buy-button";
import { offer } from "@/lib/offer";

// Barra de compra fija en móvil. Aparece cuando la tarjeta de oferta sale de pantalla
// y se esconde cuando el botón final ya está a la vista, para no duplicarlo.
export function StickyBuyBar({ hideWhen }: { hideWhen: string[] }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const targets = hideWhen
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    const onScreen = new Set<Element>();

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          onScreen.add(entry.target);
        } else {
          onScreen.delete(entry.target);
        }
      }
      setVisible(onScreen.size === 0 && window.scrollY > 200);
    });

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [hideWhen]);

  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-bg/95 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-300 lg:hidden ${visible ? "translate-y-0" : "translate-y-full"}`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div className="leading-tight">
          <p className="font-display text-2xl font-extrabold tracking-tight">
            {offer.price} {offer.currency}
          </p>
          <p className="text-xs text-muted">Pago único · 3 niveles</p>
        </div>
        <BuyButton
          cta="barra"
          className="flex h-12 items-center justify-center rounded-md bg-gold px-7 text-base font-semibold text-[#1a1408] transition hover:bg-gold-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          Comprar
        </BuyButton>
      </div>
    </div>
  );
}
