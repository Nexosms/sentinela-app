import type { Metadata } from "next";
import AdminTopbar from "@/components/admin/AdminTopbar";
import { createClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/org/context";
import { RISK_LABEL, STATUS_LABEL, formatDate, riskClass } from "@/lib/admin/labels";

export const metadata: Metadata = { title: "Visão geral" };

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" })
      .format(new Date()),
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function AdminOverview() {
  const staff = await getStaffContext();
  const supabase = await createClient();

  // Escopo explícito pela organização ativa: a RLS sozinha autoriza por TODO
  // vínculo ativo da pessoa (não só o "ativo" no seletor), e desde que a
  // equipe da Sentinela ganhou vínculo automático em todo cliente, sem este
  // filtro os números aqui misturariam todas as empresas.
  const [abertos, triagem, criticos, total] = await Promise.all([
    supabase.from("reports").select("id", { count: "exact", head: true })
      .eq("org_id", staff.orgId)
      .not("status", "in", "(concluida,arquivada)"),
    supabase.from("reports").select("id", { count: "exact", head: true })
      .eq("org_id", staff.orgId)
      .eq("status", "em_triagem"),
    supabase.from("reports").select("id", { count: "exact", head: true })
      .eq("org_id", staff.orgId)
      .eq("risk", "critico")
      .not("status", "in", "(concluida,arquivada)"),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("org_id", staff.orgId),
  ]);

  const { data: recentes } = await supabase
    .from("reports")
    .select("id, protocol, status, risk, created_at")
    .eq("org_id", staff.orgId)
    .order("created_at", { ascending: false })
    .limit(3);

  const firstName = staff.fullName.split(" ")[0];
  const abertosCount = abertos.count ?? 0;
  const criticosCount = criticos.count ?? 0;

  return (
    <>
      <AdminTopbar eyebrow="VISÃO OPERACIONAL" title="Visão geral" />
      <div className="dashboard">
        <div className="dash-heading">
          <div>
            <p>
              {greeting()}, {firstName}.{" "}
              {criticosCount > 0 ? (
                <b>
                  {criticosCount} caso{criticosCount > 1 ? "s" : ""} crítico
                  {criticosCount > 1 ? "s" : ""} em aberto.
                </b>
              ) : abertosCount > 0 ? (
                <b>
                  {abertosCount} caso{abertosCount > 1 ? "s" : ""} em aberto.
                </b>
              ) : (
                <b>Nenhum caso em aberto.</b>
              )}
            </p>
            <span>Dados agregados e protegidos · {staff.orgName}</span>
          </div>
        </div>

        <div className="kpi-grid">
          <article>
            <small>CASOS ABERTOS</small>
            <strong>{String(abertosCount).padStart(2, "0")}</strong>
            <span>de {total.count ?? 0} no total</span>
            <i style={{ width: `${total.count ? (abertosCount / total.count) * 100 : 0}%` }} />
          </article>
          <article>
            <small>EM TRIAGEM</small>
            <strong>{String(triagem.count ?? 0).padStart(2, "0")}</strong>
            <span>aguardando primeira análise</span>
            <i style={{ width: `${abertosCount ? ((triagem.count ?? 0) / abertosCount) * 100 : 0}%` }} />
          </article>
          <article className={criticosCount > 0 ? "attention" : ""}>
            <small>CASOS CRÍTICOS</small>
            <strong>{String(criticosCount).padStart(2, "0")}</strong>
            <span>{criticosCount > 0 ? "ação imediata" : "nenhum no momento"}</span>
            <i style={{ width: `${abertosCount ? (criticosCount / abertosCount) * 100 : 0}%` }} />
          </article>
          <article>
            <small>TOTAL RECEBIDO</small>
            <strong>{String(total.count ?? 0).padStart(2, "0")}</strong>
            <span>desde a abertura do canal</span>
            <i style={{ width: total.count ? "100%" : "0%" }} />
          </article>
        </div>

        {recentes && recentes.length > 0 ? (
          <div className="dash-grid">
            <section className="priority-card">
              <div className="panel-title">
                <div>
                  <small>MAIS RECENTES</small>
                  <h2>Últimos relatos</h2>
                </div>
              </div>
              {recentes.map(item => (
                <div className="priority-case" key={item.id}>
                  <span className={riskClass(item.risk)}>{RISK_LABEL[item.risk]}</span>
                  <div>
                    <strong>{STATUS_LABEL[item.status]}</strong>
                    <small>{item.protocol}</small>
                  </div>
                  <b>{formatDate(item.created_at)}</b>
                </div>
              ))}
            </section>
          </div>
        ) : (
          <div className="placeholder">
            <span>◇</span>
            <small>CANAL ATIVO</small>
            <h2>Nenhum relato recebido ainda.</h2>
            <p>
              Quando alguém enviar um relato pelo canal público, ele aparecerá aqui e na caixa de
              entrada. Nada é gerado automaticamente: estes números vêm direto do banco.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
