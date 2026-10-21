# Guía de marca

`guia-de-marca-choco-bachata.pdf` es la guía para quien hace las imágenes (anuncios, carruseles,
historias). Los colores y las letras salen de `src/app/globals.css` y `src/app/layout.tsx`; la
plantilla, del carrusel que más vende (`ejemplo-anuncio.jpeg`).

Si cambia la landing, actualiza `guia-de-marca.html` y vuelve a generar el PDF:

```sh
cd docs/marca
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-pdf-header-footer \
  --virtual-time-budget=15000 --print-to-pdf="$PWD/guia-de-marca-choco-bachata.pdf" "file://$PWD/guia-de-marca.html"
```

`logo-choco-bachata.png` e `isotipo-cb.png` (recortado del logo) van junto al PDF para que no
tenga que buscarlos.
