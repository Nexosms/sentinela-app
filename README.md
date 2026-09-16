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
| 5 | Investigações e planos de ação | **concluída** |
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

### O que a Fase 5 construiu

| Entrega | Onde |
|---|---|
| Investigações: lista, detalhe e 5 abas | `src/components/admin/investigacoes/`, `src/lib/admin/investigacoes.ts` |
| Impedimento, dupla assinatura, somente-leitura após assinar | `investigacoes/[id]/actions.ts` |
| Planos de ação: lista, detalhe, medidas e eficácia | `src/components/admin/planos/`, `src/lib/admin/planos.ts` |
| Verificação de eficácia com verificador ≠ executor | `planos-de-acao/[id]/actions.ts` |
| Varredura de atraso e prazos (`sweep_overdue`) | `src/app/api/cron/sweep-overdue/route.ts` |

**Concluir e assinar é um único UPDATE.** A policy `inv_update` exige `reviewed_at IS NULL` no
`USING`, e o CHECK `inv_signoff_before_close` exige `reviewed_at` para concluir. Em dois UPDATEs, o
segundo afeta **zero linhas sem levantar erro** — o supabase-js devolve `error: null` sobre uma
gravação que não aconteceu. Por isso toda action que escreve em `investigations` pede `.select("id")`
de volta e trata lista vazia como recusa.

**`atrasada` nunca aparece em `<select>` de escrita.** O estado é derivado por `sweep_overdue()`, que
também o reverte quando a medida atrasada é concluída. Se uma pessoa puder marcá-lo à mão, o
indicador deixa de significar alguma coisa.

**`effectiveness_criteria` é obrigatório na criação da medida**, não na verificação: critério escrito
depois do resultado é justificativa, não verificação.

**Falhas de RLS encontradas ao construir o módulo e corrigidas na 026:** as tabelas-filhas de
`investigations` herdavam a visibilidade de *leitura* para autorizar *escrita*. Consequências: dava
para acrescentar achado ou entrevista a uma investigação já assinada (direto pela API, sem passar
pela interface), e `triagem` — que só deveria acompanhar — podia escrever no dossiê. O predicado
`app.inv_writable()` agora exige apuração aberta **e** papel de escrita, nas cinco filhas.

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
| 024 | Fase 5: lista branca ampliada, `app.next_code`, 6 triggers de auditoria, `sweep_overdue()` |
| 024b | revoga `sweep_overdue()` de `authenticated` — os privilégios padrão a haviam publicado |
| 025 | `public.next_code()` — wrapper, porque o schema `app` não é exposto pelo PostgREST |
| 026 | escrita nas tabelas-filhas de investigação: exige apuração aberta e papel de escrita |
| 028 | `role_nav_permissions` — permissões de navegação por cargo (aba "Time e permissões"), amplia `app.write_audit` com `nav_permission.changed` |
| 029 | corrige `app.audit_org_settings()` — `v_campos \|\| 'campo'` (ambíguo entre array‖array e array‖elemento) quebrava toda gravação em `organizations` que mudasse qualquer um dos 8 campos observados; troca para `array_append` |
| 030 | `get_report_catalog()` expõe `legal_name`/`cnpj` da organização, para a identificação institucional na 1ª etapa do relato |
| 031 | `get_report_catalog()` para de devolver `units` — cada empresa-cliente agora é a própria organização (não mais uma unidade escolhida no relato) |
| 032 | `app.audit_action_measure()` passa a avisar o responsável assim que uma medida é criada/reatribuída (`measure.assigned`, novo valor no CHECK de `notifications.kind`); `app.audit_investigation()` passa a avisar também o líder (`lead_id`), além do aviso em bloco para `admin` |
| 033 | `t_org_member_audit` passa a disparar também em DELETE — remover alguém do time (`removerMembro`) grava `member.removed`, novo valor na lista branca de `app.write_audit` |
| 034 | `organizations_cnpj_check` passa a aceitar CPF (11 dígitos) além de CNPJ/CAEPF (14) no documento da empresa-cliente; nova coluna `organizations.address` (texto livre) |
| 035 | Todo vínculo com a organização "Sentinela" passa a ser espelhado automaticamente em toda organização-cliente (mesmo papel/situação) — `app.seed_org_members_from_sentinela()` (organização nova) e `app.mirror_sentinela_member()` (entra/sai/muda de papel na Sentinela), mais backfill único para as organizações já existentes |
| 036 | Remove `organizations_cnpj_check` — documentos reais de cliente (CPF/CNPJ/CAEPF e variações) continuavam sendo recusados mesmo com a regra mais permissiva da 034; o campo aceita qualquer valor agora (a UNIQUE de documento continua) |

