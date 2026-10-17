"use client";

const storageKey = "choco_session";
const visitorKey = "choco_visitor";
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
  const fbp = cookie("_fbp");
  const existingFbc = cookie("_fbc");
  const fbc =
    existingFbc || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : "");

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

  if (name === "leave" && navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/events",
      new Blob([body], { type: "application/json" }),
    );
    return;
  }

  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  });
}
