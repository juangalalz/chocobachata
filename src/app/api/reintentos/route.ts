import { NextResponse } from "next/server";

import { retryStuckOrders } from "@/lib/retry-orders";

// Lo llama pg_cron cada 10 minutos (supabase/retries.sql).
export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const result = await retryStuckOrders();
  return NextResponse.json({ ok: true, ...result });
}
