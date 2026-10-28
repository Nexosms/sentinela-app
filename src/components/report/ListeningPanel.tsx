import { HeadsetArt, ShieldCheck } from "@/components/public/icons";

/**
 * Painel de escuta ao lado do formulário (fone, anéis e ondas) — a mesma ideia da
 * tela inicial, em tamanho menor. Decorativo, exceto os textos. As alturas das
 * barras vêm de uma fórmula fixa (nada de `Math.random()`), para o HTML do
 * servidor e o do navegador serem idênticos.
 */
const BARS = Array.from({ length: 21 }, (_, i) => {
  const t = i / 20;
  const envelope = Math.sin(Math.PI * t);
  return {
    height: Number((7 + 28 * envelope * (0.45 + 0.55 * Math.abs(Math.sin(i * 1.9)))).toFixed(1)),
    opacity: Number((0.35 + 0.65 * envelope).toFixed(2)),
    delay: Number((-((i * 0.137) % 1.6)).toFixed(2)),
    duration: Number((1.2 + 0.9 * Math.abs(Math.sin(i * 2.3))).toFixed(2)),
  };
});

export default function ListeningPanel({
  title = "Sem pressa.",
  text = "Estamos aqui para ouvir. Você conduz no seu ritmo.",
  note = "Nada é enviado até você confirmar, na última etapa.",
}: {
  title?: string;
  text?: string;
  note?: string;
}) {
  return (
    <aside className="wz-aside">
      <div className="wz-stage" aria-hidden="true">
        <span className="wz-ring wz-r3" />
        <span className="wz-ring wz-r2" />
        <span className="wz-ring wz-r1" />
        <div className="wz-orb">
          <HeadsetArt size={62} />
        </div>
        <div className="wz-wave">
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
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="wz-safe">
        <ShieldCheck size={18} />
        <span>{note}</span>
      </div>
    </aside>
  );
}
