import { Chat, Check, HeadsetArt } from "./icons";

/**
 * A cena de escuta do topo: um fone de ouvido cercado de anéis que pulsam e,
 * abaixo, ondas de áudio — a ideia de "alguém está ouvindo". Tudo é CSS
 * (animações lentas, sem JavaScript) e decorativo; as frases nos cartões é que
 * carregam o sentido.
 *
 * As alturas das barras saem de uma fórmula fixa: nada de `Math.random()`, que
 * daria um HTML diferente no servidor e no navegador.
 */
const BARS = Array.from({ length: 29 }, (_, i) => {
  const t = i / 28;
  const envelope = Math.sin(Math.PI * t);
  const height = 8 + 40 * envelope * (0.45 + 0.55 * Math.abs(Math.sin(i * 1.9)));
  return {
    height: Number(height.toFixed(1)),
    opacity: Number((0.35 + 0.65 * envelope).toFixed(2)),
    delay: Number((-((i * 0.137) % 1.6)).toFixed(2)),
    duration: Number((1.2 + 0.9 * Math.abs(Math.sin(i * 2.3))).toFixed(2)),
  };
});

export default function ListeningScene() {
  return (
    <div className="hm-scene">
      <div className="hm-stage" aria-hidden="true">
        <span className="hm-ring hm-r4" />
        <span className="hm-ring hm-r3" />
        <span className="hm-ring hm-r2" />
        <span className="hm-ring hm-r1" />
        <div className="hm-orb">
          <HeadsetArt />
        </div>
        <div className="hm-wave">
          {BARS.map((bar, index) => (
            <i
              key={index}
              style={{
                height: bar.height,
                opacity: bar.opacity,
                animationDelay: `${bar.delay}s`,
                animationDuration: `${bar.duration}s`,
              }}
            />
          ))}
        </div>
      </div>

      <aside className="hm-card hm-quote" aria-label="Uma mensagem para você">
        <span className="hm-card-icon hm-tint-red">
          <Chat />
        </span>
        <div>
          <blockquote>
            “Você não precisa ter certeza do nome jurídico do que aconteceu para falar.”
          </blockquote>
          <p>Conte com suas palavras, no seu tempo.</p>
        </div>
      </aside>

      <aside className="hm-card hm-proto">
        <span className="hm-card-icon hm-tint-green">
          <Check />
        </span>
        <div>
          <strong>Protocolo gerado na hora</strong>
          <p>Acompanhe quando quiser.</p>
        </div>
      </aside>
    </div>
  );
}