### Cadastrar uma empresa-cliente nova

Cada empresa-cliente é uma `organization` própria, com seu link exclusivo
`/relato/<slug>`. Quem é papel Administração na organização "Sentinela"
(`NEXT_PUBLIC_DEFAULT_ORG_SLUG`) conta como equipe Nexo e vê, na sidebar do
admin, o link **"⚑ Clientes"** (`/admin/clientes` —
`src/lib/org/context.ts#isNexoAdmin`).

A tela pede nome fantasia, razão social, CNPJ, o slug do link e o
e-mail/nome do primeiro contato da empresa, e faz tudo num passo só
(`criarEmpresaCliente`, em `src/app/admin/clientes/actions.ts`):

1. Cria a `organization` (slug único, vira `/relato/<slug>`).
2. Todo mundo que já tem vínculo com a Sentinela (qualquer papel) é
   vinculado automaticamente à organização nova, com o mesmo papel — não é
   código do app, é o trigger `t_seed_org_members_from_sentinela`
   (migração 035). A Nexo continua sendo quem administra de verdade cada
   cliente; o contato do cliente é opcional (item 3).
3. Convite opcional do contato do cliente com **papel `comite`** (só
   leitura de indicadores, relatórios e auditoria — não mexe em
   denúncias/investigações), reaproveitando o mesmo provisionamento de
   conta do convite de equipe (`src/lib/admin/authProvisioning.ts`) — a
   pessoa recebe um e-mail para definir a própria senha; a Nexo nunca vê
   senha de cliente. Se não for preenchido no cadastro, dá para convidar
   depois direto em `/admin/clientes/[orgId]`.

**Toda a equipe da Sentinela enxerga todo cliente, sempre.** Não é preciso
convidar ninguém da Nexo organização por organização — entrar/sair da
Sentinela, ou mudar de papel lá, se propaga automaticamente para toda
organização-cliente (`app.mirror_sentinela_member()`, migração 035). Se um
cliente precisar de um ajuste que só vale PARA ELE (ex.: esconder uma aba
específica), use Configurações → "Time e permissões" **daquela
organização** — isso não muda o vínculo em si, só o que aparece no menu.

**Remover uma empresa-cliente**: não existe DELETE — mesma regra já usada
em unidades e categorias (`is_active`, nunca apagar a linha): cada evento
de auditoria da empresa aponta para ela, e `audit_events` é imutável por
design (ver "Armadilhas registradas"). Em `/admin/clientes` ou
`/admin/clientes/[orgId]`, o botão ⊘ desativa (`alternarEmpresaCliente`) —
o link `/relato/<slug>` para de funcionar na hora (`get_report_catalog()`
só devolve organização ativa) e ela some do seletor de organização de quem
trabalha nela, mas os dados continuam intactos e ela pode ser reativada
(⟳) a qualquer momento.

**Trocar de organização**: como a equipe Nexo fica `admin` em várias
organizações (a própria Sentinela + cada cliente), a caixa com o nome da
organização no topo da sidebar vira um seletor (só aparece quando há mais
de uma) — `src/lib/org/actions.ts#trocarOrganizacaoAtiva` grava qual
organização `getStaffContext()` deve resolver, num cookie, depois de
confirmar sob RLS que a pessoa realmente tem vínculo ativo ali.

### Armadilhas registradas

- **Nunca apague uma linha do MEIO de `audit_events`.** Cada linha carrega o hash da
  anterior. Remover uma do meio deixa `verify_audit_chain()` acusando elo quebrado para
  sempre — e um "registro imutável" que se reporta quebrado é pior que nenhum. Ao limpar
  dados de teste há dois caminhos legítimos:

  1. **deixar a trilha em paz** — as FKs são `ON DELETE SET NULL`, então os eventos
     sobrevivem como órfãos legítimos, que é o comportamento desejado; ou
  2. **zerar a tabela inteira**, o que reinicia a cadeia de forma consistente (o primeiro
     evento novo tem `prev_hash` nulo por definição).

  Aconteceu na Fase 5: limpezas de fixture removeram três linhas do meio e a verificação
  passou a acusar `seq 190, 193, 213`. Foi corrigido zerando a tabela. Note que o
  classificador de permissões bloqueia `delete` em `audit_events` — é proposital; a
  limpeza de entrega é feita à mão no SQL Editor, com `scripts/limpeza-pre-entrega.sql`.

