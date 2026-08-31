export default function HowItWorks() {
  return (
    <section className="how-section">
      <span className="section-kicker">COMO FUNCIONA</span>
      <h2>Você mantém o controle.</h2>
      <div className="how-grid">
        <article>
          <b>01</b>
          <h3>Conte o que aconteceu</h3>
          <p>Escolha se quer se identificar e registre o relato com as informações que tiver.</p>
        </article>
        <article>
          <b>02</b>
          <h3>Guarde seu protocolo</h3>
          <p>
            Você recebe um código aleatório e uma chave privada. Eles são a sua única forma de
            acesso.
          </p>
        </article>
        <article>
          <b>03</b>
          <h3>Acompanhe com segurança</h3>
          <p>
            Consulte o status, responda perguntas e envie novas informações sem criar uma conta.
          </p>
        </article>
      </div>
      <p className="compliance-copy">
        Desenvolvido para apoiar as organizações na prevenção e gestão de riscos relacionados ao
        trabalho, em alinhamento à Lei nº 14.457/2022 e às NR-01, NR-05 e NR-17.
      </p>
    </section>
  );
}
