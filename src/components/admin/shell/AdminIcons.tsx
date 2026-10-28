import type { ReactNode } from "react";

/**
 * Ícones de linha do painel (24×24, traço arredondado), no lugar dos caracteres soltos (◈ ⌁ ▤) que o
 * menu usava. Decorativos: o texto ao lado informa, então `aria-hidden`.
 */
function Svg({
  size = 20,
  stroke = 1.8,
  children,
}: {
  size?: number;
  stroke?: number;
  children: ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

type P = { size?: number };

export const IconHome = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4 11.5 12 5l8 6.5V20H4v-8.5Z" />
    <path d="M9.5 20v-5h5v5" />
  </Svg>
);
export const IconInbox = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4 13h4l1.5 2.5h5L16 13h4" />
    <path d="M6.3 5h11.4a1 1 0 0 1 .95.7L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5l1.35-7.3A1 1 0 0 1 6.3 5Z" />
  </Svg>
);
export const IconSearch = ({ size }: P) => (
  <Svg size={size}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Svg>
);
export const IconTask = ({ size }: P) => (
  <Svg size={size}>
    <rect x="4" y="4" width="16" height="16" rx="3.5" />
    <path d="m8.5 12.3 2.4 2.4 4.6-5" />
  </Svg>
);
export const IconChart = ({ size }: P) => (
  <Svg size={size}>
    <path d="M5 20V10M12 20V4M19 20v-7" />
  </Svg>
);
export const IconShield = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6l-8-3Z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);
export const IconCalendar = ({ size }: P) => (
  <Svg size={size}>
    <rect x="4" y="5" width="16" height="15" rx="3" />
    <path d="M4 10h16M8.5 3v4M15.5 3v4" />
  </Svg>
);
export const IconFolder = ({ size }: P) => (
  <Svg size={size}>
    <path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2.5h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18V7.5Z" />
  </Svg>
);
export const IconBuilding = ({ size }: P) => (
  <Svg size={size}>
    <path d="M5 20V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15M15 9h3a1 1 0 0 1 1 1v10M3.5 20h17M9 8h2M9 12h2M9 16h2" />
  </Svg>
);
export const IconGear = ({ size }: P) => (
  <Svg size={size} stroke={1.6}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
  </Svg>
);
export const IconBack = ({ size }: P) => (
  <Svg size={size ?? 18}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);
export const IconLogout = ({ size }: P) => (
  <Svg size={size ?? 18}>
    <path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" />
  </Svg>
);
export const IconBell = ({ size }: P) => (
  <Svg size={size}>
    <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15L6 16.5Z" />
    <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
  </Svg>
);
export const IconHelp = ({ size }: P) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5M12 16.6v.1" />
  </Svg>
);
export const IconChevronDown = ({ size }: P) => (
  <Svg size={size ?? 16} stroke={2}>
    <path d="m7 10 5 5 5-5" />
  </Svg>
);
export const IconChevronRight = ({ size }: P) => (
  <Svg size={size ?? 16} stroke={2}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);
export const IconArrowRight = ({ size }: P) => (
  <Svg size={size ?? 18} stroke={2}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
export const IconMenu = ({ size }: P) => (
  <Svg size={size ?? 22}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);
export const IconFlame = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.7.8-2.6 1.6-3.6C10.4 6.8 11.5 5.5 12 3Z" />
  </Svg>
);
export const IconClock = ({ size }: P) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);
export const IconDoc = ({ size }: P) => (
  <Svg size={size}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5" />
  </Svg>
);
export const IconQueue = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4 6h16M4 12h10M4 18h6" />
    <circle cx="18" cy="16" r="3" />
    <path d="m20.2 18.2 1.3 1.3" />
  </Svg>
);
export const IconRadar = ({ size }: P) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 12 18 6" />
  </Svg>
);

/** Ícone de cada item do menu pela chave do `NAV_ITEMS` (e as chaves extras da Central). */
export function NavIcon({ name, size }: { name: string; size?: number }) {
  switch (name) {
    case "visao-geral":
      return <IconHome size={size} />;
    case "denuncias":
      return <IconInbox size={size} />;
    case "investigacoes":
      return <IconSearch size={size} />;
    case "planos-de-acao":
      return <IconTask size={size} />;
    case "relatorios":
    case "relatorios-clientes":
      return <IconChart size={size} />;
    case "auditoria":
      return <IconShield size={size} />;
    case "reunioes":
      return <IconCalendar size={size} />;
    case "materiais":
    case "publicar":
      return <IconFolder size={size} />;
    case "configuracoes":
      return <IconGear size={size} />;
    case "clientes":
    case "empresas":
      return <IconBuilding size={size} />;
    case "central":
      return <IconRadar size={size} />;
    case "fila":
      return <IconQueue size={size} />;
    case "voltar":
      return <IconBack size={size} />;
    default:
      return <IconDoc size={size} />;
  }
}

export const IconPresentation = ({ size }: P) => (
  <Svg size={size}>
    <rect x="3" y="4" width="18" height="13" rx="2.5" />
    <path d="M12 17v3M8 20h8M8 13l2.5-3 2 2 3.5-4" />
  </Svg>
);
export const IconVideo = ({ size }: P) => (
  <Svg size={size}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="m10 9.5 5 2.5-5 2.5v-5Z" />
  </Svg>
);
export const IconAudio = ({ size }: P) => (
  <Svg size={size}>
    <path d="M9 18V6l10-2v12" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="16.5" cy="16" r="2.5" />
  </Svg>
);
export const IconImage = ({ size }: P) => (
  <Svg size={size}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m21 16-5-5-8 8" />
  </Svg>
);
export const IconSheet = ({ size }: P) => (
  <Svg size={size}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M4 10h16M4 15h16M10 4v16" />
  </Svg>
);
export const IconEye = ({ size }: P) => (
  <Svg size={size ?? 17}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);
export const IconEyeOff = ({ size }: P) => (
  <Svg size={size ?? 16}>
    <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.5 6.6A16.7 16.7 0 0 0 2 12s3.6 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Svg>
);
export const IconDownload = ({ size }: P) => (
  <Svg size={size ?? 17}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14" />
  </Svg>
);
export const IconPlus = ({ size }: P) => (
  <Svg size={size ?? 18} stroke={2.2}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
