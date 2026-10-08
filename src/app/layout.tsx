import type { Metadata } from "next";
import { Manrope, Montserrat } from "next/font/google";

import { MetaPixel } from "@/components/meta-pixel";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-montserrat",
});

const title = "Curso online de bachata desde cero | Choco Bachata";
const description =
  "Aprende a bailar bachata desde casa con Choco: tres niveles, de tus primeros pasos a bailar en social con soltura. Pago único de 29,99 €, IVA incluido.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    siteName: "Choco Bachata",
    locale: "es_ES",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${manrope.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-bg text-ink">
        <MetaPixel />
        {children}
      </body>
    </html>
  );
}
