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
  cta: string | null;
  source: string | null;
  device: string | null;
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

export type SessionJourney = {
  ad?: string;
  source?: string;
  device?: string;
  cta?: string;
  minutes?: number;
};

// De dónde vino quien compró: anuncio, origen y dispositivo de la primera visita,
// y el último botón de Comprar que tocó.
export async function findSessionJourney(sessionId: string): Promise<SessionJourney> {
  const url = restUrl(
    `page_events?session_id=eq.${encodeURIComponent(sessionId)}` +
      "&select=name,utm_content,source,device,cta,created_at&order=created_at.asc&limit=200",
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
    "name" | "utm_content" | "source" | "device" | "cta" | "created_at"
  >[];
  if (rows.length === 0) {
    return {};
  }

  const first = rows[0];
  const click = rows.filter((row) => row.name === "cta_click").at(-1);
  const minutes = click
    ? Math.round((Date.parse(click.created_at) - Date.parse(first.created_at)) / 60000)
    : undefined;

  return {
    ad: rows.find((row) => row.utm_content)?.utm_content ?? undefined,
    source: first.source ?? undefined,
    device: first.device ?? undefined,
    cta: click?.cta ?? undefined,
    minutes: Number.isFinite(minutes) ? minutes : undefined,
  };
}

export type FunnelRow = {
  grouping_key: "ad" | "source" | "device";
  grouping_value: string;
  visits: number;
  bounced: number;
  read_half: number;
  clicked: number;
  sales: number;
};

export type DashboardStats = {
  totals: {
    visits: number;
    bounced: number;
    read_half: number;
    clicked: number;
    sales: number;
    refunds: number;
    all_orders: number;
    stuck: number;
  };
  groups: FunnelRow[];
  ctas: { cta: string; clicks: number; sales: number }[];
  video: {
    played: number;
    p25: number;
    p50: number;
    p75: number;
    p100: number;
    played_sales: number;
    played_clicked: number;
  };
  recent: {
    started: string;
    ad: string | null;
    source: string | null;
    device: string | null;
    max_depth: number;
    seconds: number | null;
    clicked: boolean;
    bought: boolean;
    video_depth: number;
  }[];
};

// El cálculo lo hace la función dashboard_stats de supabase/dashboard.sql.
export async function dashboardStats(hours: number): Promise<DashboardStats | null> {
  const url = restUrl("rpc/dashboard_stats");
  if (!url) {
    return null;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      since: new Date(Date.now() - hours * 3600 * 1000).toISOString(),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("[tablero]", response.status, (await response.text()).slice(0, 300));
    return null;
  }

  return (await response.json()) as DashboardStats;
}
