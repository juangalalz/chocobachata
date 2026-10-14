import { beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/reintentos/route";
import { listStuckOrders, MAX_ATTEMPTS, retryOrder, type StuckOrder } from "@/lib/retry-orders";

import { createBackend, setTestEnv } from "./helpers/fake-backend";

let backend: ReturnType<typeof createBackend>;

function stuck(fields: Partial<StuckOrder> = {}): StuckOrder {
  const row: StuckOrder = {
    lemon_order_id: "7001",
    session_id: null,
    email: "luis@example.com",
    full_name: "Luis Pérez",
    amount_cents: 2999,
    currency: "EUR",
    fbclid: null,
    fbc: null,
    fbp: null,
    client_ip: null,
    user_agent: null,
    wix_status: "member",
    capi_status: "pending",
    attempts: 0,
    alerted_at: null,
    refund_requested_at: null,
    ...fields,
  };
  backend.orders.set(row.lemon_order_id, { ...row });
  return row;
}

beforeEach(() => {
  setTestEnv();
  backend = createBackend();
});

describe("reintentos de pedidos", () => {
  it("termina un pedido a medias y avisa que se resolvió", async () => {
    backend.members.set("luis@example.com", "m-luis");
    const order = stuck({ wix_member_id: "m-luis", alerted_at: "2026-10-14T00:00:00Z" } as Partial<StuckOrder>);
    backend.orders.set("7001", { ...backend.orders.get("7001"), wix_member_id: "m-luis", last_error: "Wix 503" });

    expect(await retryOrder(order)).toBe("fixed");
    expect(backend.orders.get("7001")).toMatchObject({ wix_status: "access_sent", attempts: 1, last_error: null });
    expect(backend.telegram).toEqual([expect.stringContaining("✅")]);
  });

  it("avisa del primer fallo y no vuelve a avisar en los siguientes", async () => {
    backend.failures.set("wixapis", 503);

    expect(await retryOrder(stuck())).toBe("failed");
    expect(await retryOrder(stuck({ attempts: 1, alerted_at: "2026-10-14T00:00:00Z" }))).toBe("failed");

    expect(backend.telegram).toHaveLength(1);
    expect(backend.telegram[0]).toContain("⚠️");
  });

  it("pide revisión a mano al agotar los intentos", async () => {
    backend.failures.set("wixapis", 503);

    await retryOrder(stuck({ attempts: MAX_ATTEMPTS - 1, alerted_at: "2026-10-14T00:00:00Z" }));

    expect(backend.orders.get("7001")).toMatchObject({ attempts: MAX_ATTEMPTS });
    expect(backend.telegram).toEqual([expect.stringContaining("🚨")]);
  });

  it("reintenta un reembolso pendiente quitando el acceso", async () => {
    backend.members.set("luis@example.com", "m-luis");
    backend.participants.push({
      id: "x1",
      memberId: "m-luis",
      programId: "p1",
      enrollmentStatus: "JOINED",
      enrollmentInfo: { pricingType: "ADDED_MANUALLY" },
    });

    await retryOrder(stuck({ wix_status: "access_sent", capi_status: "sent", refund_requested_at: "2026-10-14T00:00:00Z" }));

    expect(backend.participants).toHaveLength(0);
    expect(backend.orders.get("7001")).toMatchObject({ wix_status: "refunded" });
  });

  it("busca solo pedidos atascados, tranquilos 10 minutos y de la última semana", async () => {
    await listStuckOrders(new Date("2026-10-20T12:00:00Z"));

    const url = decodeURIComponent(backend.calls[0].url);
    expect(url).toContain("wix_status.not.in.(access_sent,refunded)");
    expect(url).toContain("capi_status.in.(pending,failed)");
    expect(url).toContain("refund_requested_at.not.is.null");
    expect(url).toContain(`attempts=lt.${MAX_ATTEMPTS}`);
    expect(url).toContain("updated_at=lt.2026-10-20T11:50:00.000Z");
    expect(url).toContain("created_at=gt.2026-10-13T12:00:00.000Z");
  });

  it("el endpoint de reintentos exige el secreto de pg_cron", async () => {
    const denied = await POST(new Request("https://x/api/reintentos", { method: "POST" }));
    const allowed = await POST(
      new Request("https://x/api/reintentos", { method: "POST", headers: { "x-cron-secret": "cron-secret" } }),
    );

    expect(denied.status).toBe(401);
    expect(allowed.status).toBe(200);
  });
});
