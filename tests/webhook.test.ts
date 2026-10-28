import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/lemon/webhook/route";

import { createBackend, setTestEnv } from "./helpers/fake-backend";

let backend: ReturnType<typeof createBackend>;

function lemon(event: string, attributes: Record<string, unknown>, custom: Record<string, string> = {}, id = "5001") {
  return {
    meta: { event_name: event, custom_data: custom },
    data: { id, attributes: { user_email: "Ana@Example.com", user_name: "Ana López", total: 2999, currency: "EUR", ...attributes } },
  };
}

function signed(payload: unknown, secret = "lemon-secret") {
  const raw = JSON.stringify(payload);
  return new Request("https://curso.chocobachata.com/api/lemon/webhook", {
    method: "POST",
    body: raw,
    headers: { "x-signature": createHmac("sha256", secret).update(raw).digest("hex") },
  });
}

beforeEach(() => {
  setTestEnv();
  backend = createBackend();
});

describe("webhook de Lemon", () => {
  it("rechaza firmas que no son de Lemon", async () => {
    const response = await POST(signed(lemon("order_created", { status: "paid" }), "otra-clave"));

    expect(response.status).toBe(401);
    expect(backend.calls).toHaveLength(0);
  });

  it("entrega la compra y recupera de Supabase los datos de Meta de la visita", async () => {
    backend.pageEvents.push(
      { session_id: "s-9", visitor_id: "AB-12", name: "page_view", fbclid: "abc", fbc: "fb.1.1.abc", fbp: "fb.1.1.p", client_ip: null, user_agent: null },
      { session_id: "s-9", name: "cta_click", fbclid: null, fbc: null, fbp: null, client_ip: "9.9.9.9", user_agent: "iPhone" },
    );

    const response = await POST(signed(lemon("order_created", { status: "paid" }, { session_id: "s-9" })));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, memberId: "m-1" });
    expect(backend.orders.get("5001")).toMatchObject({
      email: "ana@example.com",
      session_id: "s-9",
      fbc: "fb.1.1.abc",
      client_ip: "9.9.9.9",
      user_agent: "iPhone",
      wix_status: "access_sent",
    });
    // La compra lleva el mismo identificador que las visitas, para que Meta una a la persona.
    expect(backend.metaEvents.find((event) => event.event_name === "Purchase")?.user_data).toMatchObject({
      external_id: ["ab12"],
    });
    expect(backend.telegram).toHaveLength(0);
  });

  it("ignora pedidos que no están pagados", async () => {
    const response = await POST(signed(lemon("order_created", { status: "pending" })));

    expect(await response.json()).toMatchObject({ skipped: true });
    expect(backend.callsTo("wixapis")).toHaveLength(0);
  });

  it("un reembolso parcial no quita el acceso", async () => {
    const response = await POST(signed(lemon("order_refunded", { status: "partial_refund" })));

    expect(await response.json()).toMatchObject({ skipped: true });
    expect(backend.callsTo("wixapis")).toHaveLength(0);
  });

  it("si Wix falla responde 500 y avisa una sola vez por Telegram", async () => {
    backend.failures.set("/online-programs/v3/participants", 503);

    const first = await POST(signed(lemon("order_created", { status: "paid" })));
    const second = await POST(signed(lemon("order_created", { status: "paid" })));

    expect(first.status).toBe(500);
    expect(second.status).toBe(500);
    expect(backend.telegram).toHaveLength(1);
    expect(backend.telegram[0]).toContain("⚠️");
    expect(backend.telegram[0]).toContain("5001");
    expect(backend.orders.get("5001")?.last_error).toBeTruthy();
  });

  it("avisa cuando un reintento de Lemon por fin entrega el acceso", async () => {
    backend.failures.set("/online-programs/v3/participants", 503);
    await POST(signed(lemon("order_created", { status: "paid" })));

    backend.failures.clear();
    const response = await POST(signed(lemon("order_created", { status: "paid" })));

    expect(response.status).toBe(200);
    expect(backend.telegram).toHaveLength(2);
    expect(backend.telegram[1]).toContain("✅");
    expect(backend.orders.get("5001")?.last_error).toBeNull();
  });

  it("un reembolso total quita el acceso y si falla Wix avisa", async () => {
    await POST(signed(lemon("order_created", { status: "paid" })));
    backend.failures.set("participants/query", 500);

    const failed = await POST(signed(lemon("order_refunded", { status: "refunded" })));
    expect(failed.status).toBe(500);
    expect(backend.telegram[0]).toContain("reembolso");

    backend.failures.clear();
    const ok = await POST(signed(lemon("order_refunded", { status: "refunded" })));
    expect(await ok.json()).toMatchObject({ ok: true, removed: 3 });
    expect(backend.participants).toHaveLength(0);
  });
});
