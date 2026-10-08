import { NextResponse } from "next/server";

import { sendMetaEvent } from "@/lib/meta";
import { insertPageEvent } from "@/lib/visits";

const names = new Set(["page_view", "scroll", "cta_click", "leave"]);

type EventBody = {
  sessionId?: string;
  name?: string;
  depth?: number;
  seconds?: number;
  path?: string;
  fbclid?: string;
  fbc?: string;
  fbp?: string;
  utmContent?: string;
  eventId?: string;
  sourceUrl?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as EventBody | null;
  const name = body?.name;
  const sessionId = body?.sessionId?.trim();

  if (!name || !names.has(name) || !sessionId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientIp = forwarded || request.headers.get("x-real-ip") || undefined;
  const userAgent = request.headers.get("user-agent") || undefined;

  await insertPageEvent({
    session_id: sessionId,
    name,
    depth: typeof body.depth === "number" ? body.depth : null,
    seconds: typeof body.seconds === "number" ? body.seconds : null,
    path: body.path ?? null,
    fbclid: body.fbclid ?? null,
    fbc: body.fbc ?? null,
    fbp: body.fbp ?? null,
    utm_content: body.utmContent ?? null,
    event_id: body.eventId ?? null,
  });

  if (name === "page_view" && body.eventId) {
    await sendMetaEvent({
      eventName: "PageView",
      eventId: body.eventId,
      sourceUrl: body.sourceUrl,
      clientIp,
      userAgent,
      fbc: body.fbc,
      fbp: body.fbp,
    });
  }

  if (name === "cta_click" && body.eventId) {
    await sendMetaEvent({
      eventName: "InitiateCheckout",
      eventId: body.eventId,
      sourceUrl: body.sourceUrl,
      clientIp,
      userAgent,
      fbc: body.fbc,
      fbp: body.fbp,
    });
  }

  return NextResponse.json({ ok: true });
}
