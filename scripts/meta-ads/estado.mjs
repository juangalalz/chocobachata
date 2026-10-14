#!/usr/bin/env node
// Activa, pausa o cambia el presupuesto diario de campañas, conjuntos o anuncios.
//
//   node scripts/meta-ads/estado.mjs activar 120249404111380141 120249404115160141
//   node scripts/meta-ads/estado.mjs pausar 120249404590630141
//   node scripts/meta-ads/estado.mjs presupuesto 120249404111380141 50000
import { createClient, loadEnv } from "./lib.mjs";

const [action, ...ids] = process.argv.slice(2);
const meta = createClient(loadEnv().META_ADS_TOKEN);

if (action === "presupuesto") {
  const [id, amount] = ids;
  await meta.update(id, { daily_budget: Number(amount) });
  const { name, daily_budget } = await meta.get(id, { fields: "name,daily_budget" });
  console.log(`${name}: ${Number(daily_budget).toLocaleString("es-CO")} COP al día`);
} else if (action === "activar" || action === "pausar") {
  for (const id of ids) {
    await meta.update(id, { status: action === "activar" ? "ACTIVE" : "PAUSED" });
    const { name, effective_status } = await meta.get(id, { fields: "name,effective_status" });
    console.log(`${name}: ${effective_status}`);
  }
} else {
  console.error("Uso: estado.mjs activar|pausar <id...>  ·  estado.mjs presupuesto <id> <COP>");
  process.exit(1);
}
