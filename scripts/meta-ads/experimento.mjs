#!/usr/bin/env node
// Experimento de oct 2026: dos conjuntos a la vez con los mismos anuncios y el mismo dinero.
// Estricto (hombres 35-64 con intereses, todo obligatorio) frente a Libre (Advantage+: Meta
// elige, con piso de 25 años y lo demás como sugerencia). Compara lo que Meta cobra y a quién
// elige con lo que esa gente hace en la página, por grupo y por ubicación.
//
//   node scripts/meta-ads/experimento.mjs
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient, loadEnv } from "./lib.mjs";

const statePath = resolve(import.meta.dirname, "campanas/ventas-es-oct2026.state.json");
const state = JSON.parse(readFileSync(statePath, "utf8"));
const { inicio, adSetLibre } = state.experimento;
const env = loadEnv();
const meta = createClient(env.META_ADS_TOKEN);

const groups = { [state.adSet]: "Estricto", [adSetLibre]: "Libre" };
const bogota = (time) => new Date(Date.parse(time) - 5 * 3600 * 1000).toISOString().slice(0, 10);
const range = { since: bogota(inicio), until: bogota(new Date().toISOString()) };
const cop = (value) => (value ? Math.round(value).toLocaleString("es-CO") : "–");
const pct = (part, total) => (total ? `${Math.round((100 * part) / total)} %` : "–");
const action = (row, type) => Number(row.actions?.find((a) => a.action_type === type)?.value ?? 0);
const checkouts = (row) => action(row, "offsite_conversion.fb_pixel_initiate_checkout");

// El día del cambio el Estricto ya llevaba gasto de antes: solo cuenta desde la hora de inicio
// (hora de Bogotá, como la cuenta).
const startHour = new Date(Date.parse(inicio) - 5 * 3600 * 1000).getUTCHours();
const afterStart = (row) =>
  row.date_start > range.since ||
  Number(row.hourly_stats_aggregated_by_advertiser_time_zone.slice(0, 2)) >= startHour;

// 1. Lo que cobra Meta en cada grupo.
const hourly = (
  await meta.get(`${state.campaign}/insights`, {
    level: "adset",
    time_range: range,
    time_increment: 1,
    breakdowns: "hourly_stats_aggregated_by_advertiser_time_zone",
    fields: "adset_id,spend,impressions,inline_link_clicks,actions",
    limit: 1000,
  })
).data.filter(afterStart);
const totals = {};
for (const row of hourly) {
  const entry = (totals[groups[row.adset_id]] ??= { gasto: 0, impresiones: 0, clics: 0, pagos: 0 });
  entry.gasto += Number(row.spend);
  entry.impresiones += Number(row.impressions);
  entry.clics += Number(row.inline_link_clicks ?? 0);
  entry.pagos += checkouts(row);
}

