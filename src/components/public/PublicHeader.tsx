import Link from "next/link";

import Brand from "@/components/brand/Brand";
import AccessibilityToggle from "./AccessibilityToggle";
import { Globe } from "./icons";
import MobileMenu from "./MobileMenu";

export default function PublicHeader() {
  return (
    <header className="hm-header">
      <Brand />
      <nav className="hm-nav" aria-label="Ações do canal">
        <Link href="/acompanhar" className="hm-nav-link">
          Acompanhar protocolo
        </Link>
        <AccessibilityToggle />
        <button className="language-button" type="button">
          <Globe size={16} /> PT
        </button>
      </nav>
      <MobileMenu />
    </header>
  );
}
