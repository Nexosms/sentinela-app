import type { NextConfig } from "next";

/**
 * CSP: sem `unsafe-eval`. `unsafe-inline` em style-src é necessário porque o
 * design system usa estilos inline para os medidores/gráficos em CSS puro.
 * Em script-src ele é exigido pelo bootstrap do Next; trocar por nonce exige
 * middleware por requisição — previsto para a Fase 7.
 *
 * `unsafe-eval` entra APENAS em desenvolvimento: o React usa eval() em dev para
 * reconstruir callstacks. Em produção o React nunca usa eval, e a diretiva não é emitida.
 */
const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' https://*.supabase.co${isDev ? " ws://localhost:* http://localhost:*" : ""}`,
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const baseHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Há um package-lock.json solto em ~/; fixa a raiz neste projeto.
  turbopack: { root: import.meta.dirname },
  async headers() {
    return [
      { source: "/:path*", headers: baseHeaders },
      // O painel e o acompanhamento nunca devem ser indexados.
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        source: "/acompanhar/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
    ];
  },
};

export default nextConfig;
