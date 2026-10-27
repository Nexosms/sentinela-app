import type { ReactNode } from "react";

/**
 * Ícones de traço da área pública, um só estilo (24×24, traço arredondado),
 * no lugar dos caracteres soltos (◇ □ ⌕) usados antes. Decorativos: o texto ao
 * lado é quem informa, então `aria-hidden`.
 */
function Svg({ size = 20, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

type IconProps = { size?: number };

export const ArrowRight = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
export const Search = ({ size }: IconProps) => (
  <Svg size={size}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);
export const Shield = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6l-8-3Z" />
  </Svg>
);
export const Lock = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M6 11V8a6 6 0 1 1 12 0v3M5 11h14v10H5z" />
  </Svg>
);
export const Check = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M5 13l4 4L19 7" />
  </Svg>
);
export const Heart = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
  </Svg>
);
export const Chat = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M4 5h16v11H8l-4 4V5Z" />
  </Svg>
);
export const Clock = ({ size }: IconProps) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);
export const Globe = ({ size }: IconProps) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18" />
  </Svg>
);
export const MenuIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);
export const CloseIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

/** Fone de ouvido do botão (traço simples). */
export const HeadsetLine = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
    <rect x="3" y="14" width="4" height="6" rx="1.6" />
    <rect x="17" y="14" width="4" height="6" rx="1.6" />
  </Svg>
);

/** O fone grande da cena: preenchido, no vermelho da marca. */
export function HeadsetArt({ size = 92 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      <path d="M13 36V31a19 19 0 0 1 38 0v5" stroke="#d81f18" strokeWidth="4.2" strokeLinecap="round" />
      <rect x="8" y="34" width="12" height="18" rx="5" fill="#d81f18" />
      <rect x="44" y="34" width="12" height="18" rx="5" fill="#d81f18" />
      <path d="M50 52c0 6-5 8-12 8h-4" stroke="#d81f18" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="32" cy="60" r="3.4" fill="#d81f18" />
      <path d="M24 28a10 10 0 0 1 16 0" stroke="#f5a38a" strokeWidth="2.6" strokeLinecap="round" opacity=".9" />
    </svg>
  );
}
