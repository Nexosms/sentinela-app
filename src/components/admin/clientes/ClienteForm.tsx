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
              : "O e-mail não pôde ser enviado por este projeto Supabase — entregue o link de acesso abaixo você mesmo."}
          </small>

          {state.relatoUrl ? (
            <div className="privacy-note" style={{ marginTop: 14, borderColor: "var(--teal)" }}>
              <b>Link do relato — dê este aos colaboradores da empresa</b>
              <p>
                É este que a empresa divulga para quem vai registrar um relato. Não expira e pode ser
                usado por qualquer pessoa, quantas vezes for preciso.
              </p>
              <label className="wide-field">
                Link
                <textarea readOnly rows={2} value={state.relatoUrl} aria-label="Link do relato" />
              </label>
            </div>
          ) : null}

          {state.inviteUrl ? (
            <div className="privacy-note" style={{ marginTop: 14 }}>
              <b>Link de acesso do contato — uso único, só para ele entrar no painel</b>
              <p>
                Diferente do link do relato acima: este é só para{" "}
                <strong>a pessoa cadastrada como contato</strong> definir a própria senha e acessar o
                painel administrativo (papel Comitê). Vale uma vez e expira.
              </p>
              <label className="wide-field">
                Link
                <textarea readOnly rows={3} value={state.inviteUrl} aria-label="Link de acesso do contato" />
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
          CPF, CNPJ ou CAEPF
          <input name="cnpj" maxLength={18} placeholder="Só números (opcional)" />
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
          <input name="contactName" maxLength={120} placeholder="Nome e sobrenome (opcional)" />
        </label>
        <label>
          E-mail do primeiro contato
          <input
            name="contactEmail"
            type="email"
            maxLength={320}
            placeholder="pessoa@empresa.com.br (opcional)"
          />
        </label>
      </div>
      <label className="wide-field">
        Endereço
        <textarea
          name="address"
          rows={2}
          maxLength={300}
          placeholder="Rua, número, bairro, cidade - UF (opcional)"
        />
      </label>
      <p className="lead" style={{ fontSize: 13 }}>
        O contato é opcional agora — pode ser adicionado depois, na tela da empresa. Quando
        cadastrado, entra com o papel Comitê (só leitura de indicadores, relatórios e auditoria);
        ajuste o que ele enxerga em Configurações → Time e permissões.
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
