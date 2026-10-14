import "server-only";

import { sendMetaEvent, type MetaStatus } from "@/lib/meta";
import {
  enrollInPrograms,
  findMemberId,
  findOrCreateMember,
  removeFromPrograms,
  sendAccessEmail,
  sendWelcomeEmail,
} from "@/lib/wix-access";

export type PaidOrder = {
  orderId: string;
  email: string;
  fullName?: string;
  amountCents?: number;
  currency?: string;
  fbclid?: string;
  fbc?: string;
  fbp?: string;
  clientIp?: string;
  userAgent?: string;
  sourceUrl?: string;
};

// Pasos en orden. wix_status guarda el último que terminó bien, así un
// reintento de Lemon sigue desde ahí y no repite correos.
const steps = ["pending", "member", "enrolled", "welcomed", "access_sent"] as const;
type Step = (typeof steps)[number];

type OrderRow = {
  wix_member_id: string | null;
  wix_status: string;
  capi_status: string;
};

function ordersUrl(query: string): string | null {
  const base = process.env.SUPABASE_URL?.trim();
  if (!base || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return null;
  }

  return `${base.replace(/\/$/, "")}/rest/v1/orders${query}`;
}

function supabaseHeaders(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function readOrder(orderId: string): Promise<OrderRow | null> {
  const url = ordersUrl(
    `?lemon_order_id=eq.${encodeURIComponent(orderId)}&select=wix_member_id,wix_status,capi_status`,
  );
  if (!url) {
    console.error("[pedido] Falta Supabase: no se puede evitar repetir pasos");
    return null;
  }

  const response = await fetch(url, { headers: supabaseHeaders(), cache: "no-store" });
  if (!response.ok) {
    console.error("[pedido] No se leyó el pedido", orderId, response.status);
    return null;
  }

  const rows = (await response.json()) as OrderRow[];
  return rows[0] ?? null;
}

async function saveOrder(orderId: string, fields: Record<string, unknown>): Promise<void> {
  const url = ordersUrl("?on_conflict=lemon_order_id");
  if (!url) {
    return;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      lemon_order_id: orderId,
      ...fields,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    console.error(
      "[pedido] No se guardó el pedido",
      orderId,
      response.status,
      (await response.text()).slice(0, 300),
    );
  }
}

export async function fulfillPaidOrder(order: PaidOrder): Promise<string> {
  const saved = await readOrder(order.orderId);

  // Un reintento de order_created no puede devolver el acceso a un pedido reembolsado.
  if (saved?.wix_status === "refunded") {
    return saved.wix_member_id ?? "";
  }

  if (!saved) {
    await saveOrder(order.orderId, {
      email: order.email,
      full_name: order.fullName ?? null,
      amount_cents: order.amountCents ?? null,
      currency: order.currency ?? null,
      fbclid: order.fbclid ?? null,
      fbc: order.fbc ?? null,
      fbp: order.fbp ?? null,
      client_ip: order.clientIp ?? null,
      user_agent: order.userAgent ?? null,
      wix_status: "pending",
    });
  }

  let step: Step = steps.includes(saved?.wix_status as Step)
    ? (saved?.wix_status as Step)
    : "pending";
  let memberId = saved?.wix_member_id ?? "";
  const done = (target: Step) => steps.indexOf(step) >= steps.indexOf(target);

  async function advance(next: Step, extra: Record<string, unknown> = {}) {
    step = next;
    await saveOrder(order.orderId, { wix_status: next, ...extra });
  }

  try {
    if (!memberId || !done("member")) {
      memberId = await findOrCreateMember(order.email, order.fullName);
      await advance("member", { wix_member_id: memberId });
    }

    if (!done("enrolled")) {
      await enrollInPrograms(memberId);
      await advance("enrolled");
    }

    if (!done("welcomed")) {
      await sendWelcomeEmail(memberId);
      await advance("welcomed");
    }

    if (!done("access_sent")) {
      await sendAccessEmail(order.email);
      await advance("access_sent");
    }
  } catch (error) {
    console.error("[pedido] Falló en Wix después de", step, order.orderId, error);
    throw error;
  }

  if (saved?.capi_status !== "sent") {
    const value =
      order.amountCents != null ? Number((order.amountCents / 100).toFixed(2)) : 29.99;
    const currency = order.currency || "EUR";
    const shared = {
      sourceUrl: order.sourceUrl,
      email: order.email,
      fullName: order.fullName,
      clientIp: order.clientIp,
      userAgent: order.userAgent,
      fbc: order.fbc,
      fbp: order.fbp,
      value,
      currency,
    };

    await sendMetaEvent({
      eventName: "Lead",
      eventId: `${order.orderId}-lead`,
      ...shared,
    });
    const capiStatus: MetaStatus = await sendMetaEvent({
      eventName: "Purchase",
      eventId: order.orderId,
      ...shared,
    });

    await saveOrder(order.orderId, { capi_status: capiStatus });
  }

  return memberId;
}

async function hasOtherActiveOrder(memberId: string, orderId: string): Promise<boolean> {
  const url = ordersUrl(
    `?wix_member_id=eq.${encodeURIComponent(memberId)}` +
      `&lemon_order_id=neq.${encodeURIComponent(orderId)}` +
      "&wix_status=neq.refunded&select=lemon_order_id&limit=1",
  );
  if (!url) {
    return false;
  }

  const response = await fetch(url, { headers: supabaseHeaders(), cache: "no-store" });
  return response.ok && ((await response.json()) as unknown[]).length > 0;
}

// Reembolso total: el alumno sale de los tres niveles. Si tiene otro pedido
// pagado, conserva el acceso.
export async function revokeRefundedOrder(orderId: string, email: string): Promise<number> {
  const saved = await readOrder(orderId);
  const memberId = saved?.wix_member_id || (await findMemberId(email));

  if (!memberId) {
    console.error("[reembolso] No encontré el alumno en Wix", orderId);
    await saveOrder(orderId, { email, wix_status: "refunded" });
    return 0;
  }

  if (await hasOtherActiveOrder(memberId, orderId)) {
    await saveOrder(orderId, { wix_status: "refunded" });
    return 0;
  }

  const removed = await removeFromPrograms(memberId);
  await saveOrder(orderId, {
    wix_status: "refunded",
    ...(saved ? {} : { email, wix_member_id: memberId }),
  });

  return removed;
}
