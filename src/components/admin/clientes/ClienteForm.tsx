"use client";

import { useActionState, useState } from "react";

import { criarEmpresaCliente, type ActionState } from "@/app/admin/clientes/actions";
import { trocarOrganizacaoAtiva } from "@/lib/org/actions";

const EMPTY: ActionState = {};

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function ClienteForm() {
  const [state, action, pending] = useActionState(criarEmpresaCliente, EMPTY);
  const [slug, setSlug] = useState("");
  const [slugTocado, setSlugTocado] = useState(false);

  if (state.ok) {
    return (
      <div className="care-note">
        <span>✓</span>
        <div>
          <strong>{"Empresa cadastrada"}</strong>
          <small>
            {state.emailSent
              ? "O contato recebeu um e-mail para definir a própria senha."
              : "O e-mail não pôde ser enviado por este projeto Supabase — entregue o link abaixo você mesmo."}
          </small>
          {state.inviteUrl ? (
            <div className="privacy-note" style={{ marginTop: 14 }}>
              <b>Link de convite do contato — copie e mande você mesmo</b>
              <label className="wide-field">
                Link
                <textarea readOnly rows={3} value={state.inviteUrl} aria-label="Link de convite" />
              </label>
            </div>
          ) : null}
          {state.novaOrgId ? (
            <form action={trocarOrganizacaoAtiva} style={{ marginTop: 14 }}>
              <input type="hidden" name="orgId" value={state.novaOrgId} />
              <button className="primary-button" type="submit">
                Entrar em {state.novaOrgSlug} <span>→</span>
              </button>
            </form>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <form action={action}>
      <div className="field-grid two">
        <label>
          Nome fantasia
          <input
            name="tradeName"
            required
            maxLength={120}
            placeholder="Acme"
            onChange={event => {
              if (!slugTocado) setSlug(slugify(event.target.value));
            }}
          />
        </label>
        <label>
          Razão social
          <input name="legalName" required maxLength={160} placeholder="Acme Indústria e Comércio Ltda." />
        </label>
        <label>
          CNPJ
          <input name="cnpj" maxLength={18} placeholder="00.000.000/0000-00" />
        </label>
        <label>
          Slug do link (vira /relato/&lt;slug&gt;)
          <input
            name="slug"
            required
            maxLength={40}
            placeholder="acme"
            value={slug}
            onChange={event => {
              setSlugTocado(true);
              setSlug(event.target.value);
            }}
          />
        </label>
        <label>
          Nome do primeiro contato
          <input name="contactName" required maxLength={120} placeholder="Nome e sobrenome" />
        </label>
        <label>
          E-mail do primeiro contato
          <input
            name="contactEmail"
            type="email"
            required
            maxLength={320}
            placeholder="pessoa@empresa.com.br"
          />
        </label>
      </div>
      <p className="lead" style={{ fontSize: 13 }}>
        O contato entra com o papel Comitê (só leitura de indicadores, relatórios e auditoria).
        Ajuste o que ele enxerga depois, dentro da organização nova, em Configurações → Time e
        permissões.
      </p>
      {state.error ? <span className="field-error-message">{state.error}</span> : null}
      <div className="case-actions">
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "Cadastrando…" : "Cadastrar empresa"} <span>→</span>
        </button>
      </div>
    </form>
  );
}
