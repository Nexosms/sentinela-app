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
| `lib/supabase/admin.ts` | Service role. Só em `api/public/**`, `api/cron/**`, `api/admin/invites` e `api/admin/evidence` |

A última fronteira é imposta por ESLint (`no-restricted-imports` em `eslint.config.mjs`).
Se uma query de staff só funciona com service role, **a política de RLS está errada.**

`api/admin/evidence` é a única exceção onde existe sessão de staff, e é estreita: o bucket
`evidence` é privado e não tem policy alguma em `storage.objects`, então nem o dono da evidência
consegue assinar uma URL sob RLS. A rota autoriza e registra o acesso com `open_evidence`
(SECURITY INVOKER, sob RLS) **antes** de tocar na chave; o service role só assina um caminho já
autorizado. Nenhuma leitura de dado de staff é feita com ele.

**O denunciante não tem conta e nunca fala com o PostgREST.** `reports` e tabelas filhas são
DENY-ALL para `anon`; todo byte passa por route handler no runtime Node, que valida protocolo +
chave, aplica rate limit e grava auditoria.

**Nada de segredo em URL.** Protocolo e chave viajam só em corpo de `POST`. Não existe rota
`/acompanhar/[protocolo]` — protocolo em URL vaza para histórico, `Referer` e logs de acesso.

**Auditoria é append-only** e verificada por cadeia de hash. Nunca registrar no log o corpo da
denúncia, a chave, o IP em claro ou os campos de identidade — só referências e hashes.

## Estado

| Fase | O que entrega | Situação |
|---|---|---|
| 0 | Fundação Next.js 16 na Vercel, landing, páginas legais, headers de segurança | **concluída** |
| 1 | Supabase: 21 migrações, RLS, Auth por convite, shell do admin | **concluída** |
| 2 | Envio de relato ponta a ponta, upload direto ao Storage, protocolo + chave | **concluída** |
| 3 | Acompanhamento real: linha do tempo, caixa postal bidirecional, complemento | **concluída** |
| 4 | Painel de denúncias real: caixa de entrada, detalhe, evidência, identidade | **concluída** |
| 5 | Investigações e planos de ação | a fazer |
| 6 | Relatórios e indicadores NR-01 / CIPA | a fazer |
| 7 | Auditoria, retenção, `reporter_api`, endurecimento final | a fazer |

**As fases 0–3 já constituem o canal público completo** — o artefato que a Lei 14.457 exige.
Podem ir ao ar antes do painel ficar pronto, com a triagem acontecendo pelo painel do
Supabase como paliativo.

O plano completo das 7 fases está em
`~/.claude/plans/o-seguinte-foi-goofy-sparkle.md`.

### O que a Fase 4 construiu

| Entrega | Onde |
|---|---|
| Caixa de entrada com filtros por `searchParams`, busca e paginação | `src/components/admin/inbox/InboxShell.tsx`, `src/lib/admin/inbox.ts` |
| Detalhe com as 4 abas vivas (visão geral, linha do tempo, evidências, mensagens) | `src/components/admin/inbox/CaseDetail.tsx` |
| Status, risco, atribuição, mensagens e complementação por Server Action | `src/app/admin/denuncias/[id]/actions.ts` |
| Download de evidência com URL assinada de 60 s e trilha obrigatória | `src/app/api/admin/evidence/[evidenceId]/route.ts` |
| Break-glass de identidade nos três estados | `CaseDetail.tsx` (`IdentityBlock`) + `actions.ts` |
| Sino de notificações e `/admin/notificacoes` | `src/lib/admin/notifications.ts`, `src/app/admin/notificacoes/` |
| Exportação CSV com registro de auditoria | `src/app/api/admin/denuncias/export/route.ts` |

**A auditoria do painel é feita por trigger, não por código.** `audit_events` não tem policy de
`INSERT` para `authenticated`, e o service role está barrado no painel por ESLint. Mudança de
status, de risco, de atribuição e envio de mensagem são registrados por `t_reports_audit` e
`t_messages_audit` na **mesma transação** da mutação. Não acrescente `recordAudit()` nas Server
Actions: duplicaria evento numa tabela que não admite correção.

