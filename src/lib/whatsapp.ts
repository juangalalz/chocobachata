// Enlaces de WhatsApp que se saltan la pantalla intermedia de wa.me
// ("¿Abrir en la app o en WhatsApp Web?").
export function whatsappLinks(phone: string, text: string) {
  const message = encodeURIComponent(text);
  return {
    app: `whatsapp://send?phone=${phone}&text=${message}`,
    web: `https://web.whatsapp.com/send?phone=${phone}&text=${message}`,
    fallback: `https://wa.me/${phone}?text=${message}`,
  };
}

// En móvil abre la app directamente; si no está instalada, a los 1,5 s se va a
// wa.me. En ordenador abre WhatsApp Web en otra pestaña.
export function openWhatsApp(phone: string, text: string, device: string): void {
  const links = whatsappLinks(phone, text);

  if (device === "ordenador") {
    window.open(links.web, "_blank", "noopener");
    return;
  }

  const fallback = window.setTimeout(() => {
    if (document.visibilityState === "visible") {
      window.location.href = links.fallback;
    }
  }, 1500);
  document.addEventListener("visibilitychange", () => window.clearTimeout(fallback), { once: true });
  window.location.href = links.app;
}
