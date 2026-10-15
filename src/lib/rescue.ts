import "server-only";

import { notify } from "@/lib/alerts";
import { ordersUrl, supabaseHeaders } from "@/lib/fulfill-purchase";
import { findSessionJourney } from "@/lib/visits";

const ANSWERS: Record<string, string> = {
  pensarlo: "Quiero pensarlo un poco",
  pago: "Tuve un problema al pagar",
  otra_forma: "Prefiero pagar de otra forma",
  duda: "Tengo una duda sobre el curso",
};

const ADS: Record<string, string> = { video1: "Video 1", video2: "Video 2", carrusel: "Carrusel" };
const DEVICES: Record<string, string> = { movil: "Móvil", tablet: "Tablet", ordenador: "Ordenador" };

function eventsUrl(query: string): string | null {
  const base = process.env.SUPABASE_URL?.trim();
  if (!base || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return null;
  }
  return `${base.replace(/\/$/, "")}/rest/v1/page_events${query}`;
}

async function hasRows(url: string | null): Promise<boolean> {
  if (!url) {
    return false;
  }
  const response = await fetch(url, { headers: supabaseHeaders(), cache: "no-store" });
  return response.ok && ((await response.json()) as unknown[]).length > 0;
}

export function sessionHasEvent(sessionId: string, name: string): Promise<boolean> {
  return hasRows(
    eventsUrl(`?session_id=eq.${encodeURIComponent(sessionId)}&name=eq.${name}&select=name&limit=1`),
  );
}

export function sessionPurchased(sessionId: string): Promise<boolean> {
  return hasRows(ordersUrl(`?session_id=eq.${encodeURIComponent(sessionId)}&select=lemon_order_id&limit=1`));
}

// El rescate solo cuenta en sesiones que de verdad abrieron el pago, y avisa una
// vez por tipo de evento: así nadie puede llenar el Telegram con respuestas falsas.
export async function rescueCheck(sessionId: string, name: string): Promise<{ valid: boolean; notify: boolean }> {
  const [clicked, repeated] = await Promise.all([
    sessionHasEvent(sessionId, "cta_click"),
    sessionHasEvent(sessionId, name),
  ]);
  return { valid: clicked, notify: clicked && !repeated };
}

export async function notifyRescue(sessionId: string, name: string, answer: string | null): Promise<void> {
  const journey = await findSessionJourney(sessionId);
  const away = await fetch(
    eventsUrl(
      `?session_id=eq.${encodeURIComponent(sessionId)}&name=eq.checkout_return&select=seconds&order=created_at.desc&limit=1`,
    ) ?? "",
    { headers: supabaseHeaders(), cache: "no-store" },
  )
    .then((response) => (response.ok ? (response.json() as Promise<{ seconds: number | null }[]>) : []))
    .catch(() => []);
  const seconds = away[0]?.seconds;

  const origin = [
    journey.ad ? `📣 ${ADS[journey.ad] ?? journey.ad}` : "📣 Sin anuncio",
    `📱 ${journey.device ? (DEVICES[journey.device] ?? journey.device) : "desconocido"}`,
    journey.source ?? null,
  ]
    .filter(Boolean)
    .join(" · ");

  const answerText = answer ? (ANSWERS[answer] ?? answer) : "sin respuesta";
  const text =
    name === "whatsapp_click"
      ? `💬 Abrió WhatsApp para escribirle a Choco (respondió: ${answerText}).\n${origin}`
      : [
          "🛟 Alguien volvió del pago sin comprar",
          `Respondió: ${answerText}`,
          origin,
          ...(seconds != null ? [`⏱️ Estuvo ${seconds} s en el pago`] : []),
        ].join("\n");

  await notify(text);
}
