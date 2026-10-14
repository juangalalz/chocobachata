// Utilidades compartidas para los scripts de Meta Ads. Sin dependencias: Node 20+.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, resolve } from "node:path";

export const GRAPH = "https://graph.facebook.com/v24.0";

// Mejoras de Advantage+ que Meta acepta en creative_features_spec (probado en oct 2026).
// "music" y "hd_video" no existen; standard_enhancements está retirado.
export const ALL_FEATURES = [
  "image_touchups", "inline_comment", "text_optimizations", "video_auto_crop", "enhance_cta",
  "adapt_to_placement", "image_templates", "image_brightness_and_contrast", "description_automation",
  "add_text_overlay", "site_extensions", "text_translation", "image_uncrop", "reveal_details_over_time",
  "show_summary", "show_destination_blurbs", "media_type_automation", "ig_video_native_subtitle",
  "image_animation", "profile_card", "text_overlay_translation", "local_store_extension",
  "multi_photo_to_video", "video_highlight", "cv_transformation", "video_filtering",
];

// Mejoras que no cambian el diseño ni el orden: las únicas que dejamos en un carrusel.
export const SAFE_FEATURES = [
  "image_touchups", "image_brightness_and_contrast", "text_optimizations", "enhance_cta",
  "inline_comment", "adapt_to_placement", "profile_card",
];

// Para anuncios donde Meta puede modificarlo todo (formato flexible de imágenes).
export const IMAGE_FEATURES = [
  ...SAFE_FEATURES, "image_templates", "image_uncrop", "image_animation", "description_automation",
  "add_text_overlay", "reveal_details_over_time", "show_summary", "multi_photo_to_video", "media_type_automation",
];

export function features(status, names) {
  return { creative_features_spec: Object.fromEntries(names.map((name) => [name, { enroll_status: status }])) };
}

// Lee .env.local del proyecto sin interpretar & ni comillas raras.
export function loadEnv() {
  const file = resolve(import.meta.dirname, "../../.env.local");
  const env = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim().replace(/^"|"$/g, "");
  }
  if (!env.META_ADS_TOKEN) throw new Error("Falta META_ADS_TOKEN en .env.local");
  return env;
}

export function expandPath(path) {
  return path.startsWith("~/") ? resolve(homedir(), path.slice(2)) : resolve(path);
}

export function createClient(token, { validate = false } = {}) {
  async function request(method, path, params = {}) {
    const url = new URL(`${GRAPH}/${path}`);
    const body = new URLSearchParams({ access_token: token });
    for (const [key, value] of Object.entries(params)) {
      body.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
    }
    if (method === "GET") {
      for (const [key, value] of body) url.searchParams.set(key, value);
    }

    const response = await fetch(url, method === "GET" ? {} : { method, body });
    const data = await response.json();
    if (data.error) {
      const detail = data.error.error_user_msg || data.error.message;
      throw new Error(`Meta (${path}): ${detail}`);
    }
    return data;
  }

  return {
    get: (path, params) => request("GET", path, params),
    // En modo validar, Meta revisa todo pero no crea nada.
    create: (path, params) =>
      request("POST", path, validate ? { ...params, execution_options: ["validate_only"] } : params),
    update: (path, params) => request("POST", path, params),

    async upload(account, kind, file) {
      const form = new FormData();
      form.set("access_token", token);
      const blob = new Blob([readFileSync(file)]);
      if (kind === "image") {
        form.set("filename", blob, basename(file));
      } else {
        form.set("name", basename(file));
        form.set("source", blob, basename(file));
      }
      const response = await fetch(`${GRAPH}/${account}/${kind === "image" ? "adimages" : "advideos"}`, {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (data.error) throw new Error(`Meta (subir ${basename(file)}): ${data.error.message}`);
      return kind === "image" ? Object.values(data.images)[0].hash : data.id;
    },
  };
}

// El estado guarda lo ya creado para que volver a ejecutar continúe en vez de duplicar.
export function stateFile(configPath) {
  const path = configPath.replace(/\.json$/, ".state.json");
  const state = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { media: {} };
  return {
    state,
    save: () => writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`),
  };
}

export function sleep(ms) {
  return new Promise((done) => setTimeout(done, ms));
}