// 2. Lo que hace en la página la gente de cada grupo (utm_term = nombre del conjunto).
const supabase = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
async function rows(query) {
  const all = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${query}&limit=1000&offset=${offset}`, { headers: supabase });
    const page = await response.json();
    all.push(...page);
    if (page.length < 1000) return all;
  }
}
const robots = /meta-externalads|facebookexternalhit|facebot|bot\b|crawler|spider|HeadlessChrome/i;
const events = (
  await rows(
    `page_events?select=session_id,visitor_id,name,depth,seconds,visible_seconds,loaded_hidden,cta,ad_group,placement,user_agent,created_at&created_at=gte.${inicio}&order=created_at.asc`,
  )
).filter((event) => !robots.test(event.user_agent ?? ""));
const orders = await rows(`orders?select=session_id,created_at&created_at=gte.${inicio}&refund_requested_at=is.null`);
const bought = new Set(orders.map((order) => order.session_id));

const sessions = new Map();
for (const event of events) {
  const session = sessions.get(event.session_id) ?? {
    group: null, placement: null, visitor: event.visitor_id, depth: 0, video: false, buy: false,
    hidden: null, visible: null, sections: new Set(),
  };
  session.group ||= event.ad_group;
  session.placement ||= event.placement;
  session.depth = Math.max(session.depth, event.depth ?? 0);
  if (event.name === "video_progress" && event.depth >= 50) session.video = true;
  if (event.name === "cta_click") session.buy = true;
  if (event.name === "page_view") session.hidden = event.loaded_hidden;
  if (event.name === "leave") session.visible = event.visible_seconds;
  if (event.name === "section_view") session.sections.add(event.cta);
  sessions.set(event.session_id, session);
}
const visits = [...sessions.entries()].filter(([, session]) => session.group).map(([id, session]) => ({ id, ...session }));
const reads = (visit) => visit.depth >= 50 || visit.video;

function funnel(list, spend) {
  const people = new Set(list.map((visit) => visit.visitor));
  const readers = list.filter(reads).length;
  const seen = list.filter((visit) => visit.visible != null);
  return {
    visitas: list.length,
    personas: people.size,
    "cargó oculta": pct(list.filter((visit) => visit.hidden).length, list.length),
    "0 s a la vista": pct(seen.filter((visit) => visit.visible === 0).length, seen.length),
    leen: readers,
    "% leen": pct(readers, list.length),
    "ven precio final": list.filter((visit) => visit.sections.has("comprar")).length,
    "tocan Comprar": list.filter((visit) => visit.buy).length,
    ventas: list.filter((visit) => bought.has(visit.id)).length,
    ...(spend != null ? { "COP por lector": readers ? cop(spend / readers) : "–" } : {}),
  };
}

console.log(`\nExperimento Estricto vs Libre · desde ${inicio}\n`);
console.log("1. Meta y página, por grupo");
console.table(
  Object.fromEntries(
    ["Estricto", "Libre"].map((group) => {
      const meta = totals[group] ?? { gasto: 0, impresiones: 0, clics: 0, pagos: 0 };
      return [
        group,
        {
          gasto: cop(meta.gasto),
          CPM: cop((meta.gasto / meta.impresiones) * 1000),
          clics: meta.clics,
          "COP/clic": cop(meta.gasto / meta.clics),
          ...funnel(visits.filter((visit) => visit.group === group), meta.gasto),
        },
      ];
    }),
  ),
);

// 3. A quién elige Meta en cada grupo (en el Libre puede salirse de la sugerencia).
async function byAudience(breakdowns, label) {
  const result = await meta.get(`${state.campaign}/insights`, {
    level: "adset",
    time_range: range,
    breakdowns,
    fields: "adset_id,spend,inline_link_clicks,actions",
    limit: 500,
  });
  for (const group of ["Estricto", "Libre"]) {
    const list = result.data.filter((row) => groups[row.adset_id] === group);
    const total = list.reduce((sum, row) => sum + Number(row.spend), 0);
    console.log(`   ${group}: ` + list
      .sort((a, b) => b.spend - a.spend)
      .filter((row) => Number(row.spend) > 0)
      .map((row) => `${label(row)} ${pct(Number(row.spend), total)} (${row.inline_link_clicks ?? 0} clics, ${checkouts(row)} pagos)`)
      .join(" · "));
  }
}
console.log("2. A quién le muestra Meta (incluye la mañana del cambio en el Estricto)");
await byAudience(["gender"], (row) => row.gender);
await byAudience(["age"], (row) => row.age);

// 4. Ubicación: qué trae gente que lee y no solo clics.
console.log("\n3. Por ubicación (página)");
const placements = [...new Set(visits.map((visit) => `${visit.group} · ${visit.placement ?? "?"}`))].sort();
console.table(
  Object.fromEntries(
    placements.map((key) => [key, funnel(visits.filter((visit) => `${visit.group} · ${visit.placement ?? "?"}` === key))]),
  ),
);
