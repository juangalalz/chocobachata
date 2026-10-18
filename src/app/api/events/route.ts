import { NextResponse } from "next/server";

import { sendMetaEvent } from "@/lib/meta";
import { notifyRescue, rescueCheck, sessionPurchased } from "@/lib/rescue";
import { insertPageEvent } from "@/lib/visits";

const names = new Set([
  "page_view",
  "scroll",
  "cta_click",
  "leave",
  "video_play",
  "video_progress",
  "checkout_return",
  "rescue_answer",
  "rescue_close",
  "whatsapp_click",
]);

// Eventos cuyo texto corto (botón, respuesta del rescate) se guarda en la columna cta.
const labeled = new Set(["cta_click", "rescue_answer", "whatsapp_click"]);
const notified = new Set(["rescue_answer", "whatsapp_click"]);

// Revisores de anuncios de Meta y otros robots: abren la página (y hasta tocan Comprar)
// pero no son personas.
const robots = /meta-externalads|facebookexternalhit|facebot|bot\b|crawler|spider|HeadlessChrome/i;

// Textos cortos que manda la página; se recortan por si alguien manda basura.
function label(value: unknown): string | null {
  return typeof value === "string" && value ? value.slice(0, 40) : null;
}

type EventBody = {
  sessionId?: string;
  visitorId?: string;
  name?: string;
  depth?: number;
  seconds?: number;
  path?: string;
  fbclid?: string;
  fbc?: string;
  fbp?: string;
  utmContent?: string;
  cta?: string;
  source?: string;
  device?: string;
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
  if (userAgent && robots.test(userAgent)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const rescue = notified.has(name) ? await rescueCheck(sessionId, name) : null;
  if (rescue && !rescue.valid) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  await insertPageEvent({
    session_id: sessionId,
    visitor_id: label(body.visitorId),
    name,
    depth: typeof body.depth === "number" ? body.depth : null,
    seconds: typeof body.seconds === "number" ? body.seconds : null,
    path: body.path ?? null,
    fbclid: body.fbclid ?? null,
    fbc: body.fbc ?? null,
    fbp: body.fbp ?? null,
    utm_content: body.utmContent ?? null,
    cta: labeled.has(name) ? label(body.cta) : null,
    source: label(body.source),
    device: label(body.device),
    event_id: body.eventId ?? null,
    client_ip: name === "cta_click" ? (clientIp ?? null) : null,
    user_agent: name === "cta_click" ? (userAgent ?? null) : null,
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

  if (rescue?.notify) {
    await notifyRescue(sessionId, name, label(body.cta));
  }

  // El rescate solo se muestra si la persona volvió sin haber comprado.
  if (name === "checkout_return") {
    return NextResponse.json({ ok: true, purchased: await sessionPurchased(sessionId) });
  }

  return NextResponse.json({ ok: true });
}
