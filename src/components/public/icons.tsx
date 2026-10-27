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

export const Key = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M7 14a4 4 0 1 1 3.9-5H21v3h-2v2h-3v-2h-5.1A4 4 0 0 1 7 14Z" />
  </Svg>
);
export const Eye = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);
export const ShieldCheck = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6l-8-3Z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);
export const Phone = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
  </Svg>
);

/** Logotipo do WhatsApp (preenchido, herda a cor do texto). */
export function WhatsAppIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.484-1.77-1.66-2.07-.174-.3-.019-.465.13-.615.136-.135.301-.345.451-.52.146-.181.194-.301.297-.496.1-.21.049-.375-.025-.524-.075-.15-.672-1.62-.922-2.206-.24-.584-.487-.51-.672-.51-.172-.015-.371-.015-.571-.015-.2 0-.523.074-.797.359-.273.3-1.045 1.02-1.045 2.475s1.07 2.865 1.219 3.075c.149.18 2.095 3.195 5.076 4.483.709.3 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.696.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export const Alert = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M12 3 2.5 20h19L12 3Z" />
    <path d="M12 10v4M12 17.2v.1" />
  </Svg>
);
export const Building = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M4 21V7l8-4 8 4v14M9 21v-5h6v5M9 10h.01M15 10h.01M9 13h.01M15 13h.01" />
  </Svg>
);
export const ExitIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" />
  </Svg>
);
export const ArrowLeft = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);

export const EyeOff = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M3 3l18 18M10.6 6.2A9.8 9.8 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 6.7C3.6 8.5 2 12 2 12s3.6 6 10 6a9.6 9.6 0 0 0 4-.9M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Svg>
);
export const UserCheck = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM16 11l2 2 4-4" />
  </Svg>
);

export const Mic = ({ size }: IconProps) => (
  <Svg size={size}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </Svg>
);
export const ChevronDown = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

export const UploadCloud = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4 4 0 0 1-.5 9.5H7Z" />
    <path d="M12 12v6M9.5 14.5 12 12l2.5 2.5" />
  </Svg>
);
export const ImageFile = ({ size }: IconProps) => (
  <Svg size={size}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m21 16-5-5-8 8" />
  </Svg>
);
export const DocFile = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Svg>
);
export const AudioFile = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M9 18V6l10-2v12" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="16.5" cy="16" r="2.5" />
  </Svg>
);
export const Trash = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Svg>
);
