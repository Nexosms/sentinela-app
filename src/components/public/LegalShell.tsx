import type { ReactNode } from "react";
import PublicHeader from "./PublicHeader";
import PublicFooter from "./PublicFooter";

export default function LegalShell({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="public-shell">
      <PublicHeader />
      <section className="how-section">
        <span className="section-kicker">{kicker}</span>
        <h2>{title}</h2>
        <div className="compliance-copy" style={{ textAlign: "left", maxWidth: "72ch" }}>
          {children}
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
