import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/lemon/webhook/route";
import { retryOrder, type StuckOrder } from "@/lib/retry-orders";
import { saleMessage } from "@/lib/sale-notice";

import { createBackend, setTestEnv } from "./helpers/fake-backend";

let backend: ReturnType<typeof createBackend>;

function paid(id = "7001", sessionId = "s-1") {
  const raw = JSON.stringify({
    meta: { event_name: "order_created", custom_data: { session_id: sessionId } },
    data: { id, attributes: { status: "paid", user_email: "ana@example.com", user_name: "Ana López", total: 2999, currency: "EUR" } },
  });
  return new Request("https://curso.chocobachata.com/api/lemon/webhook", {
    method: "POST",
    body: raw,
    headers: { "x-signature": createHmac("sha256", "lemon-secret").update(raw).digest("hex") },
  });
}

function visit(name: string, minute: number, fields: Record<string, unknown> = {}) {
  backend.pageEvents.push({
    session_id: "s-1",
    name,
    utm_content: null,
    source: "instagram",
    device: "movil",
    cta: null,
    created_at: new Date(Date.UTC(2026, 9, 14, 19, minute)).toISOString(),
    ...fields,
  });
}

beforeEach(() => {
  setTestEnv();
  backend = createBackend();
});

describe("aviso de venta por Telegram", () => {
  it("cuenta anuncio, dispositivo, origen y botón a cada chat de ventas", async () => {
    visit("page_view", 0, { utm_content: "video1" });
    visit("cta_click", 2, { cta: "oferta" });
    visit("cta_click", 6, { cta: "video" });

    expect((await POST(paid())).status).toBe(200);

    expect(backend.sales.map((sale) => sale.chatId)).toEqual(["chat", "hermana"]);
    const text = backend.sales[0].text;
    expect(text).toContain("29,99 €");
    expect(text).toContain("👤 Ana López · ana@example.com");
    expect(text).toContain("Anuncio: Video 1");
    expect(text).toContain("Móvil · Instagram");
    expect(text).toContain("Comprar bajo el video (mitad)");
    expect(text).toContain("Tardó 6 min");
    expect(backend.telegram).toHaveLength(0);
  });

  it("cuenta las visitas anteriores del mismo navegador y desde qué anuncio", async () => {
    backend.pageEvents.push(
      { session_id: "antes", visitor_id: "v-1", name: "page_view", utm_content: "video2", created_at: "2026-10-12T20:00:00.000Z" },
      { session_id: "otra-persona", visitor_id: "v-2", name: "page_view", utm_content: "video1", created_at: "2026-10-13T20:00:00.000Z" },
    );
    visit("page_view", 0, { utm_content: "carrusel", visitor_id: "v-1" });

    await POST(paid());

    expect(backend.sales[0].text).toMatch(/🔁 Compró en su visita 2, \d días después de la primera: Video 2 \(12 oct\) → Carrusel de fotos \(14 oct\)/);
  });

  it("dice si compró en la primera visita", async () => {
    visit("page_view", 0, { visitor_id: "v-1" });

    await POST(paid());

    expect(backend.sales[0].text).toContain("🔁 Compró en su primera visita");
  });

  it("no repite el aviso si Lemon manda el mismo pedido otra vez", async () => {
    visit("page_view", 0);

    await POST(paid());
    await POST(paid());

    expect(backend.sales).toHaveLength(2); // un mensaje por chat, una sola vez
  });

  it("si el acceso falla no avisa la venta hasta que el reintento la entrega", async () => {
    visit("page_view", 0);
    backend.failures.set("/members/v1/members", 503);

    expect((await POST(paid())).status).toBe(500);
    expect(backend.sales).toHaveLength(0);

    backend.failures.clear();
    expect(await retryOrder(backend.orders.get("7001") as unknown as StuckOrder)).toBe("fixed");

    expect(backend.sales).toHaveLength(2);
    expect(backend.telegram.some((text) => text.startsWith("⚠️"))).toBe(true);
  });

  it("sin visita registrada lo dice en vez de inventar", () => {
    const text = saleMessage({ amountCents: 2999, currency: "EUR" }, {});

    expect(text).toContain("Anuncio: ninguno (orgánico)");
    expect(text).toContain("Botón: no registrado");
  });
});
