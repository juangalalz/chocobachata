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

const siteUrl = "https://curso.chocobachata.com";
const title = "Aprende bachata desde cero | Choco Bachata";
const description =
  "Tres niveles para bailar bachata desde casa, a tu ritmo. Paso básico, ritmo y combinaciones. Pago único de 29,99 €, IVA incluido, sin caducidad.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s | Choco Bachata",
  },
  description,
  applicationName: "Choco Bachata",
  authors: [{ name: "Choco Bachata", url: "https://www.chocobachata.com" }],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: "Choco Bachata",
    locale: "es_ES",
    type: "website",
    images: [
      {
        url: "/og.jpg",
        width: 1024,
        height: 571,
        alt: "Aprende a bailar bachata desde cero con Choco",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.jpg"],
  },
  robots: {
    index: true,
    follow: true,
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