- **`revoke ... from public, anon` NÃO fecha uma função nova.** Este banco tem
  `ALTER DEFAULT PRIVILEGES` concedendo `EXECUTE` de toda função criada em `public` ao
  papel `authenticated`. Uma função pensada para o cron nasce publicada em
  `/rest/v1/rpc/<nome>`. A forma correta é sempre revogar dos três e conceder de volta
  só a quem deve:

  ```sql
  revoke all on function public.f(...) from public, anon, authenticated;
  grant execute on function public.f(...) to authenticated;  -- só se for o caso
  ```

  Foi assim que `sweep_overdue()` acabou exposta e precisou da migração 024b. Auditoria
  da superfície inteira:

  ```sql
  select p.proname,
         has_function_privilege('anon', p.oid, 'execute')         as anon,
         has_function_privilege('authenticated', p.oid, 'execute') as auth
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f' order by 2 desc, 3 desc;
  ```

  Hoje só `get_report_catalog` é executável por `anon`, e isso é deliberado.

- **UPDATE barrado por RLS não dá erro: afeta zero linhas.** A policy `inv_update` de
  `investigations` tem `reviewed_at IS NULL` no `USING`, então depois de assinada a linha
  fica invisível para escrita. Um segundo UPDATE devolve `error: null` e nenhuma linha —
  o supabase-js relata sucesso sobre uma mutação que não aconteceu. Em toda action que
  escreve numa tabela com `USING` restritivo, **confira a contagem de linhas afetadas** e
  trate zero como erro.

- **`session_replication_role = replica` também desliga `ON DELETE CASCADE`.** É o modo
  usado para apagar dados de teste (as RULEs de `audit_events` quebram a verificação de
  FK). Nele os filhos não são removidos junto: apague-os explicitamente, ou ficam órfãos.

- **Nunca** `alter table org_members force row level security` — o Postgres não
  aplica RLS ao dono da tabela, e é isso que quebra a recursão nas funções
  `SECURITY DEFINER`. `FORCE` traz a recursão de volta e trava o banco.
- Em política, use `x = any ((select app.current_org_ids())::uuid[])`. Sem o
  cast o parser lê `ANY(subquery)` e falha com `uuid = uuid[]`.
- Ao criar usuário direto por SQL em `auth.users`, preencha `confirmation_token`
  e os demais tokens com `''`. NULL quebra o login com
  `converting NULL to string is unsupported`. Na aplicação, use sempre a Admin
  API (`inviteUserByEmail`).
- **Não insira/edite/apague em `org_members` da organização "Sentinela"
  esperando que o efeito fique só ali.** Desde a migração 035, qualquer
  INSERT/UPDATE/DELETE num vínculo da Sentinela dispara
  `app.mirror_sentinela_member()`, que espelha a mesma mudança em **toda**
  organização-cliente. É o comportamento desejado (ver "Cadastrar uma
  empresa-cliente nova" acima) — só não tente "corrigir" um vínculo da
  Sentinela achando que é um ajuste local.
- **Sem `NEXT_PUBLIC_SITE_URL` em produção, todo link de convite/recuperação
  aponta para `localhost:3000`.** `src/lib/admin/authProvisioning.ts` monta o
  `redirectTo` a partir de `publicEnv.siteUrl`
  ([src/lib/env.ts](src/lib/env.ts)) — sem essa variável configurada na
  Vercel, o e-mail que a pessoa convidada recebe leva a um endereço que só
  existe na máquina de quem roda `npm run dev`. Há um fallback para o
  domínio da própria Vercel (`VERCEL_PROJECT_PRODUCTION_URL`/`VERCEL_URL`),
  mas configurar a variável com o domínio real continua sendo o certo — ver
  "Pendências no painel do Supabase" abaixo para o segundo passo
  (Redirect URLs), que é independente e igualmente necessário.

## Pendências no painel do Supabase (ação manual)

Não dá para configurar por migração; precisam ser feitas no dashboard antes de ir ao ar:

1. **Authentication → Providers → Email → desabilitar "Enable signups".** O acesso é
   exclusivamente por convite; com signup aberto qualquer pessoa cria conta.
2. **Authentication → Policies → habilitar "Leaked password protection"** (checagem
   contra o HaveIBeenPwned). Apontado pelo advisor de segurança.
3. **Remover o usuário de teste** `teste.admin@sentinela.local` antes da entrega.
4. **Authentication → URL Configuration**: "Site URL" e "Redirect URLs" precisam
   incluir o domínio de produção real (ex.: `https://app.seudominio.com.br/**`).
   Um `redirectTo` fora dessa lista é descartado silenciosamente pelo GoTrue —
   configurar `NEXT_PUBLIC_SITE_URL` na Vercel (ver "Observações operacionais"
   acima) não resolve sozinho se este passo não for feito também.

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
