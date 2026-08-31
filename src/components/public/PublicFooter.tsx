import Link from "next/link";

export default function PublicFooter() {
  return (
    <footer className="public-footer">
      <span>Canal operado com independência e privacidade desde a concepção.</span>
      <div>
        <Link href="/privacidade">Privacidade</Link>
        <Link href="/termos">Termos de uso</Link>
        <Link href="/admin">Área administrativa</Link>
      </div>
    </footer>
  );
}
