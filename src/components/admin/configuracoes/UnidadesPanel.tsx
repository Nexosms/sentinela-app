import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/org/context";
import { formatCnpj, settingsHref, type SettingsFilters } from "@/lib/admin/configuracoes";
import { AlternarUnidadeForm, UnidadeForm, type Unidade } from "./SettingsControls";

/**
 * Unidades da organização: listar, criar, editar e ativar/desativar.
 *
 * Não existe excluir — e a ausência é deliberada, não um esquecimento. Não há
 * policy de DELETE em `org_units`, e não deveria haver: todo relato aponta para
 * a unidade em que aconteceu, e apagar a linha deixaria o histórico e o
 * indicador por unidade sem referência. Desativar tira do formulário público
 * sem mexer no passado.
 *
 * A edição abre por `?unidade=<id>` em vez de um formulário inline por linha:
 * mantém a tela como Server Component, torna o estado compartilhável por link
 * e evita montar quinze formulários que ninguém vai usar.
 */
export default async function UnidadesPanel({
  filters,
  readOnly = false,
}: {
  filters: SettingsFilters;
  readOnly?: boolean;
}) {
  const staff = await getStaffContext();
  const supabase = await createClient();

  const { data } = await supabase
    .from("org_units")
    .select("id, code, name, city, state_uf, cnpj, headcount, sort_order, is_active")
    .eq("org_id", staff.orgId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const unidades: Unidade[] = data ?? [];
  const emEdicao = filters.unidade && filters.unidade !== "nova"
    ? unidades.find(unidade => unidade.id === filters.unidade)
    : undefined;
  const ativas = unidades.filter(unidade => unidade.is_active).length;

  return (
    <>
      <div className="list-head">
        <span>
          {unidades.length} unidade{unidades.length === 1 ? "" : "s"} cadastrada
          {unidades.length === 1 ? "" : "s"}
        </span>
        <small>{ativas} aparecem hoje no formulário público</small>
      </div>

      <div className="file-list">
        {unidades.map(unidade => (
          <div key={unidade.id}>
            <span>{unidade.is_active ? "▣" : "▢"}</span>
            <b>
              {unidade.name}
              <small>
                {unidade.code}
                {unidade.city ? ` · ${unidade.city}` : ""}
                {unidade.state_uf ? `/${unidade.state_uf}` : ""}
                {unidade.headcount != null ? ` · ${unidade.headcount} pessoas` : ""}
                {unidade.cnpj ? ` · ${formatCnpj(unidade.cnpj)}` : ""}
              </small>
              {unidade.is_active ? null : (
                <small>
                  Desativada: não aparece no formulário público. Os relatos já vinculados continuam.
                </small>
              )}
            </b>
            {readOnly ? null : (
              <>
                <Link
                  href={settingsHref("unidades", { unidade: unidade.id })}
                  aria-label={`Editar a unidade ${unidade.name}`}
                  title="Editar"
                >
                  ✎
                </Link>
                <AlternarUnidadeForm unidade={unidade} />
              </>
            )}
          </div>
        ))}
        {unidades.length === 0 ? (
          <div>
            <span>▢</span>
            <b>
              Nenhuma unidade cadastrada
              <small>
                Sem unidade, o formulário público oferece só “Não sei informar” — e o relatório por
                unidade fica vazio.
              </small>
            </b>
          </div>
        ) : null}
      </div>

      {readOnly ? null : (
        <>
          <div className="privacy-note">
            <b>{emEdicao ? `Editando: ${emEdicao.name}` : "Nova unidade"}</b>
            <p>
              A unidade escolhida no relato é o eixo de quase todo relatório — e é ela que decide se
              uma célula fica abaixo do limiar de supressão. Unidade muito pequena tende a ter os
              números suprimidos, o que é proteção, não falha.
              {emEdicao ? (
                <>
                  {" "}
                  <Link className="quiet-link" href={settingsHref("unidades")}>
                    Cancelar a edição e criar uma nova.
                  </Link>
                </>
              ) : null}
            </p>
          </div>

          <UnidadeForm key={emEdicao?.id ?? "nova"} unidade={emEdicao} />
        </>
      )}
    </>
  );
}
