"use client";

import { useEffect, useState } from "react";

/**
 * No protótipo este botão não fazia nada. Alterna um modo de alto contraste /
 * texto ampliado via atributo no <html>, lido pelo CSS.
 */
export default function AccessibilityToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-a11y", on);
  }, [on]);

  return (
    <button
      className="text-button"
      type="button"
      aria-pressed={on}
      onClick={() => setOn(value => !value)}
    >
      ◐ Acessibilidade
    </button>
  );
}
