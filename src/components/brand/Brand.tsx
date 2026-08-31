import Link from "next/link";

/**
 * Marca do canal. No protótipo era um <button onClick>; aqui é uma âncora real
 * (melhor para acessibilidade e clique do meio). O CSS ganhou `text-decoration:none`
 * em `.brand` para compensar a troca de tag.
 */
export default function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link className="brand" href={href} aria-label="Sentinela — Canal de Denúncias, início">
      <span className="brand-mark">S</span>
      <span>
        <strong>SENTINELA</strong>
        <small>PREVENÇÃO E GESTÃO DE RISCOS ORGANIZACIONAIS</small>
        <small className="functionality-label">CANAL DE DENÚNCIAS</small>
      </span>
    </Link>
  );
}
