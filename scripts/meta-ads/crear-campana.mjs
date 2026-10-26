#!/usr/bin/env node
// Crea una campaña completa (campaña, conjunto y anuncios) a partir de un JSON. Todo queda
// DESACTIVADO para revisarlo en el Administrador de anuncios antes de publicar.
//
//   node scripts/meta-ads/crear-campana.mjs scripts/meta-ads/campanas/ventas-es-oct2026.json
//   node scripts/meta-ads/crear-campana.mjs <config> --validar   (Meta revisa, no crea nada)
//
// Si algo falla a mitad, vuelve a ejecutarlo: el .state.json recuerda lo ya creado.
import { readFileSync } from "node:fs";

import {
  ALL_FEATURES, IMAGE_FEATURES, SAFE_FEATURES, createClient, expandPath, features, loadEnv, sleep, stateFile,
} from "./lib.mjs";

const [configPath, flag] = process.argv.slice(2);
if (!configPath) {
  console.error("Uso: node scripts/meta-ads/crear-campana.mjs <config.json> [--validar]");
  process.exit(1);
}

const validate = flag === "--validar";
const config = JSON.parse(readFileSync(configPath, "utf8"));
const meta = createClient(loadEnv().META_ADS_TOKEN, { validate });
const { state, save } = stateFile(configPath);
const { account, page, instagram, pixel, link } = config.identity;

function urlTags(content) {
  return `utm_source=meta&utm_medium=paid&utm_campaign=${config.utmCampaign}&utm_content=${content}`;
}

async function media(kind, path) {
  if (!state.media[path]) {
    if (validate && kind === "video") {
      throw new Error(`En modo validar el video tiene que estar subido ya: ${path}`);
    }
    console.log(`Subiendo ${path}…`);
    state.media[path] = await meta.upload(account, kind, expandPath(path));
    save();
  }
  return state.media[path];
}

async function videoThumbnail(videoId) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const video = await meta.get(videoId, { fields: "status,thumbnails{uri,is_preferred}" });
    const thumb = video.thumbnails?.data?.find((item) => item.is_preferred);
    if (video.status?.video_status === "ready" && thumb) return thumb.uri;
    await sleep(5000);
  }
  throw new Error(`El video ${videoId} no terminó de procesarse`);
}

const cta = (type) => ({ type: type ?? "SHOP_NOW", value: { link } });

async function creativeFor(ad) {
  const base = {
    name: `CR_${ad.utmContent}`,
    url_tags: urlTags(ad.utmContent),
  };

  if (ad.type === "video") {
    const videoId = await media("video", ad.video);
    return {
      ...base,
      object_story_spec: {
        page_id: page,
        instagram_user_id: instagram,
        video_data: {
          video_id: videoId,
          image_url: await videoThumbnail(videoId),
          message: ad.text,
          title: ad.title,
          ...(ad.description ? { link_description: ad.description } : {}),
          call_to_action: cta(ad.cta),
        },
      },
      // Videos tal cual: sin ninguna mejora de IA ni anuncios de otros anunciantes al lado.
      degrees_of_freedom_spec: features("OPT_OUT", ALL_FEATURES),
      contextual_multi_ads: { enroll_status: "OPT_OUT" },
    };
  }

  if (ad.type === "carousel") {
    const cards = [];
    for (const card of ad.cards) {
      cards.push({
        image_hash: await media("image", card.image),
        link,
        name: card.title,
        description: card.description,
        call_to_action: cta(ad.cta),
      });
    }
    return {
      ...base,
      object_story_spec: {
        page_id: page,
        instagram_user_id: instagram,
        link_data: {
          link,
          message: ad.text,
          // Las tarjetas cuentan una historia: Meta no las reordena ni añade tarjeta final.
          multi_share_optimized: false,
          multi_share_end_card: false,
          call_to_action: cta(ad.cta),
          child_attachments: cards,
        },
      },
      degrees_of_freedom_spec: features("OPT_IN", SAFE_FEATURES),
    };
  }

  if (ad.type === "flexible") {
    const images = [];
    for (const image of ad.images) images.push({ hash: await media("image", image) });
    return {
      ...base,
      // Con DEGREES_OF_FREEDOM Meta exige el enlace también en link_data.
      object_story_spec: { page_id: page, instagram_user_id: instagram, link_data: { link } },
      asset_feed_spec: {
        images,
        bodies: ad.texts.map((text) => ({ text })),
        titles: ad.titles.map((text) => ({ text })),
        descriptions: (ad.descriptions ?? []).map((text) => ({ text })),
        link_urls: [{ website_url: link }],
        call_to_action_types: [ad.cta ?? "SHOP_NOW"],
        ad_formats: ["AUTOMATIC_FORMAT"],
        optimization_type: "DEGREES_OF_FREEDOM",
      },
      degrees_of_freedom_spec: features("OPT_IN", IMAGE_FEATURES),
    };
  }

  throw new Error(`Tipo de anuncio desconocido: ${ad.type}`);
}

