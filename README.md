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
build e do lint apenas como referência do JSX durante o porte.

Ainda contém o JSX de duas telas não portadas: `Tracking` (Fase 3) e o painel `AdminPanel` /
`Dashboard` / `Inbox` (Fase 4). **Apagar ao fim da Fase 4**, não antes.

## Migrações do banco

Aplicadas via MCP do Supabase, em ordem. `supabase migration list` no projeto
`nomxwdcrgdblxcuoavnx` mostra o estado atual.

| # | Migração |
|---|---|
| 001 | extensões, schema `app`, ENUMs, trigger `updated_at` |
| 002 | organizações, unidades, perfis, membros, provisionamento no signup |
| 003 | catálogo de categorias |
| 004 | denúncias, identidade isolada, categorias N:N, histórico de status, impedimentos |
| 005 | mensagens, evidências, cadeia de custódia, tickets de upload |
| 006 | investigações, entrevistas, achados |
| 007 | planos de ação e medidas com verificação de eficácia |
| 008 | auditoria com cadeia de hash, log de acesso, grants de identidade, notificações |
| 009 | funções auxiliares de RLS (`SECURITY DEFINER`) |
| 010 | RLS ligada e todas as políticas |
| 011 | proteção de identidade (break-glass) |
| 012 | bucket `evidence` (privado, sem políticas — acesso só por URL assinada) |
| 013 | rate limiting e expiração de tickets |
| 014 | views de relatório e supressão de célula pequena |
| 015 | endurecimento de grants (`anon` sem acesso ao schema public) |
| 016 | seed das 19 categorias |
| 017 | seed da organização placeholder |
| 018 | correções dos advisors de segurança |
| 019 | políticas `FOR ALL` separadas + índices de FK |

### Armadilhas registradas

- **Nunca** `alter table org_members force row level security` — o Postgres não
  aplica RLS ao dono da tabela, e é isso que quebra a recursão nas funções
  `SECURITY DEFINER`. `FORCE` traz a recursão de volta e trava o banco.
- Em política, use `x = any ((select app.current_org_ids())::uuid[])`. Sem o
  cast o parser lê `ANY(subquery)` e falha com `uuid = uuid[]`.
- Ao criar usuário direto por SQL em `auth.users`, preencha `confirmation_token`
  e os demais tokens com `''`. NULL quebra o login com
  `converting NULL to string is unsupported`. Na aplicação, use sempre a Admin
  API (`inviteUserByEmail`).

## Pendências no painel do Supabase (ação manual)

Não dá para configurar por migração; precisam ser feitas no dashboard antes de ir ao ar:

1. **Authentication → Providers → Email → desabilitar "Enable signups".** O acesso é
   exclusivamente por convite; com signup aberto qualquer pessoa cria conta.
2. **Authentication → Policies → habilitar "Leaked password protection"** (checagem
   contra o HaveIBeenPwned). Apontado pelo advisor de segurança.
3. **Remover o usuário de teste** `teste.admin@sentinela.local` antes da entrega.

### Avisos de advisor que são intencionais

Três funções `SECURITY DEFINER` aparecem no advisor e devem continuar como estão:

- `get_report_catalog` — exposta a `anon` de propósito. Devolve só unidades e categorias
  ativas, que já aparecem na página pública. A alternativa seria dar grant de tabela ao
  `anon` (pior) ou usar a service role no render de página (pior ainda).
- `verify_audit_chain` — precisa ser DEFINER para ler a cadeia inteira; sob RLS, linhas
  ocultas apareceriam como quebras falsas. Faz a autorização por dentro (`admin`/`comite`).
- `rls_auto_enable` — do próprio Supabase, event trigger. EXECUTE já revogado.

## Observações operacionais descobertas em execução

- **Apagar linha não apaga arquivo.** Remover um `report` deixa o objeto órfão no bucket
  `evidence`. O cron de retenção (Fase 7) precisa varrer o Storage, não só o banco.
- **Relato de teste não sai por SQL comum.** Os RULEs de imutabilidade em `audit_events`
  fazem a FK `ON DELETE SET NULL` falhar. A limpeza exige
  `begin; set local session_replication_role = replica; … commit;` — escopo de sessão,
  sem DDL, os RULEs continuam intactos. É o comportamento desejado: a trilha resiste.
- **Rate limit falha aberto.** No envio isso está certo: um canal de denúncia não pode
  recusar um relato porque a tabela de contadores teve um soluço. **Na consulta de
  protocolo (Fase 3) a decisão precisa ser a oposta** — falhar aberto ali entregaria o
  bypass do limite a quem conseguisse derrubar a função.
