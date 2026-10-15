import { beforeEach, describe, expect, it } from "vitest";

import { POST as events } from "@/app/api/events/route";
import { whatsappLinks } from "@/lib/whatsapp";

import { createBackend, setTestEnv } from "./helpers/fake-backend";

let backend: ReturnType<typeof createBackend>;

function send(body: Record<string, unknown>) {
  return events(
    new Request("https://curso.chocobachata.com/api/events", {
      method: "POST",
      body: JSON.stringify({ sessionId: "s-1", source: "instagram", device: "movil", ...body }),
    }),
  );
}

beforeEach(() => {
  setTestEnv();
  backend = createBackend();
});

describe("rescate de quien vuelve del pago", () => {
  it("dice si la sesión ya compró para no mostrar el rescate a un cliente", async () => {
    const before = await send({ name: "checkout_return", seconds: 4 });
    expect(await before.json()).toMatchObject({ purchased: false });

    backend.orders.set("9001", { lemon_order_id: "9001", session_id: "s-1" });
    const after = await send({ name: "checkout_return", seconds: 4 });
    expect(await after.json()).toMatchObject({ purchased: true });
  });

  it("avisa por Telegram la respuesta con el anuncio y el tiempo en el pago", async () => {
    await send({ name: "page_view", utmContent: "video2" });
    await send({ name: "cta_click", cta: "oferta", eventId: "e1" });
    await send({ name: "checkout_return", seconds: 4 });
    await send({ name: "rescue_answer", cta: "pago" });

    expect(backend.telegram).toHaveLength(1);
    expect(backend.telegram[0]).toContain("Tuve un problema al pagar");
    expect(backend.telegram[0]).toContain("Video 2");
    expect(backend.telegram[0]).toContain("4 s en el pago");
    expect(backend.pageEvents.find((row) => row.name === "rescue_answer")).toMatchObject({ cta: "pago" });
  });

  it("no avisa si la sesión nunca abrió el pago ni repite el aviso", async () => {
    await send({ name: "rescue_answer", cta: "duda" });
    expect(backend.telegram).toHaveLength(0);
    expect(backend.pageEvents).toHaveLength(0);

    await send({ name: "cta_click", cta: "barra", eventId: "e1" });
    await send({ name: "rescue_answer", cta: "duda" });
    await send({ name: "rescue_answer", cta: "duda" });
    await send({ name: "whatsapp_click", cta: "duda" });

    expect(backend.telegram).toHaveLength(2);
    expect(backend.telegram[1]).toContain("Abrió WhatsApp");
  });
});

describe("enlaces de WhatsApp", () => {
  it("van directo a la app o a WhatsApp Web, sin la pantalla de wa.me", () => {
    const links = whatsappLinks("573114504359", "¡Hola Choco! Tengo una duda");

    expect(links.app).toBe("whatsapp://send?phone=573114504359&text=%C2%A1Hola%20Choco!%20Tengo%20una%20duda");
    expect(links.web).toMatch(/^https:\/\/web\.whatsapp\.com\/send\?phone=573114504359&text=/);
    expect(links.fallback).toMatch(/^https:\/\/wa\.me\/573114504359\?text=/);
  });
});
