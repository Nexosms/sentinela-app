import Link from "next/link";

export default function Hero() {
  return (
    <section className="hero" id="inicio">
      <div className="hero-copy">
        <span className="eyebrow">
          <i /> Espaço seguro e confidencial
        </span>
        <h1>
          Sua voz merece
          <br />
          ser <em>ouvida.</em>
        </h1>
        <p>
          Este é um espaço seguro e confidencial para relatar situações, condutas ou condições
          relacionadas ao trabalho que precisam ser conhecidas e avaliadas, com respeito, proteção e
          possibilidade de anonimato.
        </p>
        <div className="hero-actions">
          <Link className="primary-button" href="/relato">
            Fazer um relato <span>→</span>
          </Link>
          <Link className="secondary-button" href="/acompanhar">
            <span>⌕</span> Acompanhar protocolo
          </Link>
        </div>
        <div className="trust-row">
          <span>
            <b>◇</b> Anonimato protegido
          </span>
          <span>
            <b>□</b> Dados protegidos
          </span>
          <span>
            <b>◌</b> Política de não retaliação
          </span>
        </div>
      </div>
      <aside className="welcome-card">
        <div className="card-topline">
          <span>UMA MENSAGEM PARA VOCÊ</span>
          <i>❋</i>
        </div>
        <blockquote>
          “Você não precisa ter certeza do nome jurídico do que aconteceu para falar.”
        </blockquote>
        <p>
          Conte com suas palavras, no seu tempo. Detalhes objetivos ajudam a equipe responsável a
          compreender e apurar o ocorrido.
        </p>
        <div className="care-note">
          <span>♡</span>
          <div>
            <strong>Você está em risco agora?</strong>
            <small>Em emergências, procure o 190, 192 ou uma rede de apoio próxima.</small>
          </div>
        </div>
      </aside>
    </section>
  );
}
