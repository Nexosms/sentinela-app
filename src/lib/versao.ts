/**
 * Versão (commit) desta publicação do site. Na Vercel vem de
 * `VERCEL_GIT_COMMIT_SHA`; em desenvolvimento local é "dev". Serve para a tela
 * de publicar para várias empresas comparar a versão da página aberta no
 * navegador com a do servidor que responde às ações: se forem diferentes, a aba
 * está desatualizada e fala com um código antigo.
 */
export const VERSAO_BUILD = (process.env.VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7);
