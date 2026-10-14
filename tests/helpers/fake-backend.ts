// Supabase, Wix, Meta y Telegram falsos en memoria. Sustituye a fetch en las pruebas.
import { vi } from "vitest";

type Row = Record<string, unknown>;

export type Participant = {
  id: string;
  memberId: string;
  programId: string;
  enrollmentStatus: string;
  enrollmentInfo: { pricingType: string };
};

export const SUPABASE = "https://db.test";
export const PROGRAMS = ["p1", "p2", "p3"];

export function setTestEnv() {
  Object.assign(process.env, {
    SUPABASE_URL: SUPABASE,
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
    WIX_API_KEY: "wix-key",
    WIX_SITE_ID: "site",
    WIX_PROGRAM_IDS: PROGRAMS.join(","),
    NEXT_PUBLIC_META_PIXEL_ID: "pixel",
    META_CAPI_TOKEN: "capi-token",
    LEMON_WEBHOOK_SECRET: "lemon-secret",
    TELEGRAM_BOT_TOKEN: "bot",
    TELEGRAM_CHAT_ID: "chat",
    CRON_SECRET: "cron-secret",
  });
  delete process.env.META_TEST_EVENT_CODE;
}

function filterRows(rows: Row[], params: URLSearchParams): Row[] {
  return rows.filter((row) => {
    for (const [key, value] of params) {
      if (["select", "order", "limit", "on_conflict"].includes(key)) {
        continue;
      }
      const [op, ...rest] = value.split(".");
      const expected = rest.join(".");
      const actual = row[key] == null ? "" : String(row[key]);
      if (op === "eq" && actual !== expected) return false;
      if (op === "neq" && actual === expected) return false;
    }
    return true;
  });
}

export function createBackend() {
  const orders = new Map<string, Row>();
  const pageEvents: Row[] = [];
  const members = new Map<string, string>(); // email -> id
  const participants: Participant[] = [];
  const calls: { method: string; url: string; body?: unknown }[] = [];
  const telegram: string[] = [];
  const metaEvents: Row[] = [];
  // Ruta (subcadena) -> código HTTP con el que falla.
  const failures = new Map<string, number>();

  function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  async function handle(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" && init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, url: url.href, body });

    for (const [path, status] of failures) {
      if (url.href.includes(path)) {
        return json({ message: "fallo simulado" }, status);
      }
    }

    if (url.origin === SUPABASE) {
      if (url.pathname === "/rest/v1/orders") {
        if (method === "POST") {
          const id = String(body.lemon_order_id);
          orders.set(id, { attempts: 0, ...orders.get(id), ...body });
          return new Response(null, { status: 201 });
        }
        return json(filterRows([...orders.values()], url.searchParams));
      }
      if (url.pathname === "/rest/v1/page_events") {
        return json(filterRows(pageEvents, url.searchParams));
      }
    }

    if (url.hostname === "www.wixapis.com") {
      const path = url.pathname;
      if (path === "/members/v1/members") {
        const email = body.member.loginEmail as string;
        if (members.has(email)) {
          return json({ message: "Member already exists" }, 409);
        }
        const id = `m-${members.size + 1}`;
        members.set(email, id);
        return json({ member: { id } });
      }
      if (path === "/members/v1/members/query") {
        const id = members.get(body.query.filter.loginEmail.$eq);
        return json({ members: id ? [{ id }] : [] });
      }
      if (path.endsWith("/approve")) return json({ member: { status: "APPROVED" } });
      if (path.endsWith("/labels")) return json({});
      if (path === "/members/v1/auth/members/send-set-password-email") return json({ accepted: true });
      if (path === "/online-programs/v3/participants" && method === "POST") {
        const { memberId, programId } = body.participant;
        if (participants.some((p) => p.memberId === memberId && p.programId === programId)) {
          return json({ message: "already a participant" }, 409);
        }
        participants.push({
          id: `part-${participants.length + 1}`,
          memberId,
          programId,
          enrollmentStatus: "JOINED",
          enrollmentInfo: { pricingType: "ADDED_MANUALLY" },
        });
        return json({});
      }
      if (path === "/online-programs/v3/participants/query") {
        const memberId = body.query.filter.memberId.$eq;
        return json({ participants: participants.filter((p) => p.memberId === memberId) });
      }
      if (path.startsWith("/online-programs/v3/participants/") && method === "DELETE") {
        const id = path.split("/").pop();
        const index = participants.findIndex((p) => p.id === id);
        if (index < 0) return json({}, 404);
        participants.splice(index, 1);
        return new Response(null, { status: 200 });
      }
    }

    if (url.hostname === "graph.facebook.com") {
      metaEvents.push(...body.data);
      return json({ events_received: 1 });
    }

    if (url.hostname === "api.telegram.org") {
      telegram.push(body.text);
      return json({ ok: true });
    }

    return json({ message: `ruta no simulada: ${method} ${url.href}` }, 500);
  }

  const fetchMock = vi.fn(handle);
  vi.stubGlobal("fetch", fetchMock);

  return {
    orders,
    pageEvents,
    members,
    participants,
    calls,
    telegram,
    metaEvents,
    failures,
    callsTo: (path: string) => calls.filter((call) => call.url.includes(path)),
  };
}
