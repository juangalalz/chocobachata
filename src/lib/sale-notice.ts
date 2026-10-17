import "server-only";

import { notifySale } from "@/lib/alerts";
import { ordersUrl, supabaseHeaders } from "@/lib/fulfill-purchase";
import { offer } from "@/lib/offer";
import { findSessionJourney, type SessionJourney } from "@/lib/visits";

const ADS: Record<string, string> = {
  video1: "Video 1",
  video2: "Video 2",
  carrusel: "Carrusel de fotos",
};

const BUTTONS: Record<string, string> = {
  oferta: "Comprar de arriba (oferta)",
  video: "Comprar bajo el video (mitad)",
  barra: "barra fija de abajo en el móvil",
  final: "Comprar del final de la página",
};

const DEVICES: Record<string, string> = {
  movil: "Móvil",
  tablet: "Tablet",
  ordenador: "Ordenador",
};

const SOURCES: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  directo: "entró directo",
};

function amount(cents?: number | null, currency?: string | null): string {
  if (!cents) {
    return `${offer.price} €`;
  }

  return new Intl.NumberFormat("es-ES", { style: "currency", currency: currency ?? "EUR" }).format(cents / 100)
    .replace(/\s/g, " ");
}

type Sale = {
  amountCents?: number | null;
  currency?: string | null;
  email?: string | null;
  fullName?: string | null;
  paidAt?: Date;
};

function visitsLine(visits: SessionJourney["visits"], paidAt: Date): string | null {
  if (!visits?.length) {
    return null;
  }
  if (visits.length === 1) {
    return "🔁 Compró en su primera visita";
  }

  const day = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short" });
  const days = Math.round((paidAt.getTime() - Date.parse(visits[0].at)) / 86400000);
  const path = visits
    .map((visit) => `${visit.ad ? (ADS[visit.ad] ?? visit.ad) : "sin anuncio"} (${day.format(new Date(visit.at))})`)
    .join(" → ");
  return `🔁 Compró en su visita ${visits.length}${days > 0 ? `, ${days} días después de la primera` : ""}: ${path}`;
}

export function saleMessage(sale: Sale, journey: SessionJourney): string {
  const ad = journey.ad ? (ADS[journey.ad] ?? journey.ad) : "ninguno (orgánico)";
  const button = journey.cta ? (BUTTONS[journey.cta] ?? journey.cta) : "no registrado";
  const device = journey.device ? (DEVICES[journey.device] ?? journey.device) : "desconocido";
  const source = journey.source ? (SOURCES[journey.source] ?? journey.source) : "desconocido";
  const when = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(sale.paidAt ?? new Date());
  const visits = visitsLine(journey.visits, sale.paidAt ?? new Date());

  return [
    `💃 ¡Venta! ${offer.name} · ${amount(sale.amountCents, sale.currency)}`,
    ...(sale.email || sale.fullName
      ? [`👤 ${[sale.fullName?.trim(), sale.email].filter(Boolean).join(" · ")}`]
      : []),
    `📣 Anuncio: ${ad}`,
    `📱 ${device} · ${source}`,
    `👆 Botón: ${button}`,
    ...(journey.minutes != null ? [`⏱️ Tardó ${journey.minutes} min desde que entró hasta comprar`] : []),
    ...(visits ? [visits] : []),
    `🕐 ${when} (hora de España)`,
  ].join("\n");
}

// Marca el pedido como avisado solo si nadie lo marcó antes. Así un reintento de
// Lemon o de /api/reintentos no repite el mensaje.
async function claimNotice(orderId: string): Promise<boolean> {
  const url = ordersUrl(`?lemon_order_id=eq.${encodeURIComponent(orderId)}&sale_notified_at=is.null`);
  if (!url) {
    return false;
  }

  const response = await fetch(url, {
    method: "PATCH",
    headers: { ...supabaseHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({ sale_notified_at: new Date().toISOString() }),
  });

  if (!response.ok) {
    console.error("[venta] No se marcó el aviso", orderId, response.status);
    return false;
  }

  return ((await response.json()) as unknown[]).length > 0;
}

// Nunca lanza: un aviso que falla no debe tumbar la entrega del curso.
export async function announceSale(
  sale: Sale & { orderId: string; sessionId?: string | null },
): Promise<void> {
  try {
    if (!(await claimNotice(sale.orderId))) {
      return;
    }

    const journey = sale.sessionId ? await findSessionJourney(sale.sessionId) : {};
    await notifySale(saleMessage(sale, journey));
  } catch (error) {
    console.error("[venta] No se avisó la venta", sale.orderId, error);
  }
}
