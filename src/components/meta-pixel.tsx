"use client";

import Script from "next/script";

import { visitorKey } from "@/lib/visit-client";

const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export function MetaPixel() {
  if (!pixelId) {
    return null;
  }

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        // Mismo identificador que manda el servidor (lib/meta.ts): sin guiones parece ya
        // cifrado y el píxel lo envía tal cual. Se crea aquí si es la primera visita.
        (function () {
          var id;
          try {
            id = localStorage.getItem('${visitorKey}');
            if (!id) { id = crypto.randomUUID(); localStorage.setItem('${visitorKey}', id); }
          } catch (e) {}
          fbq('init', '${pixelId}', id ? { external_id: id.replace(/-/g, '').toLowerCase() } : {});
        })();
      `}
    </Script>
  );
}
