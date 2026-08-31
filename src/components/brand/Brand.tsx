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
      <span className="brand-mark">S</span>
      <span>
        <strong>SENTINELA</strong>
        <small>PREVENÇÃO E GESTÃO DE RISCOS ORGANIZACIONAIS</small>
        <small className="functionality-label">CANAL DE DENÚNCIAS</small>
      </span>
    </Link>
  );
}
