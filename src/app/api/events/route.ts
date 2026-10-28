import { NextResponse } from "next/server";

import { sendMetaEvent } from "@/lib/meta";
import { notifyRescue, rescueCheck, sessionPurchased } from "@/lib/rescue";
import { robotReason } from "@/lib/robots";
import { insertPageEvent, insertRobotEvent } from "@/lib/visits";

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
  "section_view",
]);

// Eventos cuyo texto corto (botón, respuesta del rescate) se guarda en la columna cta.
const labeled = new Set(["cta_click", "rescue_answer", "whatsapp_click", "section_view"]);
const notified = new Set(["rescue_answer", "whatsapp_click"]);

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
  adGroup?: string;
  placement?: string;
  visibleSeconds?: number;
  loadedHidden?: boolean;
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
  const depth = typeof body.depth === "number" ? body.depth : null;
  const seconds = typeof body.seconds === "number" ? body.seconds : null;
  const visibleSeconds = typeof body.visibleSeconds === "number" ? body.visibleSeconds : null;
  const loadedHidden = typeof body.loadedHidden === "boolean" ? body.loadedHidden : null;
  const cta = labeled.has(name) ? label(body.cta) : null;

  // Ni cuentan como visita ni se reenvían a Meta, pero quedan en su tabla para el informe.
  const reason = robotReason(userAgent, clientIp);
  if (reason) {
    await insertRobotEvent({
      reason,
      session_id: sessionId,
      name,
      depth,
      seconds,
      visible_seconds: visibleSeconds,
      loaded_hidden: loadedHidden,
      cta,
      utm_content: label(body.utmContent),
      ad_group: label(body.adGroup),
      placement: label(body.placement),
      has_fbclid: Boolean(body.fbclid),
      client_ip: clientIp ?? null,
      user_agent: userAgent?.slice(0, 300) ?? null,
    });
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
    depth,
    seconds,
    path: body.path ?? null,
    fbclid: body.fbclid ?? null,
    fbc: body.fbc ?? null,
    fbp: body.fbp ?? null,
    utm_content: body.utmContent ?? null,
    ad_group: label(body.adGroup),
    placement: label(body.placement),
    visible_seconds: visibleSeconds,
    loaded_hidden: loadedHidden,
    cta,
    source: label(body.source),
    device: label(body.device),
    event_id: body.eventId ?? null,
    client_ip: name === "cta_click" ? (clientIp ?? null) : null,
    // El navegador en cada evento, para poder reconocer robots nuevos; la IP solo en el clic.
    user_agent: userAgent?.slice(0, 300) ?? null,
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
      externalId: label(body.visitorId) ?? undefined,
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
      externalId: label(body.visitorId) ?? undefined,
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
