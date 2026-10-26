#!/usr/bin/env node
// Dónde gasta Meta sin aportar al embudo. Cruza el gasto de Meta con lo que la gente hace en
// la página, y revisa que la configuración del conjunto no haya cambiado sin pedirlo.
//
//   node scripts/meta-ads/fugas.mjs              últimos 7 días
//   node scripts/meta-ads/fugas.mjs --dias 14
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient, loadEnv } from "./lib.mjs";

const args = process.argv.slice(2);
const days = Number(args[args.indexOf("--dias") + 1] || 7);
const configPath = resolve(import.meta.dirname, "campanas/ventas-es-oct2026.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const state = JSON.parse(readFileSync(configPath.replace(/\.json$/, ".state.json"), "utf8"));
const env = loadEnv();
const meta = createClient(env.META_ADS_TOKEN);

// Los días van en hora de Bogotá, como la cuenta de Meta.
const bogota = (time) => new Date(Date.parse(time) - 5 * 3600 * 1000).toISOString().slice(0, 10);
const until = bogota(new Date().toISOString());
const since = bogota(new Date(Date.now() - (days - 1) * 86400 * 1000).toISOString());
const cop = (value) => `${Math.round(value).toLocaleString("es-CO")}`;
const pct = (part, total) => (total ? `${Math.round((100 * part) / total)} %` : "–");
const checkouts = (row) =>
  Number(row.actions?.find((a) => a.action_type === "offsite_conversion.fb_pixel_initiate_checkout")?.value ?? 0);

// Eventos de la página (paginado: la API devuelve como mucho 1.000 filas).
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
  await rows("page_events?select=name,depth,utm_content,session_id,visitor_id,fbp,user_agent,created_at&order=created_at.asc")
).filter((event) => !robots.test(event.user_agent ?? ""));

// Una persona = mismo navegador: une sesión, identificador propio y cookie _fbp.
const parent = new Map();
const find = (key) => {
  while (parent.get(key) !== key) key = parent.get(key);
  return key;
};
for (const event of events) {
  const keys = [`s:${event.session_id}`, event.visitor_id && `v:${event.visitor_id}`, event.fbp && `f:${event.fbp}`].filter(Boolean);
  for (const key of keys) if (!parent.has(key)) parent.set(key, key);
  for (const key of keys.slice(1)) parent.set(find(key), find(keys[0]));
}

const sessions = new Map();
for (const event of events) {
  const session = sessions.get(event.session_id) ?? { at: event.created_at, ad: null, depth: 0, video: false, buy: false };
  session.ad ||= event.utm_content;
  session.depth = Math.max(session.depth, event.depth ?? 0);
  if (event.name === "video_progress" && event.depth === 100) session.video = true;
  if (event.name === "cta_click") session.buy = true;
  sessions.set(event.session_id, session);
}
const visits = [...sessions.entries()]
  .filter(([, session]) => session.ad)
  .map(([id, session]) => ({ ...session, person: find(`s:${id}`), day: bogota(session.at) }))
  .sort((a, b) => a.at.localeCompare(b.at));

// Visita número N de cada persona, contando desde su primera visita de siempre.
const count = new Map();
for (const visit of visits) {
  visit.number = (count.get(visit.person) ?? 0) + 1;
  count.set(visit.person, visit.number);
}
const inRange = visits.filter((visit) => visit.day >= since);
const reads = (visit) => visit.depth >= 50 || visit.video;

// 1. Gasto por día frente a gente nueva que lee: el indicador que se mueve antes que las ventas.
const daily = await meta.get(`${state.campaign}/insights`, {
  time_range: { since, until },
  time_increment: 1,
  fields: "spend,inline_link_clicks,actions",
});
console.log(`\nFugas · ${since} a ${until} (hora de Bogotá)\n`);
console.log("1. Costo por persona nueva que lee la mitad de la página o más");
console.table(
  daily.data.map((row) => {
    const today = inRange.filter((visit) => visit.day === row.date_start);
    const fresh = today.filter((visit) => visit.number === 1);
    const readers = fresh.filter(reads).length;
    return {
      día: row.date_start.slice(5),
      gasto: cop(row.spend),
      "clics Meta": Number(row.inline_link_clicks ?? 0),
      visitas: today.length,
      nuevas: fresh.length,
      "nuevas que leen": readers,
      "COP por lector": readers ? cop(row.spend / readers) : "–",
      "tocan Comprar": today.filter((visit) => visit.buy).length,
    };
  }),
);

