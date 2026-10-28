import "server-only";

import { createHash } from "node:crypto";

type MetaInput = {
  eventName: "PageView" | "Lead" | "InitiateCheckout" | "Purchase";
  eventId: string;
  sourceUrl?: string;
  clientIp?: string;
  userAgent?: string;
  fbc?: string;
  fbp?: string;
  // Nuestro identificador fijo del navegador: une las visitas de la misma persona.
  externalId?: string;
  email?: string;
  fullName?: string;
  value?: number;
  currency?: string;
};

// El identificador sin guiones son 32 caracteres hexadecimales: el píxel lo toma por ya
// cifrado y lo envía tal cual, así que navegador y servidor mandan el mismo valor.
export function metaExternalId(visitorId: string): string {
  return visitorId.replace(/-/g, "").toLowerCase();
}

export type MetaStatus = "sent" | "skipped" | "failed";

export async function sendMetaEvent(input: MetaInput): Promise<MetaStatus> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();
  const token = process.env.META_CAPI_TOKEN?.trim();

  if (!pixelId || !token) {
    return "skipped";
  }

  const userData: Record<string, string | string[]> = {};

  if (input.clientIp) {
    userData.client_ip_address = input.clientIp;
  }

  if (input.userAgent) {
    userData.client_user_agent = input.userAgent;
  }

  if (input.fbc) {
    userData.fbc = input.fbc;
  }

  if (input.fbp) {
    userData.fbp = input.fbp;
  }

  if (input.externalId) {
    userData.external_id = [metaExternalId(input.externalId)];
  }

  const hash = (value: string) =>
    createHash("sha256").update(value.trim().toLowerCase()).digest("hex");

  if (input.email) {
    userData.em = [hash(input.email)];
  }

  const [firstName, ...rest] = input.fullName?.trim().split(/\s+/) ?? [];
  if (firstName) {
    userData.fn = [hash(firstName)];
  }
  if (rest.length > 0) {
    userData.ln = [hash(rest.join(" "))];
  }

  if (Object.keys(userData).length === 0) {
    return "skipped";
  }

  const testCode = process.env.META_TEST_EVENT_CODE?.trim();
  const body: Record<string, unknown> = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        event_source_url: input.sourceUrl,
        user_data: userData,
        ...(input.value != null && input.currency
          ? { custom_data: { value: input.value, currency: input.currency } }
          : {}),
      },
    ],
  };

  if (testCode) {
    body.test_event_code = testCode;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      console.error("[meta]", input.eventName, response.status);
      return "failed";
    }

    return "sent";
  } catch (error) {
    console.error("[meta]", input.eventName, error);
    return "failed";
  }
}

