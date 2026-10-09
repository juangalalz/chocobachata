# Choco Bachata

Landing del curso online. El anuncio abre esta página, el pago lo cobra Lemon Squeezy y los videos siguen en Wix.

- Landing: https://curso.chocobachata.com
- Cursos, después de entrar: https://www.chocobachata.com/my-programs
- Precio: 29,99 €, pago único, IVA incluido, sin caducidad

## Qué pasa cuando alguien paga

1. Pulsa Comprar ahora y Lemon cobra la tarjeta.
2. Lemon avisa a `POST /api/lemon/webhook` con el evento `order_created`.
3. La página crea al alumno en Wix, lo aprueba y lo inscribe en los tres niveles.
4. Salen dos correos de Wix: la bienvenida (al poner la etiqueta `acceso-bachata`) y el de `no-reply@site-members.com` para crear la contraseña. Lemon manda aparte el recibo del cobro.
5. Se avisa a Meta de la compra y el pedido queda en Supabase.

Si Lemon reintenta el aviso, el pedido sigue desde el paso que ya terminó y no repite los correos.

## Variables

Copia `.env.example` a `.env.local`. En Vercel tienen que estar las mismas claves.

| Variable | Para qué |
| --- | --- |
| `NEXT_PUBLIC_CHECKOUT_URL` | Checkout de Lemon |
| `NEXT_PUBLIC_META_PIXEL_ID` | Píxel en el navegador |
| `META_CAPI_TOKEN` | Compras avisadas desde el servidor |
| `META_TEST_EVENT_CODE` | Solo para pruebas de Meta. Vacío en los anuncios reales |
| `SUPABASE_URL` | Visitas y pedidos |
| `SUPABASE_SERVICE_ROLE_KEY` | Escritura en Supabase |
| `LEMON_WEBHOOK_SECRET` | Firma del aviso de pago. Máximo 40 caracteres |
| `WIX_SITE_ID` | Sitio de Choco Bachata |
| `WIX_API_KEY` | Clave de la cuenta de Wix |
| `WIX_PROGRAM_IDS` | Los tres niveles, separados por coma |

El webhook de Lemon apunta a `https://curso.chocobachata.com/api/lemon/webhook` y solo escucha `order_created`.

## Local

```bash
npm install
npm run dev
```

La página queda en http://127.0.0.1:3010.

## Mientras Lemon revisa la tienda

La tienda sigue en modo prueba: el webhook solo reacciona a pagos de prueba y una tarjeta real no completa este flujo. Cuando aprueben la cuenta, se pasa a modo real y el anuncio puede abrir `https://curso.chocobachata.com`.
