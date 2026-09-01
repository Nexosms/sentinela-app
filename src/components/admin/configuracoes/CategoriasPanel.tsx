import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/org/context";
import {
  CATEGORY_GROUP_LABEL,
  CATEGORY_GROUP_ORDER,
  RISK_LABEL,
  riskClass,
  settingsHref,
  type SettingsFilters,
} from "@/lib/admin/configuracoes";
import { AlternarCategoriaForm, CategoriaForm, type Categoria } from "./SettingsControls";

/**
 * Taxonomia de categorias.
 *
 * Duas populações moram na mesma tabela e se distinguem por uma coluna:
 *
 *  - `org_id IS NULL` — as 19 do catálogo regulatório (NR-01, NR-05 e a Lei
 *    14.457). São somente-leitura para QUALQUER organização, e não por escolha
 *    de tela: as policies `categories_insert` e `categories_update` exigem
 *    `org_id IS NOT NULL`. Um UPDATE numa delas afeta zero linhas e não levanta
 *    erro. Elas são o vocabulário comum que faz o inventário de fatores de
 *    risco psicossociais comparável entre empresas — se cada organização
 *    renomeasse "Sobrecarga de trabalho", o Grupo B deixaria de ser inventário.
 *  - `org_id` preenchido — as da organização, criadas aqui.
 */
export default async function CategoriasPanel({ filters }: { filters: SettingsFilters }) {
  const staff = await getStaffContext();
  const supabase = await createClient();

  // `categories_read` já devolve as globais (org_id nulo) e as da organização.
  const { data } = await supabase
    .from("categories")
    .select(
      "id, org_id, code, label_pt, description_pt, group_key, default_risk, nr_reference, requires_specification, sort_order, is_active",
    )
    .order("sort_order", { ascending: true })
    .order("label_pt", { ascending: true });

  const todas: Categoria[] = data ?? [];
  const globais = todas.filter(categoria => categoria.org_id === null);
  const proprias = todas.filter(categoria => categoria.org_id === staff.orgId);
  const emEdicao =
    filters.categoria && filters.categoria !== "nova"
      ? proprias.find(categoria => categoria.id === filters.categoria)
      : undefined;

  return (
    <>
      <div className="privacy-note">
        <b>As {globais.length} categorias do catálogo são de leitura</b>
        <p>
          Elas vêm da <strong>NR-01</strong> (gerenciamento de riscos ocupacionais, com os fatores
          psicossociais do Grupo B), da <strong>NR-05</strong> (CIPA) e da{" "}
          <strong>Lei 14.457/2022</strong>. Não pertencem a nenhuma organização — é isso que faz o
          inventário de fatores de risco ser comparável entre empresas e aceito numa fiscalização.
          O banco recusa alterá-las: a política exige que a categoria tenha dono, e as do catálogo
          não têm. Precisa de algo que o catálogo não cobre? Crie uma categoria própria abaixo.
        </p>
      </div>

      {CATEGORY_GROUP_ORDER.map(group => {
        const doGrupo = globais.filter(categoria => categoria.group_key === group);
        if (doGrupo.length === 0) return null;
        return (
          <div key={group}>
            <div className="list-head">
              <span>{CATEGORY_GROUP_LABEL[group]}</span>
              <small>{doGrupo.length} itens · catálogo regulatório, somente leitura</small>
            </div>
            <div className="file-list">
              {doGrupo.map(categoria => (
                <div key={categoria.id}>
                  <span>🔒</span>
                  <b>
                    {categoria.label_pt}
                    <small>
                      {categoria.nr_reference ?? "Catálogo global"} · {categoria.code}
                      {categoria.requires_specification ? " · pede especificação" : ""}
                    </small>
                  </b>
                  <span className={riskClass(categoria.default_risk)}>
                    {RISK_LABEL[categoria.default_risk]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="list-head">
        <span>Categorias desta organização</span>
        <small>
          {proprias.length === 0
            ? "nenhuma criada até agora"
            : `${proprias.length} criada${proprias.length === 1 ? "" : "s"} por ${staff.orgName}`}
        </small>
      </div>

      <div className="file-list">
        {proprias.map(categoria => (
          <div key={categoria.id}>
            <span>{categoria.is_active ? "◈" : "◇"}</span>
            <b>
              {categoria.label_pt}
              <small>
                {CATEGORY_GROUP_LABEL[categoria.group_key]} · {categoria.code}
                {categoria.requires_specification ? " · pede especificação" : ""}
              </small>
              {categoria.is_active ? null : (
                <small>Desativada: não aparece no formulário público.</small>
              )}
            </b>
            <span className={riskClass(categoria.default_risk)}>
              {RISK_LABEL[categoria.default_risk]}
            </span>
            <Link
              href={settingsHref("categorias", { categoria: categoria.id })}
              aria-label={`Editar a categoria ${categoria.label_pt}`}
              title="Editar"
            >
              ✎
            </Link>
            <AlternarCategoriaForm categoria={categoria} />
          </div>
        ))}
        {proprias.length === 0 ? (
          <div>
            <span>◇</span>
            <b>
              Nenhuma categoria própria
              <small>
                O catálogo cobre a maior parte dos casos. Crie uma própria só quando o vocabulário
                da organização exigir — cada categoria a mais divide o inventário em fatias menores,
                e fatia pequena é fatia suprimida no relatório.
              </small>
            </b>
          </div>
        ) : null}
      </div>

      <div className="privacy-note">
        <b>{emEdicao ? `Editando: ${emEdicao.label_pt}` : "Nova categoria da organização"}</b>
        <p>
          O código é gerado do rótulo e não muda depois de criado — ele é a chave que liga o relato
          ao inventário de riscos, e trocá-la reescreveria o histórico.
          {emEdicao ? (
            <>
              {" "}
              <Link className="quiet-link" href={settingsHref("categorias")}>
                Cancelar a edição e criar uma nova.
              </Link>
            </>
          ) : null}
        </p>
      </div>

      <CategoriaForm key={emEdicao?.id ?? "nova"} categoria={emEdicao} />
    </>
  );
}
