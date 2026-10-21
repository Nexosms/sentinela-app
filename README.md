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
| `lib/supabase/admin.ts` | Service role. Só em `api/public/**`, `api/cron/**`, `api/admin/invites`, `api/admin/evidence`, `api/portal` e `admin/clientes/**` |

A última fronteira é imposta por ESLint (`no-restricted-imports` em `eslint.config.mjs`).
Se uma query de staff só funciona com service role, **a política de RLS está errada.**

`api/admin/evidence` é a única exceção onde existe sessão de staff, e é estreita: o bucket
`evidence` é privado e não tem policy alguma em `storage.objects`, então nem o dono da evidência
consegue assinar uma URL sob RLS. A rota autoriza e registra o acesso com `open_evidence`
(SECURITY INVOKER, sob RLS) **antes** de tocar na chave; o service role só assina um caminho já
autorizado. Nenhuma leitura de dado de staff é feita com ele.

`api/portal/files/[id]` segue o mesmo desenho para o bucket `portal` (Portal do Cliente): autoriza com
`open_portal_file` (SECURITY INVOKER, sob RLS) e só então o service role assina a URL. As server
actions de `admin/clientes/**` usam o service role apenas para o Storage (assinar envio, conferir e
apagar objeto); toda gravação em tabela vai sob RLS.

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

**Decisão revista na 037:** Triagem passou a poder *abrir* uma investigação (`inv_insert`) e
vincular a denúncia de origem (`inv_reports_insert`) — é o botão "Abrir investigação" na tela da
denúncia. `app.inv_writable()` continua intocada: Triagem não escreve equipe, entrevistas, achados
nem plano, e não desvincula uma denúncia já vinculada — só quem abre e liga o dossiê à denúncia que
o originou.

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
| 037 | `inv_insert` passa a aceitar também o papel Triagem (antes só admin/investigador) — Triagem pode abrir uma investigação a partir de uma denúncia; `inv_reports_insert` ganha a mesma exceção (só para vincular a denúncia de origem), sem tocar em `app.inv_writable()` — as outras quatro tabelas-filhas (equipe, entrevistas, achados, plano) e o desvincular continuam só admin/investigador |
| 038 | `get_report_catalog()`: `legal_name`/`cnpj` do "Este canal é operado por..." (Etapa 1 do relato) passam a vir sempre da Sentinela (via `app.sentinela_org_id()`), nunca da empresa-cliente do link — antes, `/relato/<cliente>` mostrava a própria empresa-cliente como operadora do canal dela mesma. `slug`/`name` continuam vindo da organização do link (usados para `orgSlug` e para achar as categorias certas) |
| 039 | Portal do Cliente: `portal_meetings`, `portal_meeting_actions` e `portal_files` (gravação, arquivo de reunião e material numa tabela só), com RLS — leitura por membro da empresa e só o publicado, escrita só de admin da Sentinela (`app.is_nexo_admin()`; `has_role(org,{admin})` não serve porque um admin da própria empresa-cliente passaria). Triggers de auditoria `portal.content_*` (só tipo e id) e `app.write_audit` com a lista branca ampliada |
| 040 | `open_portal_file()` (SECURITY INVOKER, sob RLS) e o bucket privado `portal` (limite de 2 GB, sem SVG/HTML, sem policies em `storage.objects`) |
| 041 | `portal_meetings.transcript` — texto da aba Transcrição, com a mesma visibilidade e RLS da reunião |
| 042 | `portal_folders` (pasta de materiais — campanha mensal do CDN Conecta) e `portal_files.folder_id`: a pasta tem a visibilidade e os arquivos dentro herdam; `audit_portal()` passa a cobrir a tabela |
| 043 | Relatório mensal por cliente: `report_snapshots` ganha `is_published`/`published_at`/`published_by`; RLS reescrita (cliente lê só o publicado, a Nexo lê tudo e é a única que escreve — antes `admin`/`comite` de qualquer empresa inseriam); trigger `app.audit_snapshot()` (`snapshot.created`, `snapshot.published`, `snapshot.unpublished`, só tipo e período) e `app.write_audit` com a lista branca ampliada |

### Portal do Cliente

Cada empresa-cliente tem, no mesmo painel e no mesmo login, duas áreas: **Minhas Reuniões**
(`/admin/reunioes`: lista por mês, da mais recente para a mais antiga; cada reunião abre numa página
com "← Voltar", título, situação, data, participantes e as abas Resumo, Ações, Transcrição, Gravação e
Arquivos) e **Materiais e Documentos** (`/admin/materiais`: Treinamento, CDN Conecta e Cartazes, com
busca). Os dois itens ficam fora da grade de "Time e permissões" (`configurable: false` em
`lib/admin/navItems.ts`): aparecem para todo papel, e o conteúdo é que é filtrado.

