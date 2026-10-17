import "server-only";

import { notifySale } from "@/lib/alerts";
import { ordersUrl, saveOrder, supabaseHeaders } from "@/lib/fulfill-purchase";
import { offer } from "@/lib/offer";
import { lastLogin } from "@/lib/wix-access";

const HOURS_TO_LOGIN = 24;
const COURSE_URL = "https://www.chocobachata.com/my-programs";

type PaidOrder = {
  lemon_order_id: string;
  email: string | null;
  full_name: string | null;
  wix_member_id: string | null;
  created_at: string;
};

function firstName(fullName: string | null): string {
  return fullName?.trim().split(/\s+/)[0] ?? "";
}

// Correo que Natalia copia en Gmail cuando un alumno no ha entrado. La plantilla
// genérica está en docs/plantillas/correo-no-ha-entrado.md.
export function accessHelpEmail(fullName: string | null): string {
  const name = firstName(fullName);
  const whatsapp = `https://wa.me/${offer.whatsapp}?text=${encodeURIComponent(
    "¡Hola Choco! Compré el curso online de bachata y necesito ayuda para entrar.",
  )}`;

  return [
    "Asunto: ¿Pudiste entrar a tu curso de bachata? 💃",
    "",
    `¡Hola${name ? ` ${name}` : ""}!`,
    "",
    "Soy Choco. Vi que ya tienes tu Curso completo de bachata, pero todavía no has entrado a las clases, y quiero asegurarme de que puedas empezar.",
    "",
    "Para entrar:",
    "1. Busca en tu correo el mensaje de Choco Bachata para crear tu contraseña. Si no lo ves, revisa Spam o Promociones.",
    "2. Crea tu contraseña.",
    `3. Entra aquí con tu correo y esa contraseña: ${COURSE_URL}`,
    "4. Empieza por el Nivel 1: está pensado para ir desde cero.",
    "",
    "Si algo no te funciona, escríbeme por WhatsApp tocando este enlace y te ayudo a entrar a tus cursos o a solucionar lo que te esté pasando:",
    `👉 ${whatsapp}`,
    "",
    "¡Nos vemos en la pista!",
    "Choco",
  ].join("\n");
}

// Pedidos entregados hace más de 24 h (y menos de una semana) que aún no se revisaron.
async function ordersToCheck(now: Date): Promise<PaidOrder[]> {
  const due = new Date(now.getTime() - HOURS_TO_LOGIN * 3600 * 1000).toISOString();
  const week = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
  const url = ordersUrl(
    "?wix_status=eq.access_sent&login_checked_at=is.null" +
      `&created_at=lt.${encodeURIComponent(due)}&created_at=gt.${encodeURIComponent(week)}` +
      "&select=lemon_order_id,email,full_name,wix_member_id,created_at&order=created_at.asc&limit=5",
  );
  if (!url) {
    return [];
  }

  const response = await fetch(url, { headers: supabaseHeaders(), cache: "no-store" });
  return response.ok ? ((await response.json()) as PaidOrder[]) : [];
}

// Lo llama /api/reintentos cada 10 minutos. Cada pedido se revisa una sola vez.
export async function checkFirstLogins(now = new Date()): Promise<{ checked: number; alerted: number }> {
  const orders = await ordersToCheck(now);
  let alerted = 0;

  for (const order of orders) {
    if (!order.wix_member_id) {
      continue;
    }

    const login = await lastLogin(order.wix_member_id);
    if (login === undefined) {
      continue; // Wix no respondió: se vuelve a intentar en 10 minutos.
    }

    const loggedIn = login !== null && login >= order.created_at;
    await saveOrder(order.lemon_order_id, {
      login_checked_at: now.toISOString(),
      logged_in: loggedIn,
    });

    if (!loggedIn) {
      alerted += 1;
      const who = [order.full_name?.trim(), order.email].filter(Boolean).join(" · ");
      await notifySale(
        `🔑 ${who} compró hace más de ${HOURS_TO_LOGIN} h y todavía no ha entrado al curso.\n` +
          "Escríbele: en el siguiente mensaje tienes el correo listo para copiar y pegar en Gmail.",
      );
      await notifySale(accessHelpEmail(order.full_name));
    }
  }

  return { checked: orders.length, alerted };
}
