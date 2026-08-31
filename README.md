# Sentinela — Canal de Denúncias

Canal de denúncias corporativo em pt-BR, alinhado à **Lei nº 14.457/2022** (canal de denúncias e
CIPA) e às **NR-01, NR-05 e NR-17** (prevenção e gestão de riscos psicossociais no trabalho).

- **Canal público** — relato anônimo ou identificado, em assistente de 5 etapas, com anexos.
  O denunciante recebe **protocolo + chave privada** e acompanha o caso sem criar conta.
- **Painel administrativo** — triagem, investigação, planos de ação, relatórios e auditoria.

## Stack

Next.js 16 (App Router) na **Vercel** · **Supabase** (Postgres 17, Auth, Storage).
Sem Tailwind: o design system é próprio, em `src/app/globals.css`.

## Começando

```bash
cp .env.example .env.local   # preencher
npm install
npm run dev
```

| Script | O que faz |
|---|---|
| `npm run dev` | Desenvolvimento |
| `npm run build` | Build de produção |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run verify` | typecheck + lint + build |

## Regras do projeto

**O design system é intocável.** `globals.css` é uma folha sem escopo, acoplada a nomes de classe.
Componentes não renomeiam, acrescentam nem removem `className`, e mantêm a tag de todo elemento que
o CSS mira por tag dentro de um contexto de classe (`.field-grid label`, `.file-list div`).

**Três clientes Supabase, fronteiras rígidas:**

| Cliente | Onde |
|---|---|
| `lib/supabase/client.ts` | Client components com sessão de staff. Nunca no fluxo do denunciante |
| `lib/supabase/server.ts` | Padrão para todo código de staff — **sempre sob RLS** |
| `lib/supabase/admin.ts` | Service role. Só em `api/public/**`, `api/cron/**` e `api/admin/invites` |

A última fronteira é imposta por ESLint (`no-restricted-imports` em `eslint.config.mjs`).
Se uma query de staff só funciona com service role, **a política de RLS está errada.**

**O denunciante não tem conta e nunca fala com o PostgREST.** `reports` e tabelas filhas são
DENY-ALL para `anon`; todo byte passa por route handler no runtime Node, que valida protocolo +
chave, aplica rate limit e grava auditoria.

**Nada de segredo em URL.** Protocolo e chave viajam só em corpo de `POST`. Não existe rota
`/acompanhar/[protocolo]` — protocolo em URL vaza para histórico, `Referer` e logs de acesso.

**Auditoria é append-only** e verificada por cadeia de hash. Nunca registrar no log o corpo da
denúncia, a chave, o IP em claro ou os campos de identidade — só referências e hashes.

## Estado

Fase 0 (fundação Vercel) concluída. Ver o plano completo das fases 1–7.

## `_legacy/`

Protótipo original (Cloudflare Workers + D1 + R2, construído no ChatGPT Sites), mantido fora do
build e do lint apenas como referência do JSX durante o porte. **Apagar ao fim da Fase 2.**
