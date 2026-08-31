import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Sentinela | Canal de Denúncias",
    template: "%s | Sentinela",
  },
  description:
    "Espaço seguro e confidencial para relatar situações, condutas ou condições relacionadas ao trabalho.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    title: "Sentinela — Canal de Denúncias",
    description:
      "Sua voz merece ser ouvida. Relatos seguros, confidenciais e com possibilidade de anonimato.",
    images: ["/og.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sentinela — Canal de Denúncias",
    description: "Sua voz merece ser ouvida.",
    images: ["/og.jpg"],
  },
  icons: { icon: "/favicon.svg" },
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  themeColor: "#0e6d67",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
