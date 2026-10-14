import "server-only";

export type PageEventRow = {
  id: string;
  session_id: string;
  name: string;
  depth: number | null;
  seconds: number | null;
  path: string | null;
  fbclid: string | null;
  fbc: string | null;
  fbp: string | null;
  utm_content: string | null;
  event_id: string | null;
  client_ip: string | null;
  user_agent: string | null;
  created_at: string;
};

export type SessionTracking = {
  fbclid?: string;
  fbc?: string;
  fbp?: string;
  clientIp?: string;
  userAgent?: string;
};

function headers() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return {
    apikey: key ?? "",
    Authorization: `Bearer ${key ?? ""}`,
    "Content-Type": "application/json",
  };
}

function restUrl(path: string): string | null {
  const base = process.env.SUPABASE_URL?.trim();
  if (!base || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return null;
  }

  return `${base.replace(/\/$/, "")}/rest/v1/${path}`;
}

export async function insertPageEvent(
  row: Omit<PageEventRow, "id" | "created_at">,
): Promise<void> {
  const url = restUrl("page_events");
  if (!url) {
    return;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    console.error("[visitas] No se guardó el evento", response.status);
  }
}

// Datos de Meta de la visita que abrió el pago. Se toma el valor más reciente
// de cada campo, empezando por el clic en Comprar ahora.
export async function findSessionTracking(
  sessionId: string,
): Promise<SessionTracking> {
  const url = restUrl(
    `page_events?session_id=eq.${encodeURIComponent(sessionId)}` +
      "&select=name,fbclid,fbc,fbp,client_ip,user_agent&order=created_at.desc&limit=50",
  );

  if (!url) {
    return {};
  }

  const response = await fetch(url, { headers: headers(), cache: "no-store" });

  if (!response.ok) {
    console.error("[visitas] No se leyó la sesión", response.status);
    return {};
  }

  const rows = (await response.json()) as Pick<
    PageEventRow,
    "name" | "fbclid" | "fbc" | "fbp" | "client_ip" | "user_agent"
  >[];
  rows.sort((a, b) => Number(b.name === "cta_click") - Number(a.name === "cta_click"));
  const pick = (field: "fbclid" | "fbc" | "fbp" | "client_ip" | "user_agent") =>
    rows.find((row) => row[field])?.[field] ?? undefined;

  return {
    fbclid: pick("fbclid"),
    fbc: pick("fbc"),
    fbp: pick("fbp"),
    clientIp: pick("client_ip"),
    userAgent: pick("user_agent"),
  };
}

export async function listPageEvents(): Promise<PageEventRow[]> {
  const url = restUrl(
    "page_events?select=*&order=created_at.desc&limit=2000",
  );

  if (!url) {
    return [];
  }

  const response = await fetch(url, { headers: headers(), cache: "no-store" });

  if (!response.ok) {
    return [];
  }

  return (await response.json()) as PageEventRow[];
}
