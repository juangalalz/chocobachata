"use client";

const storageKey = "choco_session";
export const visitorKey = "choco_visitor";
const internalKey = "choco_interno";

export type VisitName =
  | "page_view"
  | "scroll"
  | "cta_click"
  | "leave"
  | "video_play"
  | "video_progress"
  | "checkout_return"
  | "rescue_answer"
  | "rescue_close"
  | "whatsapp_click";

export type VisitContext = {
  sessionId: string;
  visitorId: string;
  fbclid: string;
  fbc: string;
  fbp: string;
  utmContent: string;
  source: string;
  device: string;
};

// Tus visitas y las de pruebas no cuentan: abre la página una vez con ?interno=1
// en cada móvil u ordenador (y ?interno=0 para volver a contar).
export function isInternal(): boolean {
  try {
    const flag = new URLSearchParams(window.location.search).get("interno");
    if (flag === "1") {
      localStorage.setItem(internalKey, "1");
    } else if (flag === "0") {
      localStorage.removeItem(internalKey);
    }
    return localStorage.getItem(internalKey) === "1";
  } catch {
    return false;
  }
}

// Instagram y Facebook abren los anuncios en su propio navegador y se delatan en el user agent.
function trafficSource(params: URLSearchParams): string {
  const agent = navigator.userAgent;
  if (/Instagram/i.test(agent)) {
    return "instagram";
  }
  if (/FBAN|FBAV|FB_IAB|FBIOS/.test(agent)) {
    return "facebook";
  }

  const utmSource = params.get("utm_source");
  if (utmSource) {
    return utmSource.slice(0, 40);
  }

  try {
    const referrer = document.referrer ? new URL(document.referrer).hostname : "";
    if (referrer && referrer !== window.location.hostname) {
      return referrer.replace(/^www\./, "").slice(0, 40);
    }
  } catch {}

  return "directo";
}

export function deviceType(): string {
  const agent = navigator.userAgent;
  if (/iPad|Tablet/i.test(agent)) {
    return "tablet";
  }
  return /Mobi|Android|iPhone/i.test(agent) ? "movil" : "ordenador";
}

function cookie(name: string): string {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : "";
}

const cookieDays = 90;

function setCookie(name: string, value: string): void {
  // En el dominio principal, como el píxel, para que lo lean curso. y pago.
  const domain = /(^|\.)chocobachata\.com$/.test(window.location.hostname)
    ? "; domain=.chocobachata.com"
    : "";
  document.cookie = `${name}=${value}; max-age=${cookieDays * 86400}; path=/; SameSite=Lax${domain}`;
}

// Las cookies de Meta, sin esperar al píxel. El píxel carga tarde: la entrada a la página
// salía sin _fbp (7 de cada 10 en oct 2026), y si alguien volvía por otro anuncio y tocaba
// Comprar en segundos, mandábamos el _fbc del clic anterior. El píxel respeta las que ya existen.
function metaCookies(fbclid: string): { fbc: string; fbp: string } {
  let fbp = cookie("_fbp");
  if (!fbp) {
    fbp = `fb.1.${Date.now()}.${Math.floor(Math.random() * 2147483647)}`;
    setCookie("_fbp", fbp);
  }

  let fbc = cookie("_fbc");
  if (fbclid && !fbc.endsWith(`.${fbclid}`)) {
    fbc = `fb.1.${Date.now()}.${fbclid}`;
    setCookie("_fbc", fbc);
  }

  return { fbc, fbp };
}

// Fijo por navegador: el mismo en cada visita, venga del anuncio que venga.
function visitorId(fallback: string): string {
  try {
    let id = localStorage.getItem(visitorKey) ?? "";
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(visitorKey, id);
    }
    return id;
  } catch {
    return fallback;
  }
}

export function visitContext(): VisitContext {
  let sessionId = sessionStorage.getItem(storageKey) ?? "";

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(storageKey, sessionId);
  }

  const params = new URLSearchParams(window.location.search);
  const fbclid = params.get("fbclid") ?? "";
  const { fbc, fbp } = metaCookies(fbclid);

  return {
    sessionId,
    visitorId: visitorId(sessionId),
    fbclid,
    fbc,
    fbp,
    utmContent: params.get("utm_content") ?? "",
    source: trafficSource(params),
    device: deviceType(),
  };
}

const readKey = "choco_leyo";

// Quien llega al 75 % de la página o ve el video entero es quien compra. Este evento llena
// en Meta una audiencia de lectores para el remarketing, separada de los que solo tocan.
export function markRead(): void {
  if (isInternal()) {
    return;
  }

  try {
    if (sessionStorage.getItem(readKey)) {
      return;
    }
    sessionStorage.setItem(readKey, "1");
  } catch {}

  window.fbq?.("trackCustom", "LeyoPagina");
}

export function sendVisit(
  name: VisitName,
  extra: { depth?: number; seconds?: number; eventId?: string; cta?: string } = {},
): void {
  if (isInternal()) {
    return;
  }

  const context = visitContext();
  const payload = {
    ...context,
    name,
    depth: extra.depth,
    seconds: extra.seconds,
    eventId: extra.eventId,
    cta: extra.cta,
    path: window.location.pathname,
    sourceUrl: window.location.href,
  };

  const body = JSON.stringify(payload);

  // sendBeacon llega aunque el navegador de Instagram corte la página: con fetch se perdía
  // 1 de cada 10 entradas, mientras que la salida (siempre por beacon) sí llegaba.
  if (
    navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))
  ) {
    return;
  }

  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  });
}
