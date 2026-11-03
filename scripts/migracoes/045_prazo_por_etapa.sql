-- 045 · Prazo por etapa: `reports.due_at` passa a ser o "prazo vigente" da etapa em que o relato está.
--
-- Aplicar no Supabase (MCP `apply_migration` ou SQL Editor), uma vez. Não cria coluna, não toca em RLS
-- nem em permissões: só um gatilho BEFORE UPDATE em `reports` e o ajuste dos relatos abertos de hoje.
-- Para desfazer (os prazos já recalculados ficam como estão):
--   drop trigger t_reports_prazo on public.reports;
--   drop function app.set_report_deadline();
--
-- Regra (calendário corrido, em horas; `organizations.sla_triagem_hours` e `sla_apuracao_hours`):
--  * entrou em triagem (voltou da apuração) ........ agora + prazo da triagem
--  * reaberto depois de concluído/arquivado ........ agora + prazo da triagem
--  * saiu da triagem para apuração/aguardando ...... recebimento + prazo da apuração
--  * apuração <-> aguardando informação ............ mantém (o relógio não pausa)
--  * concluído/arquivado ........................... mantém (histórico; "dentro do prazo" continua válido)
-- Mudar as horas em Configurações vale só para relatos novos e para as próximas mudanças de status.
create or replace function app.set_report_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_triagem  integer;
  v_apuracao integer;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select sla_triagem_hours, sla_apuracao_hours
    into v_triagem, v_apuracao
    from public.organizations
   where id = new.org_id;

  if new.status = 'em_triagem'
     or (old.status in ('concluida', 'arquivada') and new.status not in ('concluida', 'arquivada')) then
    new.due_at := now() + make_interval(hours => v_triagem);
  elsif old.status = 'em_triagem' and new.status in ('em_apuracao', 'aguardando_informacao') then
    new.due_at := new.created_at + make_interval(hours => v_apuracao);
  end if;

  return new;
end $$;

create trigger t_reports_prazo
  before update on public.reports
  for each row execute function app.set_report_deadline();

-- Relatos abertos que já saíram da triagem: o prazo de 72 h deles já tinha sido cumprido.
-- Os encerrados não são tocados (os relatórios mensais publicados são fotos congeladas).
update public.reports r
   set due_at = r.created_at + make_interval(hours => o.sla_apuracao_hours)
  from public.organizations o
 where o.id = r.org_id
   and r.status in ('em_apuracao', 'aguardando_informacao');
