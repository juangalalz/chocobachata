import { beforeEach, describe, expect, it } from "vitest";

import { accessHelpEmail, checkFirstLogins } from "@/lib/login-check";

import { createBackend, setTestEnv } from "./helpers/fake-backend";

let backend: ReturnType<typeof createBackend>;
const now = new Date("2026-10-18T12:00:00Z");

function paidOrder(id: string, hoursAgo: number, fields: Record<string, unknown> = {}) {
  backend.orders.set(id, {
    lemon_order_id: id,
    email: "nati@example.com",
    full_name: "Natividad Paredes",
    wix_member_id: `m-${id}`,
    wix_status: "access_sent",
    login_checked_at: null,
    created_at: new Date(now.getTime() - hoursAgo * 3600 * 1000).toISOString(),
    ...fields,
  });
}

beforeEach(() => {
  setTestEnv();
  backend = createBackend();
});

describe("aviso de alumno que no ha entrado al curso", () => {
  it("a las 24 h sin entrar avisa con el correo listo para copiar", async () => {
    paidOrder("1", 25);

    expect(await checkFirstLogins(now)).toEqual({ checked: 1, alerted: 1 });
    expect(backend.telegram[0]).toContain("Natividad Paredes · nati@example.com");
    expect(backend.telegram[0]).toContain("todavía no ha entrado");
    expect(backend.telegram.filter((text) => text.includes("¡Hola Natividad!"))).toHaveLength(2); // tú y Natalia
    expect(backend.orders.get("1")).toMatchObject({ logged_in: false });
  });

  it("no avisa si ya entró después de comprar, ni antes de las 24 h", async () => {
    paidOrder("1", 25);
    paidOrder("2", 3);
    backend.logins.set("m-1", new Date(now.getTime() - 20 * 3600 * 1000).toISOString());

    expect(await checkFirstLogins(now)).toEqual({ checked: 1, alerted: 0 });
    expect(backend.telegram).toHaveLength(0);
    expect(backend.orders.get("1")).toMatchObject({ logged_in: true });
  });

  it("revisa cada pedido una sola vez", async () => {
    paidOrder("1", 25);

    await checkFirstLogins(now);
    await checkFirstLogins(now);

    expect(backend.telegram).toHaveLength(4); // aviso + plantilla a los 2 chats, una sola vez
  });

  it("la plantilla lleva el enlace de WhatsApp con el mensaje escrito", () => {
    const email = accessHelpEmail(null);

    expect(email).toContain("¡Hola!");
    expect(email).toContain("https://wa.me/573114504359?text=%C2%A1Hola%20Choco!");
    expect(email).toContain("https://www.chocobachata.com/my-programs");
  });
});
