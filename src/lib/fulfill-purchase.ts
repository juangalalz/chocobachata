import "server-only";

import { sendMetaEvent } from "@/lib/meta";
import {
  enrollInPrograms,
  findOrCreateMember,
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
  sourceUrl?: string;
};

async function saveOrder(
  order: PaidOrder,
  memberId: string,
  capiStatus: string,
): Promise<void> {
  const base = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) {
    return;
  }

  await fetch(`${base.replace(/\/$/, "")}/rest/v1/orders?on_conflict=lemon_order_id`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      lemon_order_id: order.orderId,
      email: order.email,
      full_name: order.fullName ?? null,
      amount_cents: order.amountCents ?? null,
      currency: order.currency ?? null,
      fbclid: order.fbclid ?? null,
      fbc: order.fbc ?? null,
      fbp: order.fbp ?? null,
      wix_member_id: memberId,
      wix_status: "enrolled",
      capi_status: capiStatus,
    }),
  });
}

export async function fulfillPaidOrder(order: PaidOrder): Promise<string> {
  const memberId = await findOrCreateMember(order.email, order.fullName);
  await enrollInPrograms(memberId);
  await sendWelcomeEmail(memberId);
  await sendAccessEmail(order.email);

  const value =
    order.amountCents != null ? Number((order.amountCents / 100).toFixed(2)) : 29.99;
  const currency = order.currency || "EUR";
  const shared = {
    sourceUrl: order.sourceUrl,
    email: order.email,
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
  await sendMetaEvent({
    eventName: "Purchase",
    eventId: order.orderId,
    ...shared,
  });

  await saveOrder(order, memberId, "sent");
  return memberId;
}
