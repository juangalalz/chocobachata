import "server-only";

import { notifySale } from "@/lib/alerts";
import { ordersUrl, saveOrder, supabaseHeaders } from "@/lib/fulfill-purchase";
import { offer } from "@/lib/offer";
import { memberActivity } from "@/lib/wix-access";

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

function whatsappLink(text: string): string {
  return `https://wa.me/${offer.whatsapp}?text=${encodeURIComponent(text)}`;
}

// Correos que Natalia copia en Gmail según en qué punto se quedó el alumno. Las
// plantillas genéricas están en docs/plantillas/ (una por cada caso).
function email(subject: string, fullName: string | null, body: string[]): string {
  const name = firstName(fullName);
  return [`Asunto: ${subject}`, "", `¡Hola${name ? ` ${name}` : ""}!`, "", ...body, "", "¡Nos vemos en la pista!", "Choco"].join("\n");
}

// No abrió el correo para crear la contraseña.
export function accessHelpEmail(fullName: string | null): string {
  return email("¿Pudiste entrar a tu curso de bachata? 💃", fullName, [
    "Soy Choco. Vi que ya tienes tu Curso completo de bachata, pero todavía no has entrado a las clases, y quiero asegurarme de que puedas empezar.",
    "",
    "Para entrar:",
    "1. Busca en tu correo el mensaje de Choco Bachata para crear tu contraseña. Si no lo ves, revisa Spam o Promociones.",
    "2. Crea tu contraseña.",
    `3. Entra aquí con tu correo y esa contraseña: ${COURSE_URL}`,
    "4. Empieza por el Nivel 1: está pensado para ir desde cero.",
    "",
    "Si algo no te funciona, escríbeme por WhatsApp tocando este enlace y te ayudo a entrar a tus cursos o a solucionar lo que te esté pasando:",
    `👉 ${whatsappLink("¡Hola Choco! Compré el curso online de bachata y necesito ayuda para entrar.")}`,
  ]);
}

// Abrió el enlace del correo pero no llegó a entrar: casi siempre, la contraseña.
export function passwordHelpEmail(fullName: string | null): string {
  return email("¿Te ayudo con tu contraseña? 💃", fullName, [
    "Soy Choco. Vi que abriste el correo para crear tu contraseña, pero todavía no has podido entrar a tus clases. Si te quedaste a medias, se arregla en un minuto:",
    "",
    `1. Entra aquí: ${COURSE_URL}`,
    "2. Toca «Iniciar sesión» y después «¿Olvidaste tu contraseña?».",
    "3. Escribe tu correo: te llegará un mensaje nuevo para crear la contraseña. Si no lo ves, revisa Spam o Promociones.",
    "4. Crea la contraseña, entra y empieza por el Nivel 1.",
    "",
    "Si se te complica, escríbeme por WhatsApp tocando este enlace y lo resolvemos juntos:",
    `👉 ${whatsappLink("¡Hola Choco! Compré el curso online de bachata y tengo problemas con la contraseña.")}`,
  ]);
}

// Entró pero no ha empezado ninguna clase.
export function firstClassEmail(fullName: string | null): string {
  return email("Tu primera clase te está esperando 💃", fullName, [
    "Soy Choco. Vi que ya entraste a tu curso, ¡qué alegría tenerte! Todavía no has empezado ninguna clase, así que te dejo el primer paso fácil:",
    "",
    `👉 Entra aquí y abre el Nivel 1: ${COURSE_URL}`,
    "",
    "Está pensado para empezar desde cero, a tu ritmo y en tu casa. Un consejo: dale unos minutos hoy mismo. El cuerpo aprende con la repetición, no con la perfección.",
    "",
    "Si tienes cualquier duda, escríbeme por WhatsApp tocando este enlace:",
    `👉 ${whatsappLink("¡Hola Choco! Ya entré al curso online de bachata y tengo una pregunta.")}`,
  ]);
}

type AccessState = "started" | "not_started" | "link_opened" | "not_opened";

const FOLLOW_UPS: Record<Exclude<AccessState, "started">, { icon: string; notice: string; email: (fullName: string | null) => string }> = {
  not_opened: {
    icon: "🔑",
    notice: `compró hace más de ${HOURS_TO_LOGIN} h y todavía no ha entrado al curso (no ha abierto el correo para crear la contraseña).`,
    email: accessHelpEmail,
  },
  link_opened: {
    icon: "🔐",
    notice: "abrió el correo para crear la contraseña pero no llegó a entrar: seguramente se atascó con la contraseña.",
    email: passwordHelpEmail,
  },
  not_started: {
    icon: "👋",
    notice: `entró al curso pero en ${HOURS_TO_LOGIN} h no ha empezado ninguna clase.`,
    email: firstClassEmail,
  },
};

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

    const activity = await memberActivity(order.wix_member_id);
    if (!activity) {
      continue; // Wix no respondió: se vuelve a intentar en 10 minutos.
    }

    const loggedIn = activity.lastLogin !== null && activity.lastLogin >= order.created_at;
    const state: AccessState = loggedIn
      ? activity.started ? "started" : "not_started"
      : activity.emailVerified ? "link_opened" : "not_opened";
    await saveOrder(order.lemon_order_id, {
      login_checked_at: now.toISOString(),
      logged_in: loggedIn,
      access_state: state,
    });

    if (state !== "started") {
      alerted += 1;
      const who = [order.full_name?.trim(), order.email].filter(Boolean).join(" · ");
      const followUp = FOLLOW_UPS[state];
      await notifySale(
        `${followUp.icon} ${who} ${followUp.notice}\n` +
          "Escríbele: en el siguiente mensaje tienes el correo listo para copiar y pegar en Gmail.",
      );
      await notifySale(followUp.email(order.full_name));
    }
  }

  return { checked: orders.length, alerted };
}
