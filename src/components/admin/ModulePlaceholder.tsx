import AdminTopbar from "./AdminTopbar";

/**
 * Estado vazio de um módulo ainda não construído. Diferente do protótipo, diz
 * a verdade sobre o que existe hoje em vez de simular um produto pronto.
 */
export default function ModulePlaceholder({
  title,
  eyebrow,
  copy,
  phase,
}: {
  title: string;
  eyebrow: string;
  copy: string;
  phase: string;
}) {
  return (
    <>
      <AdminTopbar eyebrow={eyebrow} title={title} />
      <div className="placeholder">
        <span>◈</span>
        <small>{phase}</small>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
    </>
  );
}
