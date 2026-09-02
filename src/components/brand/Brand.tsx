import type { MouseEvent } from "react";
import Link from "next/link";

/**
 * Marca do canal. No protótipo era um <button onClick>; aqui é uma âncora real
 * (melhor para acessibilidade e clique do meio). O CSS ganhou `text-decoration:none`
 * em `.brand` para compensar a troca de tag.
 *
 * `onClick` existe para o wizard de relato, que precisa interceptar a saída e
 * pedir confirmação antes de descartar um relato não enviado. Sem ele o link
 * continua sendo um link comum.
 */
export default function Brand({
  href = "/",
  onClick,
}: {
  href?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link
      className="brand"
      href={href}
      onClick={onClick}
      aria-label="Sentinela — Canal de Denúncias, início"
    >
      <svg className="brand-mark" viewBox="0 0 42 42" role="presentation" aria-hidden="true">
        <rect width="42" height="42" fill="var(--teal)" />
        <path d="M12 21a9 9 0 0 1 18 0" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
        <rect x="10.2" y="19.5" width="5" height="8" rx="2" fill="#fff" />
        <rect x="26.8" y="19.5" width="5" height="8" rx="2" fill="#fff" />
        <circle cx="20.5" cy="29.5" r="2.6" fill="#fff" />
        <path d="M15 27.5c0 3 2.4 4.3 4.6 4.3" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span>
        <strong>SENTINELA</strong>
        <small>PREVENÇÃO E GESTÃO DE RISCOS ORGANIZACIONAIS</small>
        <small className="functionality-label">CANAL DE DENÚNCIAS</small>
      </span>
    </Link>
  );
}
