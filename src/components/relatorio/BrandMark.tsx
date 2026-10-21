/**
 * A marca do canal (o fone de ouvido do CDN) sozinha, em SVG — a mesma arte de
 * `public/favicon.svg`, usada no cabeçalho do relatório mensal, que precisa
 * sair igual na tela e no PDF.
 */
export default function BrandMark({ size = 44 }: { size?: number }) {
  return (
    <svg
      className="mr-brand-mark"
      width={size}
      height={size}
      viewBox="0 0 42 42"
      role="img"
      aria-label="CDN — Canal de Denúncias"
    >
      <rect width="42" height="42" rx="10" fill="#d81f18" />
      <path d="M12 21a9 9 0 0 1 18 0" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="10.2" y="19.5" width="5" height="8" rx="2" fill="#fff" />
      <rect x="26.8" y="19.5" width="5" height="8" rx="2" fill="#fff" />
      <circle cx="20.5" cy="29.5" r="2.6" fill="#fff" />
      <path d="M15 27.5c0 3 2.4 4.3 4.6 4.3" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
