"use client";

import { useState, type ReactNode } from "react";

import {
  Alert,
  DocFile,
  ImageFile,
  Lock,
  Paperclip,
  Pencil,
  ShieldCheck,
  User,
} from "@/components/public/icons";
import { RECURRENCES, RELATIONSHIPS } from "@/lib/report/schema";

import { useWizard } from "../wizardState";

/** Relatos acima disso começam recolhidos (3 linhas) com "Ler relato completo". */
const LONG_TEXT = 220;

function sizeLabel(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return `${mb.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MB`;
}

function Block({
  icon,
  tint,
  title,
  count,
  editLabel,
  onEdit,
  warn,
  children,
}: {
  icon: ReactNode;
  tint: "wz-t-red" | "wz-t-amber";
  title: string;
  count?: number;
  editLabel: string;
  onEdit: () => void;
  warn?: boolean;
  children: ReactNode;
}) {
  return (
    <article className={`wz-rv ${warn ? "warn" : ""}`}>
      <div className="wz-rv-head">
        <span className={`wz-rv-icon ${tint}`} aria-hidden="true">
          {icon}
        </span>
        <h2>
          {title}
          {count !== undefined ? <em>{count}</em> : null}
        </h2>
        <button type="button" className="wz-edit" onClick={onEdit} aria-label={`Editar ${editLabel}`}>
          <Pencil size={16} />
          <span>Editar</span>
        </button>
      </div>
      {children}
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const text = value.trim();
  return (
    <div>
      <dt>{label}</dt>
      <dd className={text ? "" : "empty"}>{text || "Não informado"}</dd>
    </div>
  );
}

export default function Step4Revisao() {
  const { state, categories, dispatch } = useWizard();
  const [open, setOpen] = useState(false);

  const goTo = (step: number) => dispatch({ type: "goTo", step });

  const selectedCategories = categories.filter(category => state.categoryIds.includes(category.id));
  const relationship = RELATIONSHIPS.find(item => item.value === state.relationship)?.label ?? "";
  const recurrence = RECURRENCES.find(item => item.value === state.recurrence)?.label ?? "";
  const description = state.description.trim();
  const long = description.length > LONG_TEXT || description.split("\n").length > 3;
  const identified = state.mode === "identified";

  return (
    <>
      <span className="wz-kicker">REVISÃO</span>
      <h1>Revise antes de enviar.</h1>
      <p className="wz-lead">
        Depois do envio, o relato original não poderá ser alterado. Complementações ficam registradas
        como novos eventos.
      </p>

      <div className="wz-rvs">
        <Block
          icon={<User size={20} />}
          tint="wz-t-red"
          title="Modalidade"
          editLabel="modalidade"
          onEdit={() => goTo(1)}
        >
          <p className="wz-rv-val">
            <b>{identified ? "Identificada e confidencial" : "Anônima"}</b>
            {identified ? null : <i className="wz-tag ok">Sem dados pessoais</i>}
          </p>
          {identified ? (
            <dl className="wz-facts wz-facts-flat">
              <Fact label="Nome" value={state.identityName} />
              <Fact label="Contato" value={state.identityContact} />
            </dl>
          ) : null}
        </Block>

        <Block
          icon={<DocFile size={20} />}
          tint="wz-t-red"
          title="O que aconteceu"
          editLabel="o que aconteceu"
          onEdit={() => goTo(2)}
        >
          <dl className="wz-facts">
            <Fact label="Você é" value={relationship} />
            <Fact label="Frequência" value={recurrence} />
            <Fact label="Período" value={state.periodText} />
            <Fact label="Envolvidos" value={state.accused} />
            <Fact label="Testemunhas" value={state.witnesses} />
          </dl>
          {selectedCategories.length > 0 ? (
            <ul className="wz-rv-cats" aria-label="Categorias">
              {selectedCategories.map(category => (
                <li key={category.id}>{category.label}</li>
              ))}
            </ul>
          ) : (
            <p className="wz-rv-none">Não classificadas</p>
          )}
          {state.categorySpecification.trim() ? (
            <p className="wz-rv-spec">
              <b>Especificação:</b> {state.categorySpecification.trim()}
            </p>
          ) : null}
          <div className="wz-story">
            <small>RELATO</small>
            <p className={long && !open ? "clamp" : ""}>
              {description || "Nenhuma descrição informada."}
            </p>
            {long ? (
              <button
                type="button"
                className="wz-more"
                aria-expanded={open}
                onClick={() => setOpen(value => !value)}
              >
                {open ? "Mostrar menos" : "Ler relato completo"}
              </button>
            ) : null}
          </div>
        </Block>

        <Block
          icon={<Paperclip size={20} />}
          tint="wz-t-red"
          title="Anexos"
          count={state.files.length}
          editLabel="anexos"
          onEdit={() => goTo(3)}
        >
          {state.files.length > 0 ? (
            <ul className="wz-mini">
              {state.files.map(file => (
                <li key={file.clientId}>
                  <span className="wz-mini-icon wz-t-red" aria-hidden="true">
                    {file.file.type.startsWith("image/") ? <ImageFile size={18} /> : <DocFile size={18} />}
                  </span>
                  <b>{file.file.name}</b>
                  <small>{sizeLabel(file.file.size)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="wz-rv-none">Nenhum arquivo anexado.</p>
          )}
        </Block>

        {state.retaliation || state.urgent ? (
          <Block
            icon={<Alert size={20} />}
            tint="wz-t-amber"
            title="Sinais de atenção"
            editLabel="sinais de atenção"
            onEdit={() => goTo(2)}
            warn
          >
            <ul className="wz-rv-cats warn">
              {state.retaliation ? <li>Existe ameaça ou possível retaliação</li> : null}
              {state.urgent ? <li>Solicito medida urgente</li> : null}
            </ul>
          </Block>
        ) : null}
      </div>

      <div className="wz-before wz-human">
        <ShieldCheck size={20} />
        <div>
          <b>Análise e decisão humanas</b>
          <p>
            Seu relato é analisado com atenção. As sugestões apresentadas pelo sistema servem apenas
            para apoiar a organização da triagem. A avaliação, classificação e qualquer decisão são
            realizadas por pessoas responsáveis e autorizadas.
          </p>
        </div>
      </div>

      <p className="wz-after">
        <Lock size={16} />
        <span>
          Ao confirmar, você recebe um <b>protocolo</b> e uma <b>chave de acompanhamento</b>. Guarde os
          dois: é por eles que você acompanha o caso.
        </span>
      </p>
    </>
  );
}