- **Quem escreve:** só a equipe Nexo, em `/admin/clientes/<empresa>/portal` (botão "Gerenciar portal"
  na página do cliente). A empresa vem da URL, nunca do cookie de organização ativa. Quem tem papel
  Administração numa empresa-cliente só visualiza.
- **Visibilidade:** reunião e material têm "visível no portal"; ações, gravação e arquivos de uma reunião
  herdam a visibilidade dela. Rascunho só a Nexo vê. As telas do cliente filtram por organização **e**
  por publicado explicitamente (a Nexo está em toda empresa e vê rascunho por RLS).
- **Arquivos:** bucket `portal` privado. O navegador envia direto ao Storage com URL de envio assinada
  (os bytes não passam pela Vercel); a server action de registro relê tamanho e tipo reais com
  `storage.info`. Abrir/baixar passa por `/api/portal/files/<id>` (302 para URL assinada). `?inline=1`
  só para vídeo, áudio, imagem e PDF (URL de 1 h, para o vídeo poder avançar); o resto sempre baixa.
  Excluir arquivo ou reunião apaga o objeto do Storage antes da linha.
- **Pastas:** no CDN Conecta, cada campanha mensal é uma pasta (`/admin/clientes/<empresa>/portal`, aba Materiais
  → "Nova pasta"). Dentro dela se envia vários arquivos de uma vez, ou a pasta inteira do computador (subpastas
  entram todas na mesma pasta do portal, sem hierarquia). O cliente vê as pastas como cartões, em ordem de mês,
  e abre cada uma em `/admin/materiais/pastas/<id>`; a busca também acha arquivos dentro de pastas publicadas.
- **Publicar para várias empresas** (`/admin/clientes/publicar`, botão na tela de Clientes): o arquivo sobe
  UMA vez para `_publicacao/` no bucket `portal` e cada empresa marcada (uma a uma, nenhuma vem marcada)
  recebe a sua própria cópia, feita dentro do Storage (`copy`), com a linha em `portal_files` apontando
  para ela — apagar ou trocar o arquivo de uma empresa não mexe nas outras, e depois da publicação cada
  cópia é editada separadamente. Dois modos: material solto, ou pasta do CDN Conecta (acha a pasta de mesmo
  nome e mês da empresa ou cria). O trabalho é fatiado em UMA empresa por chamada
  (`copiarParaEmpresa`), orquestrado pelo navegador, para não passar do tempo de uma função da Vercel.
  Se alguma empresa falhar, os temporários ficam e dá para tentar de novo só nas que falharam. Se a aba for
  fechada no meio, sobram arquivos em `_publicacao/` — não há limpeza automática; apague-os pelo painel
  do Storage.
- **Limite de tamanho:** o bucket aceita 2 GB, mas o **limite global do projeto** (Supabase → Storage →
  Settings) manda por cima — num projeto novo é 50 MB, e um envio maior volta como `EntityTooLarge`.
  Precisa ser elevado no painel. O envio é um PUT único, sem retomada.
- **Fora do escopo:** notificação de conteúdo novo, cliente alterar o status de uma ação e copiar um
  material para várias empresas de uma vez.

### Relatório mensal do cliente

