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
  created_at: string;
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