async function main() {
  if (!state.campaign) {
    const result = await meta.create(`${account}/campaigns`, {
      name: config.campaign.name,
      objective: "OUTCOME_SALES",
      status: "PAUSED",
      special_ad_categories: [],
      daily_budget: config.campaign.dailyBudget,
      bid_strategy: config.campaign.bidStrategy ?? "LOWEST_COST_WITHOUT_CAP",
      // Tope total: Meta para sola al llegar, aunque nadie esté mirando.
      ...(config.campaign.spendCap ? { spend_cap: config.campaign.spendCap } : {}),
    });
    if (validate) {
      console.log("✓ Campaña válida");
    } else {
      state.campaign = result.id;
      save();
    }
  }
  console.log("Campaña", state.campaign ?? "(validada)");

  const audience = config.adSet.targeting;
  if (!state.adSet) {
    const params = {
      name: config.adSet.name,
      campaign_id: state.campaign ?? "0",
      status: "PAUSED",
      optimization_goal: "OFFSITE_CONVERSIONS",
      billing_event: "IMPRESSIONS",
      promoted_object: { pixel_id: pixel, custom_event_type: config.adSet.event ?? "PURCHASE" },
      attribution_spec: [
        { event_type: "CLICK_THROUGH", window_days: 7 },
        { event_type: "VIEW_THROUGH", window_days: 1 },
      ],
      targeting: {
        geo_locations: { countries: audience.countries, location_types: ["home", "recent"] },
        age_min: audience.ageMin,
        // En la API, 65 significa "65 o más".
        age_max: audience.ageMax ?? 65,
        ...(audience.genders ? { genders: audience.genders } : {}),
        ...(audience.suggestedAges ? { age_range: audience.suggestedAges } : {}),
        ...(audience.interests?.length
          ? { flexible_spec: [{ interests: audience.interests.map(([id, name]) => ({ id, name })) }] }
          : {}),
        // Fugas de oct 2026: Audience Network y ordenador traían clics sin valor, y
        // compradores y visitantes compulsivos seguían viendo anuncios.
        ...(audience.devices ? { device_platforms: audience.devices } : {}),
        ...(audience.placements ?? {}),
        ...(audience.excludedAudiences?.length
          ? { excluded_custom_audiences: audience.excludedAudiences.map(([id]) => ({ id })) }
          : {}),
        // Con Advantage+ Meta solo acepta la edad como sugerencia y nunca por encima de 25.
        // Sin él, edad e intereses son obligatorios (en oct 2026 los menores de 35 no respondían).
        targeting_automation: { advantage_audience: audience.advantageAudience === false ? 0 : 1 },
      },
      // Obligatorio para anunciarse en la UE (Ley de Servicios Digitales).
      dsa_beneficiary: config.adSet.dsaName,
      dsa_payor: config.adSet.dsaName,
    };
    if (validate && !state.campaign) {
      console.log("· Conjunto: se valida al crear de verdad (necesita la campaña)");
    } else {
      const result = await meta.create(`${account}/adsets`, params);
      if (validate) {
        console.log("✓ Conjunto válido");
      } else {
        state.adSet = result.id;
        save();
      }
    }
  }
  console.log("Conjunto", state.adSet ?? "(validado)");

  state.ads ??= {};
  for (const ad of config.ads) {
    if (state.ads[ad.utmContent]) {
      console.log(`Anuncio ${ad.name}: ya existe (${state.ads[ad.utmContent]})`);
      continue;
    }
    const creative = await meta.create(`${account}/adcreatives`, await creativeFor(ad));
    if (validate) {
      console.log(`✓ Anuncio ${ad.name} válido`);
      continue;
    }
    const created = await meta.create(`${account}/ads`, {
      name: ad.name,
      adset_id: state.adSet,
      creative: { creative_id: creative.id },
      status: "PAUSED",
    });
    state.ads[ad.utmContent] = created.id;
    save();
    console.log(`Anuncio ${ad.name}: ${created.id}`);
  }

  console.log(validate ? "\nTodo válido. Nada creado." : "\nListo. Todo está DESACTIVADO: revísalo y actívalo en el Administrador de anuncios.");
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});
