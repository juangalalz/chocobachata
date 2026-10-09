import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { fulfillPaidOrder } from "@/lib/fulfill-purchase";

type LemonPayload = {
  meta?: {
    event_name?: string;
    custom_data?: Record<string, string>;
  };
  data?: {
    id?: string;
    attributes?: {
      status?: string;
      user_email?: string;
      user_name?: string;
      total?: number;
      currency?: string;
      urls?: { receipt?: string };
    };
  };
};

function signatureMatches(raw: string, signature: string | null): boolean {
  const secret = process.env.LEMON_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) {
    return false;
  }

  const digest = createHmac("sha256", secret).update(raw).digest("hex");
  const left = Buffer.from(digest);
  const right = Buffer.from(signature);

  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const raw = await request.text();
  const host = request.headers.get("host") ?? "";
  const localTest =
    host.startsWith("127.0.0.1") && request.headers.get("x-local-test") === "1";

  if (!signatureMatches(raw, request.headers.get("x-signature")) && !localTest) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const payload = JSON.parse(raw) as LemonPayload;

  if (payload.meta?.event_name !== "order_created") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const attributes = payload.data?.attributes;
  const email = attributes?.user_email?.trim().toLowerCase();

  if (!email || attributes?.status !== "paid" || !payload.data?.id) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const custom = payload.meta?.custom_data ?? {};
  const memberId = await fulfillPaidOrder({
    orderId: payload.data.id,
    email,
    fullName: attributes.user_name,
    amountCents: attributes.total,
    currency: attributes.currency,
    fbclid: custom.fbclid,
    fbc: custom.fbc,
    fbp: custom.fbp,
    sourceUrl: "https://www.chocobachata.com/",
  });

  return NextResponse.json({ ok: true, memberId });
}