Nos dias 1 a 3 de cada mês, às 07h de Brasília, o cron `/api/cron/relatorio-mensal` (`vercel.json`,
`CRON_SECRET`) gera o relatório do mês anterior de cada empresa-cliente ativa e **já o libera** ao cliente,
sem conferência prévia (decisão da Nexo). Roda também nos dias 2 e 3 porque a Vercel não repete um
disparo que falhou; quem já tem relatório do mês é pulado (`?mes=AAAA-MM` refaz um mês). Um rascunho
deixado à mão pela Nexo não é publicado pelo cron. Em `/admin/clientes/relatorios` a Nexo acompanha,
abre para conferir e **oculta** (o cliente deixa de ver na hora); o que ela gera ali ("Gerar", "Gerar os
que faltam") fica como rascunho até "Liberar". A liberação automática aparece na auditoria como
`snapshot.published` com ator "sistema". O cliente vê em **Relatórios** (`/admin/relatorios` →
`/admin/relatorios/mensal/AAAA-MM`), em dashboard na identidade do CDN, com "Baixar PDF" (impressão do
navegador; folha A4 paisagem por página nomeada `@page mr`, sem afetar os outros relatórios).

- **Só indicadores:** recebidos no mês (com variação sobre o anterior), anônimos, críticos, em andamento,
  encerrados, evolução de 12 meses, por nível de risco, por situação, categorias e prazos (triagem e
  conclusão no SLA, mediana). Nunca protocolo, texto, envolvidos ou dado de quem relatou.
- **Calculado uma vez e congelado** em `report_snapshots.metrics` (`lib/admin/relatorioMensal*.ts`, service
  role, sempre com `org_id`). Não dá para calcular no login do cliente: o Comitê não lê `reports` pela RLS e
  as `rel_*` são SECURITY INVOKER — daria zero. Regerar um relatório já publicado é recusado.
- **Privacidade:** o total do mês e a série mensal são sempre exatos (decisão da Nexo). O resto é gravado
  já protegido (`null` / `visivel:false`), então o número cru nunca chega ao navegador. Como o total é
  público, "total − partes" revelaria a parte escondida; por isso cada subconjunto só aparece se ele **e o
  seu complemento** forem zero ou ≥ `min_cell_size`, e cada divisão (risco, situação) é tudo-ou-nada.
  Categorias são multirrótulo e são protegidas uma a uma. As regras são funções puras em
  `relatorioMensalCalculo.ts`.
- **Fora do escopo:** e-mail ou notificação de relatório novo (não há infraestrutura; a Nexo avisa por
  fora), as outras seis telas do módulo Relatórios, e a Visão geral do Comitê, que mostra zeros pelo mesmo
  motivo acima.

### Esqueci minha senha

`/login` → "Esqueci minha senha" (`/esqueci-senha`) → e-mail com link → `/redefinir-senha` → nova senha.
A server action `solicitarRedefinicao` (`lib/auth/actions.ts`) chama `resetPasswordForEmail` e responde
**sempre a mesma mensagem**, exista a conta ou não, para a tela não revelar quem tem acesso (o erro real só
vai para o log). `/redefinir-senha` reaproveita `convite/ConviteClient.tsx` com `modo="redefinicao"`: os
mesmos três formatos de link, mas **sem** ativar vínculo (`/api/admin/invites/accept`) — redefinir senha não
concede acesso — e, depois de salvar, encerra as outras sessões da conta (`signOut({ scope: "others" })`).
Se o e-mail não chegar, a Nexo reenvia o convite em `/admin/clientes/<empresa>` (gera o link à mão).

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

**Toda consulta de tela filtra por organização explicitamente — não confie
só na RLS para isolar clientes.** A RLS (`current_org_ids()`) autoriza por
TODO vínculo ativo da pessoa, não só a organização "ativa" no seletor da
sidebar. Antes da migração 035 isso era inofensivo (uma pessoa, uma
organização); agora que a Sentinela tem vínculo em todo cliente, uma
consulta sem `.eq("org_id", staff.orgId)` mistura denúncias/investigações/
planos/notificações de **todos** os clientes — confirmei isso rodando a
consulta de verdade sob RLS, como um membro real da Sentinela, sem filtro
(vazou dois clientes juntos) e com filtro (isolou certo). Toda tela nova
que ler `reports`/`investigations`/`action_plans`/`notifications` precisa
desse filtro explícito — é fácil esquecer, porque o banco deixa passar.
A única exceção deliberada é a lista de Denúncias quando a organização
ativa é a própria Sentinela: aí a consulta **não** filtra por organização
de propósito (mostra todo cliente, identificado pelo nome da empresa) —
ver `agregando` em `InboxShell.tsx`/`CaseDetail.tsx`.

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

5. **Authentication → Emails → SMTP Settings → Custom SMTP** (necessário para o e-mail chegar a clientes: o
   remetente padrão do Supabase só entrega à equipe do projeto e tem limite de poucos e-mails/hora). Com o
   Resend: domínio verificado (SPF/DKIM), host `smtp.resend.com`, porta `465`, usuário `resend`, senha = API
   key (Sending access), remetente de um endereço do domínio verificado. Vale também para os convites.
6. **Authentication → Emails → Templates → Reset Password**: o link precisa apontar para o NOSSO domínio com
   o `token_hash` (prévias de WhatsApp/antivírus gastam o token de uso único se o link for o do Supabase):

   ```html
   <h2>Redefinir sua senha</h2>
   <p>Recebemos um pedido para criar uma nova senha de acesso ao painel do Canal de Denúncias.</p>
   <p><a href="{{ .SiteURL }}/redefinir-senha?token_hash={{ .TokenHash }}&type=recovery">Criar nova senha</a></p>
   <p>O link vale por tempo limitado e serve uma vez só. Se você não pediu, ignore este e-mail: sua senha
   continua a mesma.</p>
   ```

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
