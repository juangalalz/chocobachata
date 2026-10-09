import type { Metadata } from "next";

import { listPageEvents, type PageEventRow } from "@/lib/visits";

export const metadata: Metadata = {
  title: "Visitas",
  robots: { index: false, follow: false },
};

type Session = {
  id: string;
  started: string;
  utm: string;
  maxDepth: number;
  seconds: number | null;
  clicked: boolean;
};

function sessionsFrom(rows: PageEventRow[]): Session[] {
  const map = new Map<string, Session>();

  for (const row of [...rows].reverse()) {
    const current = map.get(row.session_id) ?? {
      id: row.session_id,
      started: row.created_at,
      utm: row.utm_content ?? "",
      maxDepth: 0,
      seconds: null,
      clicked: false,
    };

    if (row.name === "scroll" || row.name === "leave") {
      current.maxDepth = Math.max(current.maxDepth, row.depth ?? 0);
    }

    if (row.name === "leave" && row.seconds != null) {
      current.seconds = row.seconds;
    }

    if (row.name === "cta_click") {
      current.clicked = true;
    }

    map.set(row.session_id, current);
  }

  return [...map.values()].sort((a, b) => b.started.localeCompare(a.started));
}

function percent(part: number, total: number): string {
  if (total === 0) {
    return "0 %";
  }

  return `${Math.round((part / total) * 100)} %`;
}

export default async function TableroPage() {
  const rows = await listPageEvents();
  const sessions = sessionsFrom(rows);
  const total = sessions.length;
  const bounced = sessions.filter(
    (session) => !session.clicked && session.maxDepth < 25,
  ).length;
  const scrolled = sessions.filter((session) => session.maxDepth >= 25).length;
  const clicked = sessions.filter((session) => session.clicked).length;

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-sm font-semibold tracking-[0.16em] text-gold uppercase">
        Choco Bachata
      </p>
      <h1 className="mt-2 text-4xl font-extrabold tracking-tight">
        Qué hace la gente
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
        Rebote es quien entra y se va sin bajar ni tocar Comprar ahora. Si esa
        cifra es alta, el anuncio y la primera pantalla no coinciden. Si bajan
        y no compran, la página no convence. Si tocan comprar y no hay pedido,
        el problema está en el pago.
      </p>

      <section className="mt-8 grid gap-4 sm:grid-cols-4">
        <article className="rounded-2xl border border-white/10 bg-card p-5">
          <p className="text-sm text-muted">Visitas</p>
          <p className="mt-2 text-3xl font-extrabold">{total}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-card p-5">
          <p className="text-sm text-muted">Rebote</p>
          <p className="mt-2 text-3xl font-extrabold">{percent(bounced, total)}</p>
          <p className="mt-1 text-xs text-muted">{bounced} se fueron de una</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-card p-5">
          <p className="text-sm text-muted">Hicieron scroll</p>
          <p className="mt-2 text-3xl font-extrabold">{percent(scrolled, total)}</p>
          <p className="mt-1 text-xs text-muted">{scrolled} bajaron a leer</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-card p-5">
          <p className="text-sm text-muted">Tocaron comprar</p>
          <p className="mt-2 text-3xl font-extrabold">{percent(clicked, total)}</p>
          <p className="mt-1 text-xs text-muted">{clicked} abrieron el pago</p>
        </article>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">Últimas visitas</h2>
        {sessions.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Todavía no hay visitas guardadas. Entra a la página de inicio y
            recarga esta.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-white/10 border-y border-white/10">
            {sessions.slice(0, 30).map((session) => (
              <li
                key={session.id}
                className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">
                    {session.clicked
                      ? "Tocó comprar"
                      : session.maxDepth >= 25
                        ? `Bajó hasta ${session.maxDepth} %`
                        : "Se fue sin hacer nada"}
                  </p>
                  <p className="text-sm text-muted">
                    {new Date(session.started).toLocaleString("es-ES")}
                    {session.seconds != null ? ` · ${session.seconds} s` : ""}
                    {session.utm ? ` · anuncio ${session.utm}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
