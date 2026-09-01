-- =============================================================================
-- Sentinela — limpeza dos dados de teste antes da entrega ao cliente
-- =============================================================================
--
-- Rode ISTO NO SQL EDITOR do projeto Supabase, uma seção por vez, conferindo o
-- resultado de cada uma. Não é idempotente por acidente: cada bloco é escopado.
--
-- POR QUE `session_replication_role = replica`:
-- `audit_events` tem RULEs `DO INSTEAD NOTHING` em UPDATE e DELETE, que é o que
-- torna a trilha imutável. Isso faz a verificação da FK `ON DELETE SET NULL`
-- falhar com "referential integrity query gave unexpected result" ao apagar um
-- relato ou um usuário. `replica` desliga os triggers de FK apenas nesta
-- transação — os RULEs continuam no lugar e a imutabilidade não é afetada.
-- Nunca deixe isso ligado fora de uma transação de manutenção.
--
-- ATENÇÃO: rode APENAS num banco cujo conteúdo é de teste. Depois que o canal
-- receber um relato real, este script destrói prova.
-- -----------------------------------------------------------------------------

-- 1. O QUE EXISTE HOJE ---------------------------------------------------------
select 'relatos'        as tabela, count(*) from public.reports
union all select 'evidências',        count(*) from public.report_evidence
union all select 'mensagens',         count(*) from public.report_messages
union all select 'identidades',       count(*) from public.report_identities
union all select 'auditoria',         count(*) from public.audit_events
union all select 'acessos a dado',    count(*) from public.data_access_log
union all select 'notificações',      count(*) from public.notifications
union all select 'exportações',       count(*) from public.report_exports
union all select 'grants de ident.',  count(*) from public.identity_access_grants
union all select 'membros ativos',    count(*) from public.org_members where status = 'active'
union all select 'usuários',          count(*) from auth.users;

-- 2. CAMINHOS NO STORAGE A REMOVER --------------------------------------------
-- O banco e o bucket são independentes: apagar a linha NÃO apaga o arquivo.
-- Copie esta lista antes de apagar as linhas, senão os objetos ficam órfãos.
select storage_path, filename, size_bytes from public.report_evidence order by created_at;

-- 3. APAGAR RELATOS DE TESTE E TUDO QUE PENDE DELES ----------------------------
begin;
  set local session_replication_role = replica;

  delete from public.evidence_custody_events
   where evidence_id in (select id from public.report_evidence);
  delete from public.report_evidence;
  delete from public.report_messages;
  delete from public.report_identities;
  delete from public.report_categories;
  delete from public.report_status_history;
  delete from public.report_recusals;
  delete from public.identity_access_grants;
  delete from public.evidence_upload_tickets;
  delete from public.notifications;
  delete from public.report_exports;
  delete from public.data_access_log;
  delete from public.reports;

  -- A trilha de auditoria é uma cadeia de hash por organização. Zerá-la por
  -- completo é consistente (a próxima linha começa a cadeia de novo). Apagar
  -- um pedaço do MEIO, não: `verify_audit_chain()` passaria a acusar quebra
  -- para sempre. É tudo ou nada — nunca um DELETE seletivo aqui.
  delete from public.audit_events;
commit;

-- 4. REMOVER O USUÁRIO DE TESTE -----------------------------------------------
-- Troque o e-mail se tiver criado outros. Confira antes de rodar:
--   select id, email from auth.users;
begin;
  set local session_replication_role = replica;
  delete from public.org_members where user_id in
    (select id from auth.users where email like '%@sentinela.local');
  delete from public.profiles    where id      in
    (select id from auth.users where email like '%@sentinela.local');
  delete from auth.users where email like '%@sentinela.local';
commit;

-- 5. CONFERIR QUE FICOU LIMPO --------------------------------------------------
-- O esperado é: tudo em 0, exceto `categories` (19), `org_units` (3) e
-- `organizations` (1), que são semeadas de propósito e o cliente edita pelo painel.
select 'relatos' as tabela, count(*) from public.reports
union all select 'auditoria',      count(*) from public.audit_events
union all select 'notificações',   count(*) from public.notifications
union all select 'usuários',       count(*) from auth.users
union all select 'categorias',     count(*) from public.categories
union all select 'unidades',       count(*) from public.org_units
union all select 'organizações',   count(*) from public.organizations;
