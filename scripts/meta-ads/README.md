# Scripts de Meta Ads

Los anuncios se crean con la API de Meta en lugar de hacerlo a mano en el Administrador. Todo
lo que aprendimos montando la primera campaña ya está aquí, para no repetirlo.

Necesitan `META_ADS_TOKEN` en `.env.local`: un token de usuario del sistema que no caduca, con
`ads_management`, `ads_read`, `business_management`, `pages_read_engagement` y `pages_manage_ads`. `informe.mjs` además usa
`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.

## Crear una campaña nueva

1. Copia `campanas/ventas-es-oct2026.json` con otro nombre (p. ej. `ventas-mx-dic2026.json`)
   y cambia país, presupuesto, textos y archivos. El presupuesto va en COP al día.
2. Compruébala sin crear nada: `node scripts/meta-ads/crear-campana.mjs campanas/... --validar`.
   Los videos tienen que estar subidos ya para validar: súbelos con una ejecución normal.
3. Créala: `node scripts/meta-ads/crear-campana.mjs scripts/meta-ads/campanas/ventas-mx-dic2026.json`.
   Todo queda en pausa. Revísalo en el Administrador y actívalo con `estado.mjs`.

Si algo falla a mitad, arregla el JSON y vuelve a ejecutarlo: el `.state.json` guarda lo ya
creado y lo ya subido, así que continúa sin duplicar.

Tipos de anuncio:

- `video`: el video tal cual. Desactiva todas las mejoras de IA (subtítulos, música, recortes…).
- `carousel`: tarjetas en el orden del JSON. Meta no las reordena ni añade tarjeta final.
- `flexible`: varias imágenes, textos y títulos. Meta combina y modifica todo lo que quiera.

## Día a día

- `node scripts/meta-ads/informe.mjs --dias 3`: gasto, clics y coste por venta de cada anuncio,
  con las ventas reales de la web (no las que se atribuye Meta). Al final, venta a venta: cuánto
  se gastó entre una y la siguiente, para ver si el coste por venta baja.
- `node scripts/meta-ads/estado.mjs pausar <id>` · `activar <id...>` · `presupuesto <id> <COP>`.

## Cosas de Meta que costó descubrir

- La app de Meta tiene que estar en modo público para crear anuncios, y eso exige una URL de
  política de privacidad (`/privacidad`).
- Los creativos no se pueden editar: para cambiar un texto hay que crear creativo y anuncio
  nuevos y borrar el viejo (se pierde el historial de ese anuncio).
- El formato flexible exige `link_data.link` aunque los enlaces vayan en `asset_feed_spec`.
- En `creative_features_spec` no existen `music` ni `hd_video`; la lista válida está en `lib.mjs`.
- Para anunciarse en la UE el conjunto necesita `dsa_beneficiary` y `dsa_payor`.
- Algunos intereses desaparecen (p. ej. Kizomba): si Meta rechaza el conjunto, quita el interés.
- Cada anuncio lleva `utm_content` propio: así el tablero (`/tablero`) sabe qué anuncio trajo
  cada visita y cada venta.