**Decisão registrada — `app.write_audit` tem lista branca de ações.** A função recebe `EXECUTE`
de `authenticated` (as funções `SECURITY INVOKER` do painel dependem dela para escrever numa
tabela onde o chamador não tem `INSERT`). Como a tabela é imutável por RULE, um evento forjado
não teria como ser corrigido. Por isso a função só aceita dez nomes de ação conhecidos, força
`actor_id = auth.uid()` e exige vínculo ativo com a organização. Verificado: ação fora da lista
devolve `22023`, organização alheia devolve `42501`.

**Limitação conhecida — `report_status_history.rationale` fica sempre nulo.** O trigger
`app.log_report_transition` (migração 004) grava o histórico, e não há como lhe passar a
justificativa a partir do cliente. A justificativa opcional de `alterarStatus` é gravada como
**nota interna** em `report_messages` (`internal = true`), então o texto não se perde e o
denunciante não o vê. Preencher a coluna de verdade exige uma função `SECURITY DEFINER` ou um
parâmetro de sessão lido pelo trigger — trabalho de Fase 5, se for necessário.

### Prova da RLS com um segundo usuário

A organização tem um único membro ativo, o que impedia testar isolamento entre pessoas. Com um
investigador sintético (criado e removido na verificação):

| Tentativa | Resultado |
|---|---|
| Ler relatos sem nenhuma atribuição | 0 de 3 |
| Ler mensagens, evidências e auditoria | 0, 0, 0 |
| Ler relatos após receber um caso | 1 — apenas o dele |
| Ler `report_identities` sem grant | 0 |
| `reveal_identity()` sem grant | `42501` |
| Conceder um grant de identidade a si mesmo | `42501` |

A última linha é a que sustenta a promessa da tela pública: quem conduz a apuração não consegue
se autoconceder acesso à identidade de quem denunciou.

## O protótipo original

O protótipo (Cloudflare Workers + D1 + R2, construído no ChatGPT Sites) continua intacto em
`/Users/davidabn/sentinela-projeto-completo`, fora deste repositório. A pasta `_legacy/`, que
guardava uma cópia do JSX durante o porte, **foi apagada ao fim da Fase 4** — todas as telas
já foram portadas e o original é a referência.

Os comentários que citam `ReportChannel.tsx` e um número de linha apontam para esse arquivo.

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
| 020 | `get_report_catalog()` — catálogo público sem service role no render |
| 021 | wrappers públicos de rate limit (o schema `app` não é exposto pelo PostgREST) |
| 022 | Fase 4: `app.write_audit` (lista branca), `app.notify`, triggers de auditoria e notificação, `open_evidence()`, `request_identity_access()` |
| 022b | amplia o CHECK de `notifications.kind` — só previa 8 tipos e rejeitava `report.assigned` |
| 023 | `record_export()` — exportação e evento de auditoria na mesma transação |

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

### Rate limit: a assimetria é deliberada

`src/lib/ratelimit.ts` expõe duas formas, e a diferença é de projeto, não descuido:

| | Onde | Em falha da função |
|---|---|---|
| `consume()` | envio de relato, pedido de URL de upload | **falha aberto** |
| `consumeStrict()` | consulta de protocolo, mensagem, complemento | **falha fechado** (503) |

No envio, recusar um relato porque a tabela de contadores teve um soluço seria o dano maior —
um canal de denúncia não pode fechar a porta. Na consulta é o oposto: ali o limitador é a
única coisa entre uma chave de 75 bits e a força bruta, e falhar aberto entregaria o bypass a
quem conseguisse derrubar a função.

Na consulta o balde por protocolo (5/h) é consumido **antes** da busca no banco. Se fosse
depois, o próprio limitador viraria oráculo de existência de protocolo.
