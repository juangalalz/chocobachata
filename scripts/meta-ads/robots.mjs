#!/usr/bin/env node
// Robots que entran a la página: cuántos, cuándo y qué hacen. Sirve para saber si el revisor
// de Meta solo entra al crear o editar anuncios, o si vuelve por su cuenta, y si sus visitas
// se parecen a las de las personas (las "de 30 segundos sin mirar nada").
//
//   node scripts/meta-ads/robots.mjs              últimos 14 días
//   node scripts/meta-ads/robots.mjs --dias 3
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient, loadEnv } from "./lib.mjs";

const args = process.argv.slice(2);
const days = Number(args[args.indexOf("--dias") + 1] || 14);
const state = JSON.parse(readFileSync(resolve(import.meta.dirname, "campanas/ventas-es-oct2026.state.json"), "utf8"));
const env = loadEnv();
const meta = createClient(env.META_ADS_TOKEN);

const since = new Date(Date.now() - days * 86400 * 1000).toISOString();
const bogota = (time) => new Date(Date.parse(time) - 5 * 3600 * 1000).toISOString().replace("T", " ").slice(0, 16);
const pct = (part, total) => (total ? `${Math.round((100 * part) / total)} %` : "–");

const supabase = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
const events = [];
for (let offset = 0; ; offset += 1000) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/robot_events?select=*&created_at=gte.${since}&order=created_at.asc&limit=1000&offset=${offset}`,
    { headers: supabase },
  );
  const page = await response.json();
  events.push(...page);
  if (page.length < 1000) break;
}
if (!events.length) {
  console.log(`\nSin robots en los últimos ${days} días (se guardan desde el 28 oct 2026).\n`);
  process.exit(0);
}

const sessions = new Map();
for (const event of events) {
  const session = sessions.get(event.session_id) ?? {
    at: event.created_at, reason: event.reason, ad: null, group: null, placement: null, ip: event.client_ip,
    agent: event.user_agent ?? "", fbclid: false, hidden: null, visible: null, seconds: null, depth: 0,
    video: 0, sections: new Set(), buttons: [],
  };
  session.ad ||= event.utm_content;
  session.group ||= event.ad_group;
  session.placement ||= event.placement;
  session.fbclid ||= event.has_fbclid;
  session.depth = Math.max(session.depth, event.depth ?? 0);
  if (event.name === "page_view") session.hidden = event.loaded_hidden;
  if (event.name === "leave") [session.visible, session.seconds] = [event.visible_seconds, event.seconds];
  if (event.name === "video_progress") session.video = Math.max(session.video, event.depth ?? 0);
  if (event.name === "section_view") session.sections.add(event.cta);
  if (event.name === "cta_click") session.buttons.push(event.cta);
  sessions.set(event.session_id, session);
}
const list = [...sessions.values()];

// 1. Ráfagas: visitas a menos de 10 minutos unas de otras. ¿Coinciden con cambios en los anuncios?
const ads = await meta.get(`${state.campaign}/ads`, { fields: "name,created_time,updated_time", limit: 100 });
const changes = ads.data.flatMap((ad) => [
  { at: ad.created_time, what: `creado ${ad.name}` },
  ...(ad.updated_time !== ad.created_time ? [{ at: ad.updated_time, what: `editado ${ad.name}` }] : []),
]);
const bursts = [];
for (const session of list) {
  const last = bursts.at(-1);
  if (last && Date.parse(session.at) - Date.parse(last.end) < 10 * 60 * 1000) {
    last.end = session.at;
    last.sessions.push(session);
  } else {
    bursts.push({ start: session.at, end: session.at, sessions: [session] });
  }
}
console.log(`\nRobots · últimos ${days} días · ${list.length} visitas, ${events.length} eventos\n`);
console.log("1. Ráfagas (hora de Bogotá)");
console.table(
  bursts.map((burst) => {
    const before = changes.filter((change) => {
      const gap = Date.parse(burst.start) - Date.parse(change.at);
      return gap >= -60 * 1000 && gap < 30 * 60 * 1000;
    });
    return {
      inicio: bogota(burst.start),
      minutos: Math.round((Date.parse(burst.end) - Date.parse(burst.start)) / 60000),
      visitas: burst.sessions.length,
      motivo: [...new Set(burst.sessions.map((session) => session.reason))].join(","),
      "tocan Comprar": burst.sessions.filter((session) => session.buttons.length).length,
      "¿tras un cambio?": before.length ? `sí (${before.length} cambios en anuncios)` : "no: entró solo",
    };
  }),
);

// 2. Qué hacen: comparar con las visitas de personas que "duran 30 s sin mirar".
console.log("2. Qué hacen");
const left = list.filter((session) => session.seconds != null);
console.table({
  robots: {
    "con fbclid": pct(list.filter((session) => session.fbclid).length, list.length),
    "cargan ocultas": pct(list.filter((session) => session.hidden).length, list.length),
    "0 s a la vista": pct(left.filter((session) => session.visible === 0).length, left.length),
    "salen a 29–34 s": pct(left.filter((session) => session.seconds >= 29 && session.seconds <= 34).length, left.length),
    "bajan hasta el final": pct(list.filter((session) => session.depth >= 100).length, list.length),
    "ven video": pct(list.filter((session) => session.video > 0).length, list.length),
    "ven secciones": pct(list.filter((session) => session.sections.size).length, list.length),
    "tocan Comprar": pct(list.filter((session) => session.buttons.length).length, list.length),
  },
});

// 3. De dónde vienen y cómo se presentan.
const count = (values) =>
  Object.entries(values.reduce((all, value) => ({ ...all, [value]: (all[value] ?? 0) + 1 }), {}))
    .sort((a, b) => b[1] - a[1])
    .map(([value, total]) => `${value} (${total})`)
    .join(" · ");
const agent = (text) =>
  /meta-externalads|facebookexternalhit|facebot/i.test(text) ? "se declara Meta"
    : /iPhone/.test(text) ? (/Instagram|FBAN|FBAV/.test(text) ? "iPhone app Meta" : "iPhone Safari")
    : /Android/.test(text) ? (/Instagram|FBAN|FBAV/.test(text) ? "Android app Meta" : "Android Chrome")
    : /Windows|Macintosh/.test(text) ? "ordenador" : "otro";
console.log("3. Cómo llegan");
console.log(`   motivo: ${count(list.map((session) => session.reason))}`);
console.log(`   se presentan como: ${count(list.map((session) => agent(session.agent)))}`);
console.log(`   red: ${count(list.map((session) => session.ip?.split(/[.:]/).slice(0, 2).join(".") ?? "?"))}`);
console.log(`   anuncio: ${count(list.map((session) => session.ad ?? "sin anuncio"))}`);
console.log(`   grupo: ${count(list.map((session) => session.group ?? "–"))} · ubicación: ${count(list.map((session) => session.placement ?? "–"))}`);
console.log(`   botón de Comprar: ${count(list.flatMap((session) => session.buttons)) || "ninguno"}\n`);