// 2. Personas que tocan el anuncio una y otra vez sin leer.
const perPerson = new Map();
for (const visit of inRange) perPerson.set(visit.person, [...(perPerson.get(visit.person) ?? []), visit]);
const repeaters = [...perPerson.values()].filter((list) => list.length >= 4);
const repeatVisits = repeaters.reduce((sum, list) => sum + list.length, 0);
console.log(
  `2. Repetidores: ${repeaters.length} personas con 4+ visitas suman ${repeatVisits} de ${inRange.length} visitas (${pct(repeatVisits, inRange.length)}).` +
    ` Leyeron en alguna: ${repeaters.filter((list) => list.some(reads)).length}.`,
);
console.log(`   Visitas de gente que ya había venido: ${pct(inRange.filter((visit) => visit.number > 1).length, inRange.length)}.\n`);

// 3. Dónde reparte Meta el gasto: lo que no trae clics ni inicios de pago es fuga.
async function breakdown(title, column, breakdowns, label) {
  const result = await meta.get(`${state.campaign}/insights`, {
    time_range: { since, until },
    breakdowns,
    fields: "spend,inline_link_clicks,actions",
    limit: 500,
  });
  const total = result.data.reduce((sum, row) => sum + Number(row.spend), 0);
  console.log(title);
  console.table(
    result.data
      .sort((a, b) => b.spend - a.spend)
      .map((row) => ({
        [column]: label(row),
        gasto: cop(row.spend),
        "% gasto": pct(Number(row.spend), total),
        clics: Number(row.inline_link_clicks ?? 0),
        "inicios de pago": checkouts(row),
      })),
  );
}
await breakdown("3. Por género y edad", "público", ["gender", "age"], (row) => `${row.gender} ${row.age}`);
await breakdown("4. Por ubicación", "ubicación", ["publisher_platform", "platform_position"], (row) => `${row.publisher_platform}/${row.platform_position}`);

// La hora de la cuenta es la de Bogotá; España va 6 horas por delante (7 en verano).
const hourly = await meta.get(`${state.campaign}/insights`, {
  time_range: { since, until },
  breakdowns: "hourly_stats_aggregated_by_advertiser_time_zone",
  fields: "spend,inline_link_clicks,actions",
});
const blocks = {};
for (const row of hourly.data) {
  const spain = (Number(row.hourly_stats_aggregated_by_advertiser_time_zone.slice(0, 2)) + 6) % 24;
  const block = `${String(spain - (spain % 3)).padStart(2, "0")}–${String(spain - (spain % 3) + 2).padStart(2, "0")} h`;
  const entry = (blocks[block] ??= { gasto: 0, clics: 0, "inicios de pago": 0 });
  entry.gasto += Number(row.spend);
  entry.clics += Number(row.inline_link_clicks ?? 0);
  entry["inicios de pago"] += checkouts(row);
}
console.log("5. Por hora de España (aprox.)");
console.table(
  Object.entries(blocks)
    .sort()
    .map(([hora, entry]) => ({ hora, ...entry, gasto: cop(entry.gasto) })),
);

// 6. Que nadie haya cambiado la configuración sin pedirlo (el Administrador reactiva cosas).
const { targeting } = await meta.get(state.adSet, { fields: "targeting" });
const expected = config.adSet.targeting;
const same = (a, b) => JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort());
const checks = [
  ["edad", `${targeting.age_min}–${targeting.age_max}`, `${expected.ageMin}–${expected.ageMax ?? 65}`],
  ["género", targeting.genders?.join(",") ?? "todos", expected.genders?.join(",") ?? "todos"],
  ["Advantage+ público", targeting.targeting_automation?.advantage_audience ? "sí" : "no", expected.advantageAudience === false ? "no" : "sí"],
  ["dispositivos", targeting.device_platforms?.join(",") ?? "todos", expected.devices?.join(",") ?? "todos"],
  ["plataformas", targeting.publisher_platforms?.join(",") ?? "automáticas", expected.placements?.publisher_platforms?.join(",") ?? "automáticas"],
];
const excluded = targeting.excluded_custom_audiences?.map((audience) => audience.id) ?? [];
const missing = (expected.excludedAudiences ?? []).filter(([id]) => !excluded.includes(id));
console.log("6. Configuración del conjunto frente a la acordada");
for (const [name, actual, wanted] of checks) {
  const ok = name === "plataformas" || name === "dispositivos" ? same(actual.split(","), wanted.split(",")) : actual === wanted;
  console.log(`   ${ok ? "✓" : "✗"} ${name}: ${actual}${ok ? "" : ` (acordado: ${wanted})`}`);
}
console.log(missing.length ? `   ✗ Faltan exclusiones: ${missing.map(([, name]) => name).join(", ")}` : "   ✓ exclusiones");
console.log("");
