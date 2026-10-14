import "server-only";

import { notify } from "@/lib/alerts";
import {
  fulfillPaidOrder,
  ordersUrl,
  readOrder,
  revokeRefundedOrder,
  saveOrder,
  supabaseHeaders,
} from "@/lib/fulfill-purchase";

// Cada 10 minutos (pg_cron, ver supabase/retries.sql): 12 intentos son unas 2 horas.
export const MAX_ATTEMPTS = 12;
const SITE_URL = "https://curso.chocobachata.com/";

export type StuckOrder = {
  lemon_order_id: string;
  session_id: string | null;
  email: string | null;
  full_name: string | null;
  amount_cents: number | null;
  currency: string | null;
  fbclid: string | null;
  fbc: string | null;
  fbp: string | null;
  client_ip: string | null;
  user_agent: string | null;
  wix_status: string;
  capi_status: string;
  attempts: number;
  alerted_at: string | null;
  refund_requested_at: string | null;
};

function describe(order: Pick<StuckOrder, "lemon_order_id" | "email">): string {
  return `pedido ${order.lemon_order_id}${order.email ? ` (${order.email})` : ""}`;
}

// Primer aviso de un pedido que falló. Solo se manda una vez por pedido.
export async function reportFailure(
  orderId: string,
  task: "acceso" | "reembolso",
  error: unknown,
  email?: string,
): Promise<void> {
  const saved = await readOrder(orderId);
  await saveOrder(orderId, { last_error: String(error).slice(0, 500) });
  if (saved?.alerted_at) {
    return;
  }

  await saveOrder(orderId, { alerted_at: new Date().toISOString() });
  await notify(
    `⚠️ Falló el ${task} del ${describe({ lemon_order_id: orderId, email: email ?? null })}.\n` +
      `${String(error).slice(0, 300)}\n` +
      "Se reintenta solo cada 10 minutos; te aviso si se resuelve o si necesita revisión.",
  );
}

// Si ya avisamos de un fallo, avisa también cuando se arregla (una sola vez).
export async function markResolved(orderId: string, task: "acceso" | "reembolso"): Promise<void> {
  const saved = await readOrder(orderId);
  if (!saved?.last_error) {
    return;
  }

  await saveOrder(orderId, { last_error: null });
  if (saved.alerted_at) {
    await notify(`✅ Resuelto: ${task} del pedido ${orderId}.`);
  }
}

// Pedidos que se quedaron a medias: acceso sin entregar, Purchase sin enviar a Meta
// o reembolso sin aplicar. Solo los de la última semana, que es lo que Meta acepta.
export async function listStuckOrders(now = new Date()): Promise<StuckOrder[]> {
  const quiet = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const week = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
  const url = ordersUrl(
    "?or=(wix_status.not.in.(access_sent,refunded)," +
      "and(wix_status.eq.access_sent,capi_status.in.(pending,failed))," +
      "and(refund_requested_at.not.is.null,wix_status.neq.refunded))" +
      `&attempts=lt.${MAX_ATTEMPTS}` +
      `&updated_at=lt.${encodeURIComponent(quiet)}` +
      `&created_at=gt.${encodeURIComponent(week)}` +
      "&order=created_at.asc&limit=5&select=*",
  );

  if (!url) {
    return [];
  }

  const response = await fetch(url, { headers: supabaseHeaders(), cache: "no-store" });
  if (!response.ok) {
    console.error("[reintentos] No se leyeron los pedidos", response.status);
    return [];
  }

  return (await response.json()) as StuckOrder[];
}

export async function retryOrder(order: StuckOrder): Promise<"fixed" | "failed"> {
  const attempt = order.attempts + 1;
  const refund = order.refund_requested_at !== null && order.wix_status !== "refunded";
  await saveOrder(order.lemon_order_id, { attempts: attempt });

  try {
    if (refund) {
      await revokeRefundedOrder(order.lemon_order_id, order.email ?? "");
    } else {
      await fulfillPaidOrder({
        orderId: order.lemon_order_id,
        sessionId: order.session_id ?? undefined,
        email: order.email ?? "",
        fullName: order.full_name ?? undefined,
        amountCents: order.amount_cents ?? undefined,
        currency: order.currency ?? undefined,
        fbclid: order.fbclid ?? undefined,
        fbc: order.fbc ?? undefined,
        fbp: order.fbp ?? undefined,
        clientIp: order.client_ip ?? undefined,
        userAgent: order.user_agent ?? undefined,
        sourceUrl: SITE_URL,
      });
    }

    await markResolved(order.lemon_order_id, refund ? "reembolso" : "acceso");
    return "fixed";
  } catch (error) {
    await saveOrder(order.lemon_order_id, { last_error: String(error).slice(0, 500) });
    if (attempt >= MAX_ATTEMPTS) {
      await notify(
        `🚨 El ${refund ? "reembolso" : "acceso"} del ${describe(order)} sigue fallando tras ${attempt} intentos.\n` +
          `${String(error).slice(0, 300)}\nHay que revisarlo a mano.`,
      );
    } else if (!order.alerted_at) {
      await reportFailure(order.lemon_order_id, refund ? "reembolso" : "acceso", error, order.email ?? undefined);
    }
    return "failed";
  }
}

export async function retryStuckOrders(): Promise<{ tried: number; fixed: number; failed: number }> {
  const orders = await listStuckOrders();
  let fixed = 0;

  for (const order of orders) {
    if ((await retryOrder(order)) === "fixed") {
      fixed += 1;
    }
  }

  return { tried: orders.length, fixed, failed: orders.length - fixed };
}
