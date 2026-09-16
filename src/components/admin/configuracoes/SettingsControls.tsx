"use client";

import { useActionState } from "react";

import {
  alterarPapel,
  alterarSituacaoMembro,
  alternarCategoria,
  alternarUnidade,
  atualizarPermissoesPapel,
  criarCategoria,
  criarUnidade,
  removerMembro,
  salvarCategoria,
  salvarOrganizacao,
  salvarUnidade,
  type ActionState,
} from "@/app/admin/configuracoes/actions";
import {
  CATEGORY_GROUP_LABEL,
  CATEGORY_GROUP_ORDER,
  MEMBER_STATUS_LABEL,
  MIN_CELL_SIZE_FLOOR,
  RISK_LABEL,
  RISK_ORDER,
  ROLE_DESCRIPTION,
  ROLE_ORDER,
  TIMEZONES,
  UFS,
  formatCnpj,
  type AppRole,
  type CategoryGroup,
  type MemberStatus,
  type RiskLevel,
} from "@/lib/admin/configuracoes";
import { roleLabel } from "@/lib/admin/labels";
import { CONFIGURABLE_NAV_ITEMS, isNavVisible, type NavOverrides } from "@/lib/admin/navItems";

/**
 * As folhas interativas de Configurações. São client components pelo
 * `useActionState`, exatamente como `PlanControls` — é o que permite mostrar o
 * erro da ação sem transformar a página em cliente, e cada uma continua sendo
 * um `<form action=…>` de verdade.
 *
 * Nenhuma decide acesso. O que some da tela some por cortesia; quem recusa são
 * `org_update`, `units_*`, `categories_*` e `members_update`.
 */

const EMPTY: ActionState = {};

