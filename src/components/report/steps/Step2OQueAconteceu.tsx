"use client";

import { useCallback, useState } from "react";

import { Alert as AlertIcon, Check, ChevronDown, Mic } from "@/components/public/icons";
import { CATEGORY_INFO, RECURRENCES, RELATIONSHIPS } from "@/lib/report/schema";

import DictationConsent from "../DictationConsent";
import { FieldError, FieldTitle, InfoHint } from "../fields";
import {
  giveDictationConsent,
  hasDictationConsent,
  useDictation,
  useDictationSupported,
} from "../useDictation";
import { useWizard } from "../wizardState";

const DESCRIPTION_MAX = 20000;
const DESCRIPTION_MIN = 20;

/**
 * Etapa "O que aconteceu", em quatro blocos: a ocorrência, o tipo de relato, a
 * descrição (com ditado por voz opcional) e os dois alertas. Os campos e as
 * regras de validação são os mesmos de sempre — só a organização mudou.
 */
export default function Step2OQueAconteceu() {
  const { state, update, clearError, categoryGroups, needsSpecification, toggleCategory } =
    useWizard();
  const { errors } = state;

  const [activeGroup, setActiveGroup] = useState(categoryGroups[0]?.key ?? "");
  const [askConsent, setAskConsent] = useState(false);

  const supported = useDictationSupported();
  const onText = useCallback(
    (value: string) => {
      update("description", value);
    },
    [update],
  );
  const dictation = useDictation({ text: state.description, onText, maxLength: DESCRIPTION_MAX });

  function toggleDictation() {
    if (dictation.listening) {
      dictation.stop();
    } else if (hasDictationConsent()) {
      clearError("description");
      dictation.start();
    } else {
      setAskConsent(true);
    }
  }

  const selectedIn = (groupKey: string) =>
    categoryGroups
      .find(group => group.key === groupKey)
      ?.items.filter(item => state.categoryIds.includes(item.id)).length ?? 0;

  const group = categoryGroups.find(item => item.key === activeGroup);
  const length = state.description.length;

  return (
    <>
      <span className="wz-kicker">O QUE ACONTECEU</span>
      <h1>Conte com suas palavras.</h1>
      <p className="wz-lead">
        Todos os campos marcados com <b className="wz-ast">*</b> são obrigatórios. Você poderá
        complementar o relato depois.
      </p>

      {/* 1 · a ocorrência */}
      <section className="wz-sec" aria-labelledby="wz-s1">
        <h2 id="wz-s1">
          <i aria-hidden="true">1</i>Sobre a ocorrência
        </h2>
        <div className="wz-g2">
          <label className={`wz-fld ${errors.relationship ? "field-error" : ""}`}>
            <FieldTitle
              label="Sua relação com a organização"
              info="Informe se você é colaborador, ex-colaborador, prestador, fornecedor, cliente ou visitante."
            />
            <span className="wz-selw">
              <select
                className="wz-input"
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
              <ChevronDown size={18} />
            </span>
            <FieldError message={errors.relationship} />
          </label>
          <label className={`wz-fld ${errors.periodText ? "field-error" : ""}`}>
            <FieldTitle
              label="Data ou período da ocorrência"
              info="Informe uma data aproximada, um intervalo ou desde quando a situação acontece."
            />
            <input
              className="wz-input"
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
          <label className={`wz-fld ${errors.accused ? "field-error" : ""}`}>
            <FieldTitle
              label="Pessoa(s) envolvida(s) no relato"
              info="Informe nome, função ou outra referência disponível. Se não souber, escreva “não identificado”."
            />
            <input
              className="wz-input"
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
          <label className={`wz-fld ${errors.witnesses ? "field-error" : ""}`}>
            <FieldTitle
              label="Testemunhas"
              info="Se houver pessoas que presenciaram a situação, informe nome ou função. Deixe em branco se não houver ou preferir não informar."
              required={false}
              optionalBadge
            />
            <input
              className="wz-input"
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
        </div>

        <div className={`wz-fld wz-freq ${errors.recurrence ? "field-error" : ""}`}>
          <span id="wz-freq-title">
            <FieldTitle
              label="Frequência da ocorrência"
              info="Informe se a situação aconteceu uma única vez, se acontece repetidamente ou se está em curso agora."
            />
          </span>
          <div className="wz-chips" role="radiogroup" aria-labelledby="wz-freq-title">
            {RECURRENCES.map(item => (
              <label key={item.value} className={`wz-chip ${state.recurrence === item.value ? "on" : ""}`}>
                <input
                  type="radio"
                  name="recurrence"
                  value={item.value}
                  checked={state.recurrence === item.value}
                  onChange={() => {
                    update("recurrence", item.value);
                    clearError("recurrence");
                  }}
                />
                {item.label}
              </label>
            ))}
          </div>
          <FieldError message={errors.recurrence} />
        </div>
      </section>

      {/* 2 · tipo de relato */}
      <section className="wz-sec" aria-labelledby="wz-s2">
        <fieldset className={`wz-fieldset ${errors.categoryIds ? "field-error" : ""}`}>
          <legend id="wz-s2">
            <i aria-hidden="true">2</i>
            <FieldTitle
              label="O seu relato está relacionado a quê?"
              info="Selecione todas as opções aplicáveis. Uma mesma situação pode envolver fatores de grupos diferentes."
            />
          </legend>
          <p className="wz-sub">Você pode selecionar mais de uma opção.</p>
          <div className="wz-tabs" role="tablist" aria-label="Grupos de opções">
            {categoryGroups.map(item => {
              const count = selectedIn(item.key);
              return (
                <button
                  type="button"
                  role="tab"
                  key={item.key}
                  id={`wz-tab-${item.key}`}
                  aria-selected={activeGroup === item.key}
                  aria-controls={`wz-panel-${item.key}`}
                  className={`wz-tab ${activeGroup === item.key ? "on" : ""}`}
                  onClick={() => setActiveGroup(item.key)}
                >
                  {item.title}
                  <span className={`wz-count ${count === 0 ? "zero" : ""}`} aria-label={`${count} selecionadas`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          {group ? (
            <div
              className="wz-cats"
              role="tabpanel"
              id={`wz-panel-${group.key}`}
              aria-labelledby={`wz-tab-${group.key}`}
            >
              {group.items.map(item => {
                const on = state.categoryIds.includes(item.id);
                return (
                  <label key={item.id} className={`wz-cat ${on ? "on" : ""}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleCategory(item.id)} />
                    <span className="wz-cx" aria-hidden="true">
                      <Check size={14} />
                    </span>
                    <span className="wz-cat-text">{item.label}</span>
                    {CATEGORY_INFO[item.code] && (
                      <InfoHint label={item.label} info={CATEGORY_INFO[item.code]} />
                    )}
                  </label>
                );
              })}
            </div>
          ) : null}
          <FieldError message={errors.categoryIds} />
          {needsSpecification && (
            <label className={`wz-fld wz-esp ${errors.categorySpecification ? "field-error" : ""}`}>
              <FieldTitle
                label="Especifique a opção selecionada"
                info="Descreva brevemente a outra violência, conduta ou fator relacionado ao trabalho."
              />
              <input
                className="wz-input"
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
      </section>

      {/* 3 · descrição, com ditado opcional */}
      <section className="wz-sec" aria-labelledby="wz-s3">
        <div className="wz-h2row">
          <h2 id="wz-s3">
            <i aria-hidden="true">3</i>
            <FieldTitle
              label="Descrição do ocorrido"
              info="Conte o que aconteceu, quando, onde, com que frequência e quais pessoas foram afetadas."
            />
          </h2>
          {supported ? (
            <button
              type="button"
              className={`wz-mic ${dictation.listening ? "on" : ""}`}
              aria-pressed={dictation.listening}
              onClick={toggleDictation}
            >
              <Mic size={20} />
              {dictation.listening ? "Ouvindo…" : "Falar em vez de digitar"}
            </button>
          ) : null}
        </div>
        <label className={`wz-wide ${errors.description ? "field-error" : ""}`}>
          <span className="wz-sr">Descrição do ocorrido</span>
          <textarea
            className={`wz-input wz-textarea ${dictation.listening ? "listening" : ""}`}
            rows={6}
            value={state.description}
            aria-invalid={!!errors.description}
            maxLength={DESCRIPTION_MAX}
            onChange={e => {
              update("description", e.target.value);
              clearError("description");
            }}
            placeholder="O que aconteceu? Quando, onde e com que frequência? Como isso afetou você ou outras pessoas?"
          />
        </label>

        <div aria-live="polite">
          {dictation.listening ? (
            <div className="wz-dictating">
              <span className="wz-dictating-mic" aria-hidden="true">
                <Mic size={20} />
              </span>
              <span className="wz-dictating-wave" aria-hidden="true">
                {Array.from({ length: 11 }, (_, i) => (
                  <i key={i} />
                ))}
              </span>
              <span className="wz-dictating-text">
                <b>Ouvindo…</b> fale com calma, no seu ritmo. O texto aparece acima.
              </span>
              <button type="button" className="wz-stop" onClick={dictation.stop}>
                Parar
              </button>
            </div>
          ) : null}
          {dictation.error ? (
            <p className="wz-voice-note wz-voice-error" role="alert">
              <AlertIcon size={16} />
              {dictation.error}
            </p>
          ) : null}
          {!dictation.listening && !dictation.error && dictation.needsReview ? (
            <p className="wz-voice-note">
              <AlertIcon size={16} />
              Revise o texto: o reconhecimento de voz pode errar nomes e palavras. Você pode corrigir
              antes de continuar.
            </p>
          ) : null}
        </div>

        <p className="wz-count-line">
          <b>
            {length} {length === 1 ? "caractere" : "caracteres"}
          </b>
          <span>
            · mínimo de {DESCRIPTION_MIN} · evite incluir dados pessoais desnecessários
          </span>
        </p>
        <FieldError message={errors.description} />
      </section>

      {/* 4 · alertas */}
      <section className="wz-sec" aria-labelledby="wz-s4">
        <h2 id="wz-s4">
          <i aria-hidden="true">4</i>Se for o caso
        </h2>
        <div className="wz-switches">
          <div className={`wz-sw ${state.retaliation ? "on" : ""}`}>
            <button
              type="button"
              role="switch"
              aria-checked={state.retaliation}
              className="wz-swb"
              onClick={() => update("retaliation", !state.retaliation)}
            >
              <span className="wz-track" aria-hidden="true">
                <i />
              </span>
              Existe ameaça ou possível retaliação
            </button>
            <InfoHint
              label="Existe ameaça ou possível retaliação"
              info="Marque se houve ameaça, prejuízo ou tratamento desfavorável relacionado ao relato."
            />
          </div>
          <div className={`wz-sw ${state.urgent ? "on" : ""}`}>
            <button
              type="button"
              role="switch"
              aria-checked={state.urgent}
              className="wz-swb"
              onClick={() => update("urgent", !state.urgent)}
            >
              <span className="wz-track" aria-hidden="true">
                <i />
              </span>
              Solicito medida urgente
            </button>
            <InfoHint
              label="Solicito medida urgente"
              info="Marque quando entender que uma medida imediata pode ser necessária para proteção ou preservação de evidências."
            />
          </div>
        </div>
      </section>

      {askConsent ? (
        <DictationConsent
          onAccept={() => {
            giveDictationConsent();
            setAskConsent(false);
            dictation.start();
          }}
          onDecline={() => setAskConsent(false)}
        />
      ) : null}
    </>
  );
}
