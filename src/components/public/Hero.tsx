import Link from "next/link";

import { ArrowRight, Check, Clock, Heart, HeadsetLine, Lock, Search, Shield } from "./icons";
import ListeningScene from "./ListeningScene";
import RelatoLink from "./RelatoLink";

/**
 * Tela inicial. Em computador: texto à esquerda, a cena de escuta à direita, o
 * aviso de risco logo abaixo das ondas e a faixa "como funciona" embaixo. No
 * celular os blocos se reordenam (ver `home.css`): primeiro a escuta, depois
 * título e botão, a confiança, a mensagem, os passos e, no fim, o aviso.
 */
export default function Hero() {
  return (
    <section className="hm-hero" id="inicio">
      <div className="hm-copy">
        <span className="hm-pill">
          <i aria-hidden="true" /> Canal ativo · seu relato é confidencial
        </span>
        <h1>
          Sua voz merece
          <br />
          ser <em>ouvida.</em>
        </h1>
        <p className="hm-lead">
          Este é um espaço seguro e confidencial para relatar situações, condutas ou condições
          relacionadas ao trabalho que precisam ser conhecidas e avaliadas, com respeito, proteção e
          possibilidade de anonimato.
        </p>
        <div className="hm-cta">
          <RelatoLink className="hm-btn hm-btn-primary">
            <HeadsetLine size={22} />
            <span className="hm-btn-label">Fazer um relato</span>
            <span className="hm-btn-arrow">
              <ArrowRight />
            </span>
          </RelatoLink>
          <Link className="hm-btn hm-btn-secondary" href="/acompanhar">
            <Search />
            <span className="hm-btn-label">Acompanhar protocolo</span>
          </Link>
        </div>
        <p className="hm-micro">
          <Clock size={16} />
          <span>Sem criar conta. Você escolhe se quer se identificar e pode seguir no seu ritmo.</span>
        </p>
        <ul className="hm-trust">
          <li>
            <Shield size={17} /> Anonimato protegido
          </li>
          <li>
            <Lock size={17} /> Dados protegidos
          </li>
          <li>
            <Check size={17} /> Política de não retaliação
          </li>
        </ul>
      </div>

      <ListeningScene />

      <div className="hm-risk">
        <span className="hm-risk-icon">
          <Heart size={20} />
        </span>
        <div>
          <strong>Você está em risco agora?</strong>
          <span>Em emergências, procure o 190, 192 ou uma rede de apoio próxima.</span>
        </div>
      </div>
    </section>
  );
}
