-- 044 · Contagens da Visão geral para o papel Comitê.
--
-- Aplicar no Supabase (MCP `apply_migration` ou SQL Editor), uma vez. É ADITIVA: só cria uma função;
-- nenhuma política de RLS, tabela ou permissão existente muda. Para desfazer:
--   drop function public.rel_visao_geral_comite(uuid);
--
-- O Comitê não lê relatos (a RLS de `reports` só abre para admin, triagem e investigador) e isso NÃO
-- muda. Esta função devolve apenas números, nunca uma linha de relato, e só para quem é Comitê ativo
-- da empresa pedida. Administração, triagem e investigação seguem contando pela RLS, como antes.
--
-- Proteção de célula pequena, igual à do relatório mensal (`suppress_small_cell`, mínimo por empresa):
--  * `total` é sempre exato;
--  * uma divisão (por situação; abertos x encerrados) só aparece INTEIRA ou fica toda oculta, para o
--    número oculto não poder ser deduzido por subtração;
--  * o subconjunto "críticos em aberto" só aparece se ele e o complemento sobrevivem à supressão.
-- `null` significa "protegido", não "zero".
--
-- Sem esta migração a tela do Comitê mostra "indisponível" (nunca zeros inventados).
create or replace function public.rel_visao_geral_comite(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_min        bigint;
  v_total      bigint;
  v_triagem    bigint;
  v_apuracao   bigint;
  v_aguard     bigint;
  v_concl      bigint;
  v_arquiv     bigint;
  v_crit       bigint;
  v_abertos    bigint;
  v_encerr     bigint;
  v_div_status boolean;
  v_div_ab     boolean;
  v_crit_ok    boolean;
begin
  if p_org is null or not app.has_role(p_org, array['comite'::public.app_role]) then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  select o.min_cell_size into v_min from public.organizations o where o.id = p_org;
  v_min := coalesce(v_min, 5);

  select count(*),
         count(*) filter (where r.status = 'em_triagem'),
         count(*) filter (where r.status = 'em_apuracao'),
         count(*) filter (where r.status = 'aguardando_informacao'),
         count(*) filter (where r.status = 'concluida'),
         count(*) filter (where r.status = 'arquivada'),
         count(*) filter (where r.risk = 'critico' and r.status not in ('concluida', 'arquivada'))
    into v_total, v_triagem, v_apuracao, v_aguard, v_concl, v_arquiv, v_crit
    from public.reports r
   where r.org_id = p_org;

  v_abertos := v_triagem + v_apuracao + v_aguard;
  v_encerr  := v_concl + v_arquiv;

  v_div_status := (v_triagem = 0 or v_triagem >= v_min)
              and (v_apuracao = 0 or v_apuracao >= v_min)
              and (v_aguard = 0 or v_aguard >= v_min)
              and (v_concl = 0 or v_concl >= v_min)
              and (v_arquiv = 0 or v_arquiv >= v_min);
  v_div_ab := (v_abertos = 0 or v_abertos >= v_min) and (v_encerr = 0 or v_encerr >= v_min);
  v_crit_ok := v_div_ab
           and (v_crit = 0 or v_crit >= v_min)
           and (v_abertos - v_crit = 0 or v_abertos - v_crit >= v_min);

  return jsonb_build_object(
    'minimo',     v_min,
    'total',      v_total,
    'abertos',    case when v_div_ab then v_abertos end,
    'encerrados', case when v_div_ab then v_encerr end,
    'criticos',   case when v_crit_ok then v_crit end,
    'por_status', jsonb_build_object(
      'em_triagem',            case when v_div_status then v_triagem end,
      'em_apuracao',           case when v_div_status then v_apuracao end,
      'aguardando_informacao', case when v_div_status then v_aguard end,
      'concluida',             case when v_div_status then v_concl end,
      'arquivada',             case when v_div_status then v_arquiv end
    )
  );
end;
$$;

revoke all on function public.rel_visao_geral_comite(uuid) from public, anon;
grant execute on function public.rel_visao_geral_comite(uuid) to authenticated;

comment on function public.rel_visao_geral_comite(uuid) is
  'Contagens (sem nenhum dado de relato) para o Comitê da empresa p_org. Células pequenas protegidas; null = protegido.';