function Feedback({ state }: { state: ActionState }) {
  return (
    <>
      {state.error ? <span className="field-error-message">{state.error}</span> : null}
      {state.aviso ? (
        <div className="care-note">
          <span>✓</span>
          <div>
            <strong>Registrado</strong>
            <small>{state.aviso}</small>
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * `<select>` é não controlado: nem o re-render nem o reset automático do React
 * reescrevem o valor de um. Sem uma `key` que mude junto com o eco, a escolha
 * recusada some da tela e a pessoa refaz tudo. Mesmo remédio dos outros módulos.
 */
function formKey(eco: Record<string, string>, ...serverValues: (string | null)[]): string {
  return [...serverValues.map(value => value ?? ""), JSON.stringify(eco)].join("|");
}

// ── Organização ──────────────────────────────────────────────────────────────

export type Organizacao = {
  legal_name: string;
  trade_name: string;
  cnpj: string | null;
  timezone: string;
  sla_triagem_hours: number;
  sla_apuracao_hours: number;
  retention_months: number;
  min_cell_size: number;
};

export function OrganizacaoForm({ org }: { org: Organizacao }) {
  const [state, action, pending] = useActionState(salvarOrganizacao, EMPTY);
  const eco = state.enviado ?? {};
  const value = (name: keyof Organizacao, fallback: string) => eco[name] ?? fallback;

  return (
    <form action={action} key={formKey(eco, org.timezone)}>
      <div className="field-grid two">
        <label>
          Razão social
          <input
            name="legal_name"
            defaultValue={value("legal_name", org.legal_name)}
            placeholder="Nome registrado na Receita Federal"
            required
          />
        </label>
        <label>
          Nome fantasia
          <input
            name="trade_name"
            defaultValue={value("trade_name", org.trade_name)}
            placeholder="Como a empresa é conhecida"
            required
          />
        </label>
      </div>

      {/* O nome fantasia não é enfeite de cadastro: é o que a equipe lê o dia
          inteiro no canto superior esquerdo. Dizer isso na tela evita o
          "Organização" genérico ficar para sempre. */}
      <div className="privacy-note">
        <b>É este nome que a equipe vê</b>
        <p>
          O <strong>nome fantasia</strong> aparece na barra lateral do painel, logo abaixo do papel
          de quem está logado. Hoje ela mostra <strong>{org.trade_name}</strong>. Salvar aqui muda
          para todo mundo da organização.
        </p>
      </div>

      <div className="field-grid two">
        <label>
          CNPJ
          <input
            name="cnpj"
            inputMode="numeric"
            defaultValue={eco.cnpj ?? (org.cnpj ?? "")}
            placeholder="00.000.000/0000-00"
            aria-describedby="cnpj-hint"
          />
        </label>
        <label>
          Fuso horário
          <select name="timezone" defaultValue={value("timezone", org.timezone)}>
            {TIMEZONES.map(zone => (
              <option key={zone.value} value={zone.value}>
                {zone.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prazo de triagem (horas)
          <input
            name="sla_triagem_hours"
            type="number"
            min={1}
            max={8760}
            defaultValue={value("sla_triagem_hours", String(org.sla_triagem_hours))}
            required
          />
        </label>
        <label>
          Prazo de apuração (horas)
          <input
            name="sla_apuracao_hours"
            type="number"
            min={1}
            max={8760}
            defaultValue={value("sla_apuracao_hours", String(org.sla_apuracao_hours))}
            required
          />
        </label>
        <label>
          Retenção de dados (meses)
          <input
            name="retention_months"
            type="number"
            min={12}
            max={240}
            defaultValue={value("retention_months", String(org.retention_months))}
            required
          />
        </label>
        <label>
          Limiar de supressão em relatórios
          <input
            name="min_cell_size"
            type="number"
            min={MIN_CELL_SIZE_FLOOR}
            max={100}
            defaultValue={value("min_cell_size", String(org.min_cell_size))}
            required
            aria-describedby="min-cell-hint"
          />
        </label>
      </div>

      <p id="cnpj-hint" className="lead">
        CNPJ atual: <strong>{formatCnpj(org.cnpj)}</strong>. Pode digitar com pontuação — só os 14
        dígitos são guardados, e os dígitos verificadores são conferidos antes de salvar.
      </p>

      {/* Explicação embutida, não rótulo. Quem mexe neste campo precisa saber
          o que está trocando por "mais detalhe no relatório". */}
      <div className="privacy-note" id="min-cell-hint">
        <b>O que o limiar de supressão faz — leia antes de baixá-lo</b>
        <p>
          Toda célula de relatório com menos ocorrências que este número vira <strong>“—”</strong> e
          sai do CSV. Com o valor em <strong>{org.min_cell_size}</strong>, uma linha “unidade × mês”
          com {org.min_cell_size - 1} ou menos relatos não é exibida a ninguém.
        </p>
        <p>
          <strong>Baixar este número aumenta o risco de reidentificar quem denunciou.</strong> Numa
          unidade com dois funcionários, uma célula mostrando “1 relato de assédio” é, na prática, o
          nome da pessoa para o gestor que lê o relatório. Por isso o sistema recusa qualquer valor
          menor que {MIN_CELL_SIZE_FLOOR}, e registra na trilha de auditoria o valor antigo e o novo
          sempre que ele muda.
        </p>
      </div>

      <div className="case-actions">
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar organização"} <span>→</span>
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

// ── Unidades ─────────────────────────────────────────────────────────────────

export type Unidade = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  state_uf: string | null;
  cnpj: string | null;
  headcount: number | null;
  sort_order: number;
  is_active: boolean;
};

export function UnidadeForm({ unidade }: { unidade?: Unidade }) {
  const [state, action, pending] = useActionState(
    unidade ? salvarUnidade : criarUnidade,
    EMPTY,
  );
  const eco = state.enviado ?? {};

  return (
    <form action={action} key={formKey(eco, unidade?.id ?? "nova", unidade?.state_uf ?? "")}>
      {unidade ? <input type="hidden" name="id" value={unidade.id} /> : null}
      <div className="field-grid two">
        <label>
          Código
          <input
            name="code"
            defaultValue={eco.code ?? unidade?.code ?? ""}
            placeholder="MATRIZ"
            required
          />
        </label>
        <label>
          Nome da unidade
          <input
            name="name"
            defaultValue={eco.name ?? unidade?.name ?? ""}
            placeholder="Matriz — São Paulo"
            required
          />
        </label>
        <label>
          Cidade
          <input name="city" defaultValue={eco.city ?? unidade?.city ?? ""} />
        </label>
        <label>
          UF
          <select name="state_uf" defaultValue={eco.state_uf ?? unidade?.state_uf ?? ""}>
            <option value="">Não informar</option>
            {UFS.map(uf => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </label>
        <label>
          CNPJ da unidade
          <input
            name="cnpj"
            inputMode="numeric"
            defaultValue={eco.cnpj ?? unidade?.cnpj ?? ""}
            placeholder="Opcional"
          />
        </label>
        <label>
          Efetivo
          <input
            name="headcount"
            type="number"
            min={0}
            defaultValue={eco.headcount ?? (unidade?.headcount != null ? String(unidade.headcount) : "")}
            placeholder="Opcional"
          />
        </label>
        <label>
          Ordem na lista
          <input
            name="sort_order"
            type="number"
            defaultValue={eco.sort_order ?? String(unidade?.sort_order ?? 0)}
          />
        </label>
      </div>

      <div className="case-actions">
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "Salvando…" : unidade ? "Salvar unidade" : "Criar unidade"} <span>→</span>
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/** Ativar/desativar. Não há DELETE: relatos apontam para a unidade. */
export function AlternarUnidadeForm({ unidade }: { unidade: Unidade }) {
  const [state, action, pending] = useActionState(alternarUnidade, EMPTY);

  // O formulário vive dentro de uma linha de `.file-list`, cujo `<form>` é
  // `display:contents`. Só o erro sai aqui: o sucesso já se vê na própria
  // linha, que muda de estado quando a página revalida.
  return (
    <form action={action}>
      <input type="hidden" name="id" value={unidade.id} />
      <input type="hidden" name="ativar" value={unidade.is_active ? "false" : "true"} />
      <button
        type="submit"
        disabled={pending}
        title={unidade.is_active ? "Desativar unidade" : "Reativar unidade"}
        aria-label={`${unidade.is_active ? "Desativar" : "Reativar"} a unidade ${unidade.name}`}
      >
        {unidade.is_active ? "⊘" : "⟳"}
      </button>
      {state.error ? <small className="field-error-message">{state.error}</small> : null}
    </form>
  );
}

// ── Categorias ───────────────────────────────────────────────────────────────

export type Categoria = {
  id: string;
  org_id: string | null;
  code: string;
  label_pt: string;
  description_pt: string | null;
  group_key: CategoryGroup;
  default_risk: RiskLevel;
  nr_reference: string | null;
  requires_specification: boolean;
  sort_order: number;
  is_active: boolean;
};

export function CategoriaForm({ categoria }: { categoria?: Categoria }) {
  const [state, action, pending] = useActionState(
    categoria ? salvarCategoria : criarCategoria,
    EMPTY,
  );
  const eco = state.enviado ?? {};

  return (
    <form
      action={action}
      key={formKey(eco, categoria?.id ?? "nova", categoria?.group_key ?? "", categoria?.default_risk ?? "")}
    >
      {categoria ? <input type="hidden" name="id" value={categoria.id} /> : null}
      <div className="field-grid two">
        <label>
          Rótulo no formulário público
          <input
            name="label_pt"
            defaultValue={eco.label_pt ?? categoria?.label_pt ?? ""}
            placeholder="Ex.: Descumprimento do código de conduta comercial"
            required
          />
        </label>
        <label>
          Código
          <input
            name="code"
            defaultValue={eco.code ?? categoria?.code ?? ""}
            placeholder="deixe em branco para gerar do rótulo"
            readOnly={Boolean(categoria)}
          />
        </label>
        <label>
          Grupo
          <select name="group_key" defaultValue={eco.group_key ?? categoria?.group_key ?? "violencia_conduta"}>
            {CATEGORY_GROUP_ORDER.map(group => (
              <option key={group} value={group}>
                {CATEGORY_GROUP_LABEL[group]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Risco padrão na triagem
          <select name="default_risk" defaultValue={eco.default_risk ?? categoria?.default_risk ?? "baixo"}>
            {RISK_ORDER.map(risk => (
              <option key={risk} value={risk}>
                {RISK_LABEL[risk]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Referência normativa
          <input
            name="nr_reference"
            defaultValue={eco.nr_reference ?? categoria?.nr_reference ?? ""}
            placeholder="Ex.: Código de conduta interno, art. 12"
          />
        </label>
        <label>
          Ordem na lista
          <input
            name="sort_order"
            type="number"
            defaultValue={eco.sort_order ?? String(categoria?.sort_order ?? 900)}
          />
        </label>
      </div>

      <label className="wide-field">
        Descrição de apoio
        <textarea
          name="description_pt"
          rows={3}
          defaultValue={eco.description_pt ?? categoria?.description_pt ?? ""}
          placeholder="A frase que ajuda quem vai denunciar a reconhecer a situação."
        />
      </label>

      {/* `requires_specification` liga um campo real no formulário público. */}
      <label className="check-row">
        <input
          type="checkbox"
          name="requires_specification"
          defaultChecked={
            eco.requires_specification !== undefined
              ? eco.requires_specification === "on"
              : (categoria?.requires_specification ?? false)
          }
        />
        Pedir que a pessoa <strong>especifique</strong> ao escolher esta categoria — liga o campo
        “especificar” no formulário público. Use em categorias amplas (“Outro”, “Assédio — outros
        casos”), em que só o rótulo não diz o que aconteceu.
      </label>

      <div className="case-actions">
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "Salvando…" : categoria ? "Salvar categoria" : "Criar categoria"} <span>→</span>
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function AlternarCategoriaForm({ categoria }: { categoria: Categoria }) {
  const [state, action, pending] = useActionState(alternarCategoria, EMPTY);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={categoria.id} />
      <input type="hidden" name="ativar" value={categoria.is_active ? "false" : "true"} />
      <button
        type="submit"
        disabled={pending}
        title={categoria.is_active ? "Desativar categoria" : "Reativar categoria"}
        aria-label={`${categoria.is_active ? "Desativar" : "Reativar"} a categoria ${categoria.label_pt}`}
      >
        {categoria.is_active ? "⊘" : "⟳"}
      </button>
      {state.error ? <small className="field-error-message">{state.error}</small> : null}
    </form>
  );
}

// ── Equipe ───────────────────────────────────────────────────────────────────

export type Membro = {
  id: string;
  user_id: string;
  role: AppRole;
  status: MemberStatus;
  full_name: string;
  email: string;
  invited_at: string;
  activated_at: string | null;
};

export function PapelForm({
  membro,
  ehVoce,
  ultimoAdmin,
}: {
  membro: Membro;
  ehVoce: boolean;
  ultimoAdmin: boolean;
}) {
  const [state, action, pending] = useActionState(alterarPapel, EMPTY);
  const eco = state.enviado ?? {};

  return (
    <form action={action} key={formKey(eco, membro.role)}>
      <input type="hidden" name="id" value={membro.id} />
      <div className="field-grid">
        <label>
          Papel de {membro.full_name}
          <select name="role" defaultValue={eco.role ?? membro.role}>
            {ROLE_ORDER.map(role => (
              <option key={role} value={role}>
                {roleLabel(role)} — {ROLE_DESCRIPTION[role]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {ultimoAdmin ? (
        <div className="risk-banner">
          <span>!</span>
          <div>
            <strong>
              {ehVoce ? "Você é" : `${membro.full_name} é`} o último administrador ativo
            </strong>
            <p>
              Rebaixar ou suspender este vínculo deixaria a organização sem ninguém capaz de abrir
              Configurações, convidar pessoas ou desfazer a mudança. A ação será recusada até que
              outra pessoa tenha o papel Administração.
            </p>
          </div>
        </div>
      ) : null}

      <div className="case-actions">
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Alterar papel"} <span>→</span>
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function SituacaoForm({ membro }: { membro: Membro }) {
  const [state, action, pending] = useActionState(alterarSituacaoMembro, EMPTY);
  const suspender = membro.status === "active";

  return (
    <>
      <form action={action}>
        <input type="hidden" name="id" value={membro.id} />
        <input type="hidden" name="status" value={suspender ? "suspended" : "active"} />
        <div className="case-actions">
          <button type="submit" disabled={pending}>
            {pending
              ? "Aplicando…"
              : suspender
                ? "Suspender acesso"
                : membro.status === "invited"
                  ? "Liberar acesso agora"
                  : "Reativar acesso"}
          </button>
        </div>
      </form>
      <p className="lead">
        Situação atual: <strong>{MEMBER_STATUS_LABEL[membro.status]}</strong>.
        {membro.status === "invited"
          ? " O convite foi enviado e o vínculo já existe; a pessoa entra sozinha ao definir a senha pelo link do convite. Liberar aqui só é necessário se ela não conseguir usar o link."
          : ""}
      </p>
      <Feedback state={state} />
    </>
  );
}

/**
 * Remover é diferente de suspender: some da lista, e só volta com um convite
 * novo. Por isso o `confirm()` nativo antes de enviar — mesmo padrão de
 * fricção extra que uma exclusão pede, sem precisar de um modal próprio.
 */
export function RemoverForm({ membro }: { membro: Membro }) {
  const [state, action, pending] = useActionState(removerMembro, EMPTY);

  return (
    <>
      <form
        action={action}
        onSubmit={event => {
          const confirmado = window.confirm(
            `Remover ${membro.full_name} do time? A pessoa perde o acesso a esta organização agora, e só volta com um convite novo.`,
          );
          if (!confirmado) event.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={membro.id} />
        <div className="case-actions">
          <button type="submit" disabled={pending}>
            {pending ? "Removendo…" : "Remover do time"}
          </button>
        </div>
      </form>
      <Feedback state={state} />
    </>
  );
}

// ── Permissões por cargo ─────────────────────────────────────────────────────

/**
 * Uma por cargo não-admin. Admin nunca aparece aqui — `role_nav_permissions`
 * recusa a linha (`role_nav_permissions_not_admin`) e `isNavVisible()` nunca
 * filtra o papel Administração, então não haveria o que configurar.
 */
/** Só para caber nas duas colunas de `.category-groups` — sem significado além disso. */
const NAV_ITEM_COLUMNS = [
  { title: "Fluxo de trabalho", items: CONFIGURABLE_NAV_ITEMS.slice(0, 3) },
  { title: "Gestão e leitura", items: CONFIGURABLE_NAV_ITEMS.slice(3) },
];

export function PermissoesForm({ role, overrides }: { role: AppRole; overrides: NavOverrides }) {
  const [state, action, pending] = useActionState(atualizarPermissoesPapel, EMPTY);

  return (
    <form action={action}>
      <input type="hidden" name="role" value={role} />
      <fieldset className="category-multiselect">
        <legend>{roleLabel(role)}</legend>
        <p>{ROLE_DESCRIPTION[role]}</p>
        <div className="category-groups">
          {NAV_ITEM_COLUMNS.map(coluna => (
            <section key={coluna.title}>
              <h3>{coluna.title}</h3>
              {coluna.items.map(item => (
                <label key={item.key}>
                  <input
                    type="checkbox"
                    name="nav_key"
                    value={item.key}
                    defaultChecked={isNavVisible(role, item, overrides)}
                  />
                  {item.label}
                </label>
              ))}
            </section>
          ))}
        </div>
      </fieldset>
      <div className="case-actions">
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "Salvando…" : `Salvar permissões de ${roleLabel(role)}`} <span>→</span>
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}
