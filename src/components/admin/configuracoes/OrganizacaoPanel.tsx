import { createClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/org/context";
import { OrganizacaoForm, type Organizacao } from "./SettingsControls";

/**
 * Dados da organização. Server Component: lê sob RLS (`org_read`) e entrega o
 * formulário, que é a única folha cliente.
 */
export default async function OrganizacaoPanel() {
  const staff = await getStaffContext();
  const supabase = await createClient();

  const { data } = await supabase
    .from("organizations")
    .select(
      "legal_name, trade_name, cnpj, timezone, sla_triagem_hours, sla_apuracao_hours, retention_months, min_cell_size",
    )
    .eq("id", staff.orgId)
    .maybeSingle();

  if (!data) {
    return (
      <div className="risk-banner">
        <span>!</span>
        <div>
          <strong>Organização fora de alcance</strong>
          <p>
            A política `org_read` não devolveu a linha desta organização. Recarregue a página; se
            persistir, o vínculo em `org_members` pode ter sido revogado.
          </p>
        </div>
      </div>
    );
  }

  const org: Organizacao = data;

  // O resumo vem ANTES do formulário de propósito: `.review-grid` não tem
  // margem própria no design system, e o primeiro `.field-grid` do formulário
  // traz `margin-top:24px` — a ordem resolve o espaçamento sem CSS novo, e de
  // quebra a tela lê como "isto é o que vale hoje" seguido de "mude aqui".
  return (
    <>
      <div className="review-grid">
        <article>
          <small>PRAZO DE TRIAGEM</small>
          <strong>{org.sla_triagem_hours} h</strong>
          <p>
            Tempo máximo entre o relato chegar e alguém classificá-lo. É contra este número que o
            relatório de Tempos e SLA marca atraso.
          </p>
        </article>
        <article>
          <small>PRAZO DE APURAÇÃO</small>
          <strong>{org.sla_apuracao_hours} h</strong>
          <p>
            Tempo máximo até a conclusão do caso. Equivale a {Math.round(org.sla_apuracao_hours / 24)}{" "}
            dias corridos.
          </p>
        </article>
        <article>
          <small>RETENÇÃO</small>
          <strong>{org.retention_months} meses</strong>
          <p>
            Depois disso, um caso encerrado entra na lista de expurgo do cron de retenção. A trilha
            de auditoria nunca é expurgada.
          </p>
        </article>
        <article>
          <small>LIMIAR DE SUPRESSÃO</small>
          <strong>{org.min_cell_size}</strong>
          <p>
            Célula de relatório com menos de {org.min_cell_size} ocorrências vira “—” e sai do CSV.
          </p>
        </article>
      </div>
      <OrganizacaoForm org={org} />
    </>
  );
}
