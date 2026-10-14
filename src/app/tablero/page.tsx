import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { dashboardStats, type DashboardStats, type FunnelRow } from "@/lib/visits";

export const metadata: Metadata = {
  title: "Tablero",
  robots: { index: false, follow: false },
};

const ranges = [
  { key: "24h", label: "Últimas 24 h", hours: 24 },
  { key: "7d", label: "7 días", hours: 24 * 7 },
  { key: "30d", label: "30 días", hours: 24 * 30 },
  { key: "todo", label: "Todo", hours: 24 * 365 * 10 },
] as const;

const adNames: Record<string, string> = {
  video1: "Video 1",
  video2: "Video 2",
  carrusel: "Carrusel",
  "sin anuncio": "Sin anuncio (directo u orgánico)",
};

const ctaNames: Record<string, string> = {
  oferta: "Tarjeta de arriba",
  video: "Debajo del video",
  barra: "Barra fija (móvil)",
  final: "Final de la página",
};

function percent(part: number, total: number): string {
  if (total === 0) {
    return "–";
  }

  const value = (part / total) * 100;
  return `${value < 10 && value > 0 ? value.toFixed(1) : Math.round(value)} %`;
}

function count(value: number, one: string, many: string): string {
  return `${value} ${value === 1 ? one : many}`;
}

function Card({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-card p-5">
      <p className="text-sm text-muted">{title}</p>
      <p className="mt-2 text-3xl font-extrabold">{value}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </article>
  );
}

