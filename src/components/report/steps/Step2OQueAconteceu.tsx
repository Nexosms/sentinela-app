"use client";

import { useState } from "react";

import { RECURRENCES, RELATIONSHIPS } from "@/lib/report/schema";

import { FieldError, FieldTitle } from "../fields";
import { useWizard } from "../wizardState";

export default function Step2OQueAconteceu() {
  const { state, update, clearError, categoryGroups, needsSpecification, toggleCategory } =
    useWizard();
  const { errors } = state;

  const [activeGroup, setActiveGroup] = useState(categoryGroups[0]?.key ?? "");

  return (
    <>
      <span className="section-kicker">O QUE ACONTECEU</span>
      <h1>Conte com suas palavras.</h1>
      <p className="lead">
        Todos os campos marcados com * são obrigatórios. Você poderá complementar o relato depois.
      </p>
      <div className="field-grid two">
        <label className={errors.relationship ? "field-error" : ""}>
          <FieldTitle
            label="Sua relação com a organização"
            info="Informe se você é colaborador, ex-colaborador, prestador, fornecedor, cliente ou visitante."
          />
          <select
            value={state.relationship}
            aria-invalid={!!errors.relationship}
            onChange={e => {
              update("relationship", e.target.value);
              clearError("relationship");
            }}
          >
            <option value="">Selecione</option>
            {RELATIONSHIPS.map(item => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <FieldError message={errors.relationship} />
        </label>
        <label className={errors.periodText ? "field-error" : ""}>
          <FieldTitle
            label="Data ou período da ocorrência"
            info="Informe uma data aproximada, um intervalo ou desde quando a situação acontece."
          />
          <input
            value={state.periodText}
            aria-invalid={!!errors.periodText}
            onChange={e => {
              update("periodText", e.target.value);
              clearError("periodText");
            }}
            placeholder="Ex.: desde março de 2026"
          />
          <FieldError message={errors.periodText} />
        </label>
        <label className={errors.accused ? "field-error" : ""}>
          <FieldTitle
            label="Pessoa(s) envolvida(s) no relato"
            info="Informe nome, função ou outra referência disponível. Se não souber, escreva “não identificado”."
          />
          <input
            value={state.accused}
            aria-invalid={!!errors.accused}
            onChange={e => {
              update("accused", e.target.value);
              clearError("accused");
            }}
            placeholder="Nome, função ou não identificado"
          />
          <FieldError message={errors.accused} />
        </label>
        <label className={errors.witnesses ? "field-error" : ""}>
          <FieldTitle
            label="Testemunhas"
            info="Se houver pessoas que presenciaram a situação, informe nome ou função. Deixe em branco se não houver ou preferir não informar."
            required={false}
          />
          <input
            value={state.witnesses}
            aria-invalid={!!errors.witnesses}
            onChange={e => {
              update("witnesses", e.target.value);
              clearError("witnesses");
            }}
            placeholder="Nome, função ou nenhuma"
          />
          <FieldError message={errors.witnesses} />
        </label>
        <label className={errors.recurrence ? "field-error" : ""}>
          <FieldTitle
            label="Frequência da ocorrência"
            info="Informe se a situação aconteceu uma única vez, se acontece repetidamente ou se está em curso agora."
          />
          <select
            value={state.recurrence}
            aria-invalid={!!errors.recurrence}
            onChange={e => {
              update("recurrence", e.target.value);
              clearError("recurrence");
            }}
          >
            {RECURRENCES.map(item => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <FieldError message={errors.recurrence} />
        </label>
      </div>
      <fieldset className={`category-multiselect ${errors.categoryIds ? "field-error" : ""}`}>
        <legend>
          <FieldTitle
            label="O seu relato está relacionado a quê?"
            info="Selecione todas as opções aplicáveis. Uma mesma situação pode envolver fatores de grupos diferentes."
          />
        </legend>
        <p>Você pode selecionar mais de uma opção.</p>
        <div className="detail-tabs">
          {categoryGroups.map(group => (
            <button
              type="button"
              key={group.key}
              className={activeGroup === group.key ? "active" : ""}
              onClick={() => setActiveGroup(group.key)}
            >
              {group.title}
            </button>
          ))}
        </div>
        <div className="category-groups single-column">
          {categoryGroups
            .filter(group => group.key === activeGroup)
            .map(group => (
              <section key={group.key}>
                {group.items.map(item => (
                  <label key={item.id}>
                    <input
                      type="checkbox"
                      checked={state.categoryIds.includes(item.id)}
                      onChange={() => toggleCategory(item.id)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </section>
            ))}
        </div>
        <FieldError message={errors.categoryIds} />
        {needsSpecification && (
          <label className={`category-details ${errors.categorySpecification ? "field-error" : ""}`}>
            <FieldTitle
              label="Especifique a opção selecionada"
              info="Descreva brevemente a outra violência, conduta ou fator relacionado ao trabalho."
            />
            <input
              value={state.categorySpecification}
              aria-invalid={!!errors.categorySpecification}
              onChange={e => {
                update("categorySpecification", e.target.value);
                clearError("categorySpecification");
              }}
              placeholder="Descreva aqui"
            />
            <FieldError message={errors.categorySpecification} />
          </label>
        )}
      </fieldset>
      <label className={`wide-field ${errors.description ? "field-error" : ""}`}>
        <FieldTitle
          label="Descrição do ocorrido"
          info="Conte o que aconteceu, quando, onde, com que frequência e quais pessoas foram afetadas."
        />
        <textarea
          rows={7}
          value={state.description}
          aria-invalid={!!errors.description}
          onChange={e => {
            update("description", e.target.value);
            clearError("description");
          }}
          placeholder="O que aconteceu? Quando, onde e com que frequência? Como isso afetou você ou outras pessoas?"
        />
        <small>{state.description.length} caracteres · evite incluir dados pessoais desnecessários</small>
        <FieldError message={errors.description} />
      </label>
      <div className="toggle-row">
        <label>
          <input
            type="checkbox"
            checked={state.retaliation}
            onChange={e => update("retaliation", e.target.checked)}
          />{" "}
          Existe ameaça ou possível retaliação{" "}
          <span
            className="info-hint"
            title="Marque se houve ameaça, prejuízo ou tratamento desfavorável relacionado ao relato."
          >
            i
          </span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={state.urgent}
            onChange={e => update("urgent", e.target.checked)}
          />{" "}
          Solicito medida urgente{" "}
          <span
            className="info-hint"
            title="Marque quando entender que uma medida imediata pode ser necessária para proteção ou preservação de evidências."
          >
            i
          </span>
        </label>
      </div>
    </>
  );
}
