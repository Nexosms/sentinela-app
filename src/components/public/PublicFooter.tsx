import Link from "next/link";
import Brand from "@/components/brand/Brand";

export default function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="public-footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <Brand />
          <p>
            Canal de denúncias operado com independência, privacidade e conformidade à Lei nº
            14.457/2022 e às NR-01, NR-05 e NR-17.
          </p>
        </div>
        <div className="footer-contact">
          <small>Contato</small>
          <a href="tel:+557599489071">(75) 9948-9071</a>
          <span>CNPJ 68.843.115/0001-81</span>
        </div>
        <div className="footer-links">
          <small>Institucional</small>
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/termos">Termos de uso</Link>
          <Link href="/acessibilidade">Acessibilidade</Link>
          <Link href="/admin">Área administrativa</Link>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {year} Canal de Prevenção e Gestão de Riscos Organizacionais Ltda.</span>
        <span>Canal operado com independência e privacidade desde a concepção.</span>
      </div>
    </footer>
  );
}