function FunnelTable({ title, rows, names }: { title: string; rows: FunnelRow[]; names?: Record<string, string> }) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="mt-10">
      <h2 className="text-2xl font-bold">{title}</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-card text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold"> </th>
              <th className="px-4 py-3 font-semibold">Visitas</th>
              <th className="px-4 py-3 font-semibold">Rebote</th>
              <th className="px-4 py-3 font-semibold">Leen la mitad</th>
              <th className="px-4 py-3 font-semibold">Tocan Comprar</th>
              <th className="px-4 py-3 font-semibold">Ventas</th>
              <th className="px-4 py-3 font-semibold">Venden / visitas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((row) => (
              <tr key={row.grouping_value}>
                <td className="px-4 py-3 font-semibold">
                  {names?.[row.grouping_value] ?? row.grouping_value}
                </td>
                <td className="px-4 py-3">{row.visits}</td>
                <td className="px-4 py-3">{percent(row.bounced, row.visits)}</td>
                <td className="px-4 py-3">{percent(row.read_half, row.visits)}</td>
                <td className="px-4 py-3">
                  {percent(row.clicked, row.visits)}
                  <span className="text-muted"> ({row.clicked})</span>
                </td>
                <td className="px-4 py-3 font-semibold text-gold">{row.sales}</td>
                <td className="px-4 py-3">{percent(row.sales, row.visits)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function groupRows(stats: DashboardStats, key: FunnelRow["grouping_key"]) {
  return stats.groups.filter((row) => row.grouping_key === key);
}

export default async function TableroPage({
  searchParams,
}: {
  searchParams: Promise<{ k?: string; rango?: string }>;
}) {
  const params = await searchParams;
  const secret = process.env.TABLERO_CLAVE?.trim();

  // Sin la clave correcta la página no existe.
  if (!secret || params.k !== secret) {
    notFound();
  }

  const range = ranges.find((item) => item.key === params.rango) ?? ranges[1];
  const stats = await dashboardStats(range.hours);

  if (!stats) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-12">
        <p className="text-muted">No se pudieron leer los datos. Revisa Supabase.</p>
      </main>
    );
  }

  const { totals, video } = stats;
  const unlinked = totals.all_orders - totals.sales;

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-sm font-semibold tracking-[0.16em] text-gold uppercase">
        Choco Bachata
      </p>
      <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Qué hace la gente</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
        Lee el embudo de izquierda a derecha y busca dónde se cae. Rebote alto (más del
        50 %): el anuncio y la primera pantalla no coinciden. Leen pero no tocan Comprar
        (menos del 5 %): la página no convence. Tocan Comprar pero no compran (menos del
        25 % de los que tocan): el problema está en el pago. Tus visitas no cuentan si
        abres la página una vez con ?interno=1 en cada dispositivo.
      </p>

      <nav className="mt-6 flex flex-wrap gap-2">
        {ranges.map((item) => (
          <Link
            key={item.key}
            href={`/tablero?k=${encodeURIComponent(params.k ?? "")}&rango=${item.key}`}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              item.key === range.key
                ? "border-gold bg-gold text-[#1a1408]"
                : "border-white/10 text-muted hover:border-gold/60 hover:text-gold"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card title="Visitas" value={String(totals.visits)} detail={range.label} />
        <Card
          title="Rebote"
          value={percent(totals.bounced, totals.visits)}
          detail={`${totals.bounced} se fueron sin bajar`}
        />
        <Card
          title="Leen la mitad"
          value={percent(totals.read_half, totals.visits)}
          detail={`${totals.read_half} bajaron al 50 %`}
        />
        <Card
          title="Tocan Comprar"
          value={percent(totals.clicked, totals.visits)}
          detail={`${totals.clicked} abrieron el pago`}
        />
        <Card
          title="Ventas"
          value={String(totals.all_orders)}
          detail={`${percent(totals.sales, totals.clicked)} de quienes abren el pago${
            totals.refunds ? ` · ${totals.refunds} reembolsos` : ""
          }`}
        />
      </section>
      {unlinked > 0 ? (
        <p className="mt-3 text-xs text-muted">
          {unlinked} {unlinked === 1 ? "venta no tiene" : "ventas no tienen"} visita asociada
          (pago abierto desde otro dispositivo o desde un enlace directo de Lemon).
        </p>
      ) : null}

      <FunnelTable title="Por anuncio" rows={groupRows(stats, "ad")} names={adNames} />
      <FunnelTable title="Por origen" rows={groupRows(stats, "source")} />
      <FunnelTable title="Por dispositivo" rows={groupRows(stats, "device")} />

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-2xl font-bold">Qué botón usan</h2>
          {stats.ctas.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nadie ha tocado Comprar todavía.</p>
          ) : (
            <ul className="mt-4 divide-y divide-white/10 border-y border-white/10">
              {stats.ctas.map((row) => (
                <li key={row.cta} className="flex items-center justify-between py-3 text-sm">
                  <span className="font-semibold">{ctaNames[row.cta] ?? row.cta}</span>
                  <span className="text-muted">
                    {count(row.clicks, "clic", "clics")} ·{" "}
                    <span className="text-gold">{count(row.sales, "venta", "ventas")}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-2xl font-bold">Video de la página</h2>
          <ul className="mt-4 divide-y divide-white/10 border-y border-white/10 text-sm">
            <li className="flex justify-between py-3">
              <span className="font-semibold">Le dan play</span>
              <span className="text-muted">
                {video.played} · {percent(video.played, totals.visits)} de las visitas
              </span>
            </li>
            {(["p25", "p50", "p75", "p100"] as const).map((key) => (
              <li key={key} className="flex justify-between py-3">
                <span>Llegan al {key.slice(1)} %</span>
                <span className="text-muted">
                  {video[key]} · {percent(video[key], video.played)}
                </span>
              </li>
            ))}
            <li className="flex justify-between py-3">
              <span className="font-semibold">Tocan Comprar tras verlo</span>
              <span className="text-muted">
                {percent(video.played_clicked, video.played)} ·{" "}
                <span className="text-gold">
                  {count(video.played_sales, "venta", "ventas")}
                </span>
              </span>
            </li>
          </ul>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">Últimas visitas</h2>
        {stats.recent.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Todavía no hay visitas en este rango.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/10 border-y border-white/10">
            {stats.recent.map((visit) => (
              <li key={visit.started + (visit.ad ?? "")} className="py-4">
                <p className="font-semibold">
                  {visit.bought
                    ? "Compró"
                    : visit.clicked
                      ? "Tocó comprar"
                      : visit.max_depth >= 25
                        ? `Bajó hasta ${visit.max_depth} %`
                        : "Se fue sin hacer nada"}
                </p>
                <p className="text-sm text-muted">
                  {new Date(visit.started).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}
                  {visit.seconds != null ? ` · ${visit.seconds} s` : ""}
                  {visit.ad ? ` · ${adNames[visit.ad] ?? visit.ad}` : ""}
                  {visit.source ? ` · ${visit.source}` : ""}
                  {visit.device ? ` · ${visit.device}` : ""}
                  {visit.video_depth ? ` · vio el ${visit.video_depth} % del video` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
