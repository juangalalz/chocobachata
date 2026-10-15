#!/usr/bin/env node
// Coste real por venta de cada anuncio: gasto, impresiones y clics de Meta cruzados con las
// ventas que registra nuestra web (no las que Meta atribuye).
//
//   node scripts/meta-ads/informe.mjs                      últimos 7 días, campaña del config
//   node scripts/meta-ads/informe.mjs --dias 3
//   node scripts/meta-ads/informe.mjs --campana 120249404111380141
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient, loadEnv } from "./lib.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};

const env = loadEnv();
const days = Number(option("dias", 7));
const defaultState = resolve(import.meta.dirname, "campanas/ventas-es-oct2026.state.json");
const campaign = option("campana", JSON.parse(readFileSync(defaultState, "utf8")).campaign);
const meta = createClient(env.META_ADS_TOKEN);

const since = new Date(Date.now() - days * 24 * 3600 * 1000);
const insights = await meta.get(`${campaign}/insights`, {
  level: "ad",
  time_range: { since: since.toISOString().slice(0, 10), until: new Date().toISOString().slice(0, 10) },
  fields: "ad_name,ad_id,spend,impressions,inline_link_clicks,ctr,cpm",
});

const ads = await meta.get(`${campaign}/ads`, { fields: "id,name,creative{url_tags}", limit: 50 });
const utmByAd = Object.fromEntries(
  ads.data.map((ad) => [ad.id, ad.creative?.url_tags?.match(/utm_content=([^&]+)/)?.[1] ?? "?"]),
);

const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/dashboard_stats`, {
  method: "POST",
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ since: since.toISOString() }),
});
const stats = await response.json();
const funnel = Object.fromEntries(
  stats.groups.filter((row) => row.grouping_key === "ad").map((row) => [row.grouping_value, row]),
);

const cop = (value) => `${Math.round(value).toLocaleString("es-CO")} COP`;
const rows = insights.data.map((row) => {
  const utm = utmByAd[row.ad_id];
  const web = funnel[utm] ?? { visits: 0, clicked: 0, sales: 0 };
  const spend = Number(row.spend);
  return {
    anuncio: row.ad_name,
    gasto: cop(spend),
    impresiones: Number(row.impressions),
    "clics enlace": Number(row.inline_link_clicks ?? 0),
    CTR: `${Number(row.ctr ?? 0).toFixed(2)} %`,
    "coste/clic": Number(row.inline_link_clicks ?? 0) ? cop(spend / row.inline_link_clicks) : "–",
    "visitas web": web.visits,
    "tocan Comprar": web.clicked,
    ventas: web.sales,
    "coste/venta": web.sales ? cop(spend / web.sales) : "–",
  };
});

const totalSpend = insights.data.reduce((sum, row) => sum + Number(row.spend), 0);
const totalSales = rows.reduce((sum, row) => sum + row.ventas, 0);

console.log(`\nÚltimos ${days} días · campaña ${campaign}\n`);
console.table(rows);
console.log(`Gasto total: ${cop(totalSpend)} · Ventas: ${totalSales} · Coste por venta: ${totalSales ? cop(totalSpend / totalSales) : "–"}`);
// Lo que llega a Colombia por venta, tras IVA, Lemon y cambio a dólares (estimación del dueño).
console.log("Equilibrio ≈ 78.000 COP por venta (lo que llega neto) · Objetivo < 50.000 COP\n");
