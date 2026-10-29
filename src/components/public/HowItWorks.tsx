import { ArrowRight, Chat, Eye, Key, ShieldCheck } from "./icons";
import RelatoLink from "./RelatoLink";

const STEPS = [
  {
    n: "01",
    title: "Conte o que aconteceu",
    text: "Escolha se quer se identificar e registre o relato com as informações que tiver.",
    icon: Chat,
    progress: "33%",
  },
  {
    n: "02",
    title: "Guarde seu protocolo",
    text: "Você recebe um código aleatório e uma chave privada. Eles são a sua única forma de acesso.",
    icon: Key,
    progress: "66%",
  },
  {
    n: "03",
    title: "Acompanhe com segurança",
    text: "Consulte o status, responda perguntas e envie novas informações sem criar uma conta.",
    icon: Eye,
    progress: "100%",
  },
];

const NORMAS = ["Lei nº 14.457/2022", "NR-01", "NR-05", "NR-17"];

/**
 * A parte escura da tela inicial: os três passos (únicos "como funciona" da
 * página — a faixa que repetia isto no topo saiu), a chamada final para relatar
 * e o aviso de conformidade legal. O rodapé vem em seguida (`PublicFooter`).
 */
export default function HowItWorks() {
  return (
    <section className="hm-dark" id="como-funciona" aria-labelledby="como-funciona-titulo">
      <div className="hm-dark-head">
        <div>
          <span className="hm-kicker">COMO FUNCIONA</span>
          <h2 id="como-funciona-titulo">
            Você mantém <em>o controle.</em>
          </h2>
        </div>
        <p>Sem criar conta. Você decide o que contar e acompanha tudo com o seu protocolo.</p>
      </div>

      <ol className="hm-flow">
        {STEPS.map(({ n, title, text, icon: Icon, progress }) => (
          <li key={n} className="hm-flow-step">
            <div className="hm-flow-top">
              <span className="hm-flow-num" aria-hidden="true">
                {n}
              </span>
              <span className="hm-flow-icon">
                <Icon size={24} />
              </span>
            </div>
            <h3>
              <span className="hm-sr-only">Passo {n}: </span>
              {title}
            </h3>
            <p>{text}</p>
            <span className="hm-flow-bar" aria-hidden="true">
              <i style={{ width: progress }} />
            </span>
          </li>
        ))}
      </ol>

      <div className="hm-final">
        <div>
          <h3>Sua voz merece ser ouvida.</h3>
          <p>Comece quando se sentir pronto(a). Você pode acompanhar depois com o seu protocolo.</p>
        </div>
        <RelatoLink className="hm-btn-light">
          Fazer um relato
          <span>
            <ArrowRight />
          </span>
        </RelatoLink>
      </div>

      <div className="hm-legal">
        <p>
          <ShieldCheck size={22} />
          <span>
            Desenvolvido para apoiar as organizações na prevenção e gestão de riscos relacionados ao
            trabalho, em alinhamento à Lei nº 14.457/2022 e às NR-01, NR-05 e NR-17.
          </span>
        </p>
        <ul aria-label="Normas de referência">
          {NORMAS.map(norma => (
            <li key={norma}>{norma}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
