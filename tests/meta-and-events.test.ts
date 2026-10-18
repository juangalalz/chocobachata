import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";

import { POST as events } from "@/app/api/events/route";
import { sendMetaEvent } from "@/lib/meta";

import { createBackend, setTestEnv, SUPABASE } from "./helpers/fake-backend";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");

let backend: ReturnType<typeof createBackend>;

beforeEach(() => {
  setTestEnv();
  backend = createBackend();
});

describe("sendMetaEvent", () => {
  it("cifra correo, nombre y apellidos como pide Meta", async () => {
    await sendMetaEvent({
      eventName: "Purchase",
      eventId: "1",
      email: " Ana@Example.com ",
      fullName: "Ana María López",
      value: 29.99,
      currency: "EUR",
    });

    expect(backend.metaEvents[0].user_data).toEqual({
      em: [sha("ana@example.com")],
      fn: [sha("ana")],
      ln: [sha("maría lópez")],
    });
  });

  it("no envía nada sin token de CAPI", async () => {
    delete process.env.META_CAPI_TOKEN;

    expect(await sendMetaEvent({ eventName: "PageView", eventId: "1", fbp: "x" })).toBe("skipped");
    expect(backend.calls).toHaveLength(0);
  });

  it("incluye el código de prueba cuando existe", async () => {
    process.env.META_TEST_EVENT_CODE = "TEST123";
    await sendMetaEvent({ eventName: "PageView", eventId: "1", fbp: "x" });

    expect(backend.calls[0].body).toMatchObject({ test_event_code: "TEST123" });
  });
});

function visit(body: Record<string, unknown>, userAgent = "Instagram 350") {
  return events(
    new Request("https://curso.chocobachata.com/api/events", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "x-forwarded-for": "5.6.7.8, 10.0.0.1", "user-agent": userAgent },
    }),
  );
}

describe("/api/events", () => {
  it("rechaza eventos desconocidos o sin sesión", async () => {
    expect((await visit({ name: "hack", sessionId: "s" })).status).toBe(400);
    expect((await visit({ name: "page_view" })).status).toBe(400);
  });

  it("ignora al revisor de anuncios de Meta y a otros robots", async () => {
    const robot = "meta-externalads/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)";
    await visit({ name: "cta_click", sessionId: "s", eventId: "e1", cta: "oferta" }, robot);

    expect(backend.callsTo(`${SUPABASE}/rest/v1/page_events`)).toHaveLength(0);
    expect(backend.metaEvents).toHaveLength(0);
  });

  it("guarda IP y botón solo en el clic de Comprar, y el navegador siempre", async () => {
    await visit({ name: "cta_click", sessionId: "s", eventId: "e1", cta: "barra", source: "instagram", device: "movil" });
    await visit({ name: "scroll", sessionId: "s", depth: 50, cta: "barra", source: "instagram" });

    const inserts = backend.callsTo(`${SUPABASE}/rest/v1/page_events`).map((call) => call.body as Record<string, unknown>);
    expect(inserts[0]).toMatchObject({ client_ip: "5.6.7.8", user_agent: "Instagram 350", cta: "barra", source: "instagram" });
    expect(inserts[1]).toMatchObject({ client_ip: null, user_agent: "Instagram 350", cta: null, depth: 50 });
    expect(backend.metaEvents.map((event) => event.event_name)).toEqual(["InitiateCheckout"]);
  });

  it("recorta los textos largos que manda la página", async () => {
    await visit({ name: "page_view", sessionId: "s", source: "x".repeat(200) });

    const insert = backend.callsTo("page_events")[0].body as Record<string, string>;
    expect(insert.source).toHaveLength(40);
  });

  it("acepta los eventos del video", async () => {
    expect((await visit({ name: "video_play", sessionId: "s" })).status).toBe(200);
    expect((await visit({ name: "video_progress", sessionId: "s", depth: 75 })).status).toBe(200);
  });
});
