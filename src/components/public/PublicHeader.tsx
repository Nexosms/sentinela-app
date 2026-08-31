import Brand from "@/components/brand/Brand";
import AccessibilityToggle from "./AccessibilityToggle";

export default function PublicHeader() {
  return (
    <header className="public-header">
      <Brand />
      <nav aria-label="Ações do canal">
        <AccessibilityToggle />
        <button className="language-button" type="button">
          PT <span>⌄</span>
        </button>
      </nav>
    </header>
  );
}
