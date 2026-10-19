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

function joined(memberId: string, programId: string, progressStatus: string) {
  backend.participants.push({
    id: `part-${programId}`,
    memberId,
    programId,
    enrollmentStatus: "JOINED",
    progressStatus,
    enrollmentInfo: { pricingType: "ADDED_MANUALLY" },
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
    expect(backend.orders.get("1")).toMatchObject({ logged_in: false, access_state: "not_opened" });
  });

  it("no avisa si entró y empezó una clase, ni antes de las 24 h", async () => {
    paidOrder("1", 25);
    paidOrder("2", 3);
    backend.logins.set("m-1", new Date(now.getTime() - 20 * 3600 * 1000).toISOString());
    joined("m-1", "p1", "IN_PROGRESS");

    expect(await checkFirstLogins(now)).toEqual({ checked: 1, alerted: 0 });
    expect(backend.telegram).toHaveLength(0);
    expect(backend.orders.get("1")).toMatchObject({ logged_in: true, access_state: "started" });
  });

  it("si abrió el correo pero no entró, manda la ayuda con la contraseña", async () => {
    paidOrder("1", 25);
    backend.verified.add("m-1");

    await checkFirstLogins(now);

    expect(backend.telegram[0]).toContain("🔐 Natividad Paredes · nati@example.com abrió el correo");
    expect(backend.telegram[2]).toContain("¿Olvidaste tu contraseña?");
    expect(backend.orders.get("1")).toMatchObject({ logged_in: false, access_state: "link_opened" });
  });

  it("si entró pero no empezó ninguna clase, manda el empujón al Nivel 1", async () => {
    paidOrder("1", 25);
    backend.verified.add("m-1");
    backend.logins.set("m-1", new Date(now.getTime() - 20 * 3600 * 1000).toISOString());
    joined("m-1", "p1", "NOT_STARTED");
    joined("m-1", "otro-curso-de-wix", "IN_PROGRESS");

    await checkFirstLogins(now);

    expect(backend.telegram[0]).toContain("👋 Natividad Paredes · nati@example.com entró al curso");
    expect(backend.telegram[2]).toContain("Tu primera clase te está esperando");
    expect(backend.orders.get("1")).toMatchObject({ logged_in: true, access_state: "not_started" });
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
