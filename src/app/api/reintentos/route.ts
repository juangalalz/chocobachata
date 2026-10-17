import { NextResponse } from "next/server";

import { checkFirstLogins } from "@/lib/login-check";
import { retryStuckOrders } from "@/lib/retry-orders";

// Lo llama pg_cron cada 10 minutos (supabase/retries.sql).
export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const result = await retryStuckOrders();
  // De paso, avisa de quien compró hace un día y todavía no ha entrado al curso.
  const logins = await checkFirstLogins();
  return NextResponse.json({ ok: true, ...result, logins });
}
