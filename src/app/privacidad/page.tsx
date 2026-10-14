import type { Metadata } from "next";
import Link from "next/link";

import { offer } from "@/lib/offer";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Cómo tratamos tus datos en el curso online de Choco Bachata.",
};

const sections = [
  {
    title: "Quién trata tus datos",
    body: [
      `Choco Bachata es responsable de los datos que se recogen en esta página. Para cualquier consulta sobre privacidad, escríbenos a ${offer.email}.`,
    ],
  },
  {
    title: "Qué datos recogemos",
    body: [
      "Al visitar la página: un identificador de sesión, las páginas que ves, hasta dónde haces scroll y cuánto tiempo te quedas. Si llegas desde un anuncio de Meta, también el identificador del clic (fbclid) y las cookies de Meta _fbp y _fbc.",
      "Al pulsar el botón de compra: tu dirección IP y el navegador que usas (user agent).",
      "Al comprar: tu nombre, tu correo y el importe del pedido, que nos envía la plataforma de pagos. Nunca vemos ni guardamos los datos de tu tarjeta.",
    ],
  },
  {
    title: "Para qué los usamos",
    body: [
      "Para darte acceso al curso: con tu nombre y correo creamos tu cuenta en la plataforma de clases y te enviamos los correos de bienvenida y de acceso.",
      "Para medir y mejorar nuestros anuncios: enviamos a Meta los eventos de visita, inicio de compra y compra, junto con tu correo y nombre cifrados (hash SHA-256), tu IP, tu navegador y los identificadores de Meta. Así Meta puede saber qué anuncios funcionan, sin que nosotros compartamos tus datos en claro.",
      "Para entender cómo se usa la página y mejorarla.",
    ],
  },
  {
    title: "Base legal",
    body: [
      "Los datos de la compra se tratan para cumplir el contrato del curso. La medición de anuncios y el análisis de la página se basan en nuestro interés legítimo en dar a conocer el curso, y puedes oponerte en cualquier momento.",
    ],
  },
  {
    title: "Con quién los compartimos",
    body: [
      "Lemon Squeezy (empresa de Stripe), que procesa el pago como vendedor registrado y trata tus datos de pago bajo su propia política de privacidad.",
      "Wix, donde está la plataforma de clases y tu cuenta de alumno.",
      "Meta Platforms, para la medición de anuncios descrita arriba.",
      "Supabase y Vercel, que alojan nuestra base de datos y esta página.",
      "Algunos de estos proveedores están fuera del Espacio Económico Europeo. En esos casos, las transferencias se amparan en las cláusulas contractuales tipo de la Comisión Europea o en el Marco de Privacidad de Datos UE-EE. UU.",
    ],
  },
  {
    title: "Cuánto tiempo los guardamos",
    body: [
      "Los datos de la compra, mientras tengas acceso al curso y durante los plazos que exige la ley. Los datos de navegación, como máximo 24 meses.",
    ],
  },
  {
    title: "Tus derechos",
    body: [
      `Puedes pedir acceso a tus datos, corregirlos, borrarlos, limitar su uso, oponerte a su tratamiento o llevártelos a otro servicio. Escríbenos a ${offer.email} y te respondemos en un plazo máximo de un mes.`,
      "Si crees que no hemos tratado bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).",
    ],
  },
];

export default function PrivacidadPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
      <Link
        href="/"
        className="text-sm font-semibold text-gold hover:text-gold-soft"
      >
        ← Volver al curso
      </Link>
      <h1 className="mt-6 text-4xl font-extrabold tracking-tight">
        Política de privacidad
      </h1>
      <p className="mt-3 text-sm text-muted">Última actualización: 13 de octubre de 2026</p>
      <div className="mt-10 space-y-10">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-xl font-bold">{section.title}</h2>
            <div className="mt-3 space-y-3 leading-7 text-muted">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
