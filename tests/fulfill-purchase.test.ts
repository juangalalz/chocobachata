import { beforeEach, describe, expect, it } from "vitest";

import { fulfillPaidOrder, revokeRefundedOrder } from "@/lib/fulfill-purchase";

import { createBackend, PROGRAMS, setTestEnv } from "./helpers/fake-backend";

let backend: ReturnType<typeof createBackend>;

const order = {
  orderId: "1001",
  sessionId: "s-1",
  email: "ana@example.com",
  fullName: "Ana María López",
  amountCents: 2999,
  currency: "EUR",
  fbc: "fb.1.1.abc",
  fbp: "fb.1.1.def",
  clientIp: "1.2.3.4",
  userAgent: "Mozilla/5.0",
  sourceUrl: "https://curso.chocobachata.com/",
};

beforeEach(() => {
  setTestEnv();
  backend = createBackend();
});

describe("fulfillPaidOrder", () => {
  it("entrega una compra nueva completa: alumno, 3 niveles, correos y eventos de Meta", async () => {
    const memberId = await fulfillPaidOrder(order);

    expect(memberId).toBe("m-1");
    // Del último nivel al primero: Wix muestra arriba el último al que se unió.
    expect(backend.participants.map((p) => p.programId)).toEqual([...PROGRAMS].reverse());
    expect(backend.callsTo("/labels")).toHaveLength(1);
    expect(backend.callsTo("send-set-password-email")).toHaveLength(1);

    const saved = backend.orders.get("1001");
    expect(saved).toMatchObject({
      session_id: "s-1",
      email: "ana@example.com",
      wix_status: "access_sent",
      wix_member_id: "m-1",
      capi_status: "sent",
    });

    expect(backend.metaEvents.map((event) => [event.event_name, event.event_id])).toEqual([
      ["Lead", "1001-lead"],
      ["Purchase", "1001"],
    ]);
    expect(backend.metaEvents[1]).toMatchObject({
      custom_data: { value: 29.99, currency: "EUR" },
      user_data: { client_ip_address: "1.2.3.4", fbc: "fb.1.1.abc", fbp: "fb.1.1.def" },
    });
  });

  it("si falla el correo de acceso, el reintento sigue desde ahí sin repetir pasos", async () => {
    backend.failures.set("send-set-password-email", 500);
    await expect(fulfillPaidOrder(order)).rejects.toThrow("correo de acceso");

    expect(backend.orders.get("1001")).toMatchObject({ wix_status: "welcomed" });
    expect(String(backend.orders.get("1001")?.last_error)).toContain("welcomed");
    expect(backend.metaEvents).toHaveLength(0);

    backend.failures.clear();
    await fulfillPaidOrder(order);

    expect(backend.callsTo("/online-programs/v3/participants").filter((c) => c.method === "POST" && !c.url.includes("query"))).toHaveLength(3);
    expect(backend.callsTo("/labels")).toHaveLength(1);
    expect(backend.callsTo("send-set-password-email")).toHaveLength(2);
    expect(backend.orders.get("1001")).toMatchObject({ wix_status: "access_sent", capi_status: "sent" });
  });

  it("no envía el Purchase dos veces si Lemon repite el webhook", async () => {
    await fulfillPaidOrder(order);
    await fulfillPaidOrder(order);

    expect(backend.metaEvents.filter((event) => event.event_name === "Purchase")).toHaveLength(1);
    expect(backend.callsTo("send-set-password-email")).toHaveLength(1);
  });

  it("reutiliza el alumno si el correo ya existía en Wix", async () => {
    backend.members.set("ana@example.com", "m-existente");

    expect(await fulfillPaidOrder(order)).toBe("m-existente");
    expect(backend.participants.every((p) => p.memberId === "m-existente")).toBe(true);
  });

  it("un pedido reembolsado no vuelve a dar acceso", async () => {
    backend.orders.set("1001", { lemon_order_id: "1001", wix_status: "refunded", wix_member_id: "m-9", capi_status: "sent" });

    expect(await fulfillPaidOrder(order)).toBe("m-9");
    expect(backend.callsTo("wixapis")).toHaveLength(0);
  });
});

describe("revokeRefundedOrder", () => {
  it("quita solo los niveles que inscribió la web", async () => {
    await fulfillPaidOrder(order);
    backend.participants.push({
      id: "pagado-en-wix",
      memberId: "m-1",
      programId: "p1",
      enrollmentStatus: "JOINED",
      enrollmentInfo: { pricingType: "PAID" },
    });
    backend.participants.push({
      id: "otro-programa",
      memberId: "m-1",
      programId: "no-es-del-curso",
      enrollmentStatus: "JOINED",
      enrollmentInfo: { pricingType: "ADDED_MANUALLY" },
    });

    expect(await revokeRefundedOrder("1001", "ana@example.com")).toBe(3);
    expect(backend.participants.map((p) => p.id).sort()).toEqual(["otro-programa", "pagado-en-wix"]);
    expect(backend.orders.get("1001")).toMatchObject({ wix_status: "refunded" });
    expect(backend.orders.get("1001")?.refund_requested_at).toBeTruthy();
  });

  it("conserva el acceso si el alumno tiene otro pedido pagado", async () => {
    await fulfillPaidOrder(order);
    await fulfillPaidOrder({ ...order, orderId: "1002" });

    expect(await revokeRefundedOrder("1001", "ana@example.com")).toBe(0);
    expect(backend.participants).toHaveLength(3);
    expect(backend.orders.get("1001")).toMatchObject({ wix_status: "refunded" });
  });

  it("marca el reembolso aunque el alumno ya no exista en Wix", async () => {
    expect(await revokeRefundedOrder("2001", "nadie@example.com")).toBe(0);
    expect(backend.orders.get("2001")).toMatchObject({ wix_status: "refunded", email: "nadie@example.com" });
  });
});
