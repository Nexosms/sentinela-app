import type { Metadata } from "next";
import AdminTopbar from "@/components/admin/AdminTopbar";
import { createClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/org/context";

export const metadata: Metadata = { title: "Visão geral" };

const STATUS_LABEL: Record<string, string> = {
  em_triagem: "Em triagem",
  em_apuracao: "Em apuração",
  aguardando_informacao: "Aguardando informação",
  concluida: "Concluída",
  arquivada: "Arquivada",
};

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

  // Tudo sob RLS: cada papel conta apenas o que enxerga.
  const [abertos, triagem, criticos, total] = await Promise.all([
    supabase.from("reports").select("id", { count: "exact", head: true })
      .not("status", "in", "(concluida,arquivada)"),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "em_triagem"),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("risk", "critico")
      .not("status", "in", "(concluida,arquivada)"),
    supabase.from("reports").select("id", { count: "exact", head: true }),
  ]);

  const { data: recentes } = await supabase
    .from("reports")
    .select("id, protocol, status, risk, created_at")
    .order("created_at", { ascending: false })
    .limit(3);

  const firstName = staff.fullName.split(" ")[0];
  const abertosCount = abertos.count ?? 0;
  const criticosCount = criticos.count ?? 0;

  return (
    <>
      <AdminTopbar eyebrow="VISÃO OPERACIONAL" title="Visão geral" unreadCount={0} />
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
                  <span className={`risk ${item.risk}`}>{item.risk}</span>
                  <div>
                    <strong>{STATUS_LABEL[item.status] ?? item.status}</strong>
                    <small>{item.protocol}</small>
                  </div>
                  <b>
                    {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
                      new Date(item.created_at),
                    )}
                  </b>
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
