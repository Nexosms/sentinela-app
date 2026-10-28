"use client";

import { useEffect, useRef } from "react";

/**
 * Painel ILUSTRATIVO do lado escuro do login. A tela aparece antes de qualquer autenticação, então
 * nada aqui vem do sistema: os números, os códigos e as situações são fictícios e o painel diz isso
 * ("EXEMPLO ILUSTRATIVO"). É só decoração, por isso fica fora da árvore de acessibilidade.
 */
const KPIS = [
  { label: "Relatos", value: 128, tone: "" },
  { label: "Em tratativa", value: 34, tone: "amb" },
  { label: "Concluídas", value: 94, tone: "vrd" },
];

const LINHAS = [
  "M0 28 C14 26 20 14 34 17 S58 26 70 14 S100 6 120 4",
  "M0 20 C16 24 24 10 40 14 S64 24 80 16 S104 12 120 18",
  "M0 30 C18 28 26 22 42 20 S70 14 84 9 S108 5 120 3",
];

const SEGMENTOS = [
  { cls: "b1", w: "22%", nome: "Recebidas" },
  { cls: "b2", w: "31%", nome: "Em triagem" },
  { cls: "b3", w: "24%", nome: "Em apuração" },
  { cls: "b4", w: "23%", nome: "Concluídas" },
];

const ACOMPANHAMENTO = [
  { cod: "#0142", titulo: "Relato em apuração", passos: ["f", "f", "a", ""] },
  { cod: "#0141", titulo: "Relato em triagem", passos: ["f", "a", "", ""] },
  { cod: "#0138", titulo: "Relato concluído", passos: ["f", "f", "f", "f"] },
];

export default function LoginPreview() {
  const numeros = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const alvos = KPIS.map(item => item.value);
    if (reduzido) {
      numeros.current.forEach((el, i) => {
        if (el) el.textContent = String(alvos[i]);
      });
      return;
    }
    let frame = 0;
    let inicio = 0;
    const passo = (t: number) => {
      if (!inicio) inicio = t;
      const p = Math.min((t - inicio) / 1300, 1);
      const suave = 1 - Math.pow(1 - p, 3);
      numeros.current.forEach((el, i) => {
        if (el) el.textContent = String(Math.round(alvos[i] * suave));
      });
      if (p < 1) frame = requestAnimationFrame(passo);
    };
    frame = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="lg-painel" aria-hidden="true">
      <div className="lg-p-topo">
        <span className="lg-pts">
          <i />
          <i />
          <i />
        </span>
        <b>Visão geral</b>
        <em>EXEMPLO ILUSTRATIVO</em>
      </div>

      <div className="lg-kpis">
        {KPIS.map((kpi, i) => (
          <div key={kpi.label} className="lg-kpi">
            <small>{kpi.label}</small>
            <strong
              ref={el => {
                numeros.current[i] = el;
              }}
            >
              {kpi.value}
            </strong>
            <svg viewBox="0 0 120 34" preserveAspectRatio="none">
              <path className={`lg-linha ${kpi.tone}`} d={LINHAS[i]} />
            </svg>
          </div>
        ))}
      </div>

      <div className="lg-status">
        <div className="lg-s-cab">
          <b>Status das tratativas</b>
          <small>últimos 90 dias</small>
        </div>
        <div className="lg-barra">
          {SEGMENTOS.map(seg => (
            <i key={seg.cls} className={seg.cls} style={{ "--w": seg.w } as React.CSSProperties} />
          ))}
        </div>
        <ul className="lg-leg">
          {SEGMENTOS.map(seg => (
            <li key={seg.cls}>
              <i className={seg.cls} />
              {seg.nome}
            </li>
          ))}
        </ul>
      </div>

      <ul className="lg-acomp">
        {ACOMPANHAMENTO.map(item => (
          <li key={item.cod}>
            <span className="lg-cod">{item.cod}</span>
            <span className="lg-tit">{item.titulo}</span>
            <span className="lg-pas">
              {item.passos.map((p, i) => (
                <i key={i} className={p} />
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
