/** Leitura de variáveis de ambiente com falha alta e mensagem útil. */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variável de ambiente ausente: ${name}. Copie .env.example para .env.local e preencha.`,
    );
  }
  return value;
}

/**
 * Sem `NEXT_PUBLIC_SITE_URL` configurada, os links de convite/recuperação
 * (`authProvisioning.ts`) caíam sempre em `localhost:3000` — inclusive em
 * produção, onde só quem roda o projeto localmente consegue abri-los. A
 * Vercel já expõe, em todo build, o domínio de produção
 * (`VERCEL_PROJECT_PRODUCTION_URL`) ou do deploy atual (`VERCEL_URL`); usar
 * um dos dois como fallback evita que a variável esquecida derrube o
 * sistema de volta para `localhost`. Configurar `NEXT_PUBLIC_SITE_URL`
 * continua sendo o caminho certo (é o domínio canônico); isto é só uma rede
 * de segurança. Ver README.
 */
const inferredSiteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const publicEnv = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? inferredSiteUrl,
  defaultOrgSlug: process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ?? "sentinela",
};
