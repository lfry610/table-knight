import { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const RDI = ({ children, size = 16, strokeWidth = 1.5, fill = "none", stroke, ...rest }: IconProps & { children: React.ReactNode }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill={fill}
    stroke={stroke ?? "currentColor"}
    strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round"
    {...rest}
  >
    {children}
  </svg>
);

export const IconD6 = (p: IconProps) => (
  <RDI {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3"/>
    <circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" stroke="none"/>
    <circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" stroke="none"/>
  </RDI>
);

export const IconShield = (p: IconProps) => (
  <RDI {...p}>
    <path d="M12 3 L 4 6 V12 C4 17 7.5 20.5 12 22 C 16.5 20.5 20 17 20 12 V6 Z"/>
  </RDI>
);

export const IconNotebook = (p: IconProps) => (
  <RDI {...p}>
    <path d="M5 4 H17 A 2 2 0 0 1 19 6 V20 A 1 1 0 0 1 18 21 H7 A 2 2 0 0 1 5 19 Z"/>
    <path d="M5 8 H4 M5 12 H4 M5 16 H4"/>
  </RDI>
);

export const IconShelf = (p: IconProps) => (
  <RDI {...p}>
    <path d="M4 4 V20 M8 4 V20 M12 8 V20 L16 20 V8 Z M19 4 L21 12 L18 20"/>
  </RDI>
);

export const IconTrophy = (p: IconProps) => (
  <RDI {...p}>
    <path d="M7 4 H17 V9 A 5 5 0 0 1 7 9 Z"/>
    <path d="M7 6 H4 V8 A 3 3 0 0 0 7 11"/>
    <path d="M17 6 H20 V8 A 3 3 0 0 1 17 11"/>
    <path d="M9 19 H15 M12 14 V19"/>
  </RDI>
);

export const IconLoss = (p: IconProps) => (
  <RDI {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3"/>
    <path d="M9 9 L 15 15 M15 9 L 9 15"/>
  </RDI>
);

export const IconDraw = (p: IconProps) => (
  <RDI {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3"/>
    <path d="M8 10 H 16 M8 14 H 16"/>
  </RDI>
);

export const IconDnf = (p: IconProps) => (
  <RDI {...p}>
    <path d="M14 3 H 6 V 21 H 14"/>
    <path d="M14 12 H 21 M 21 12 L 18 9 M21 12 L 18 15"/>
  </RDI>
);

export const IconCalendar = (p: IconProps) => (
  <RDI {...p}>
    <rect x="3.5" y="5.5" width="17" height="15" rx="2"/>
    <path d="M8 3 V7 M16 3 V7 M3.5 10 H 20.5"/>
  </RDI>
);

export const IconUsers = (p: IconProps) => (
  <RDI {...p}>
    <circle cx="9" cy="8" r="3.5"/>
    <path d="M3 20 C 3 16, 6 14, 9 14 C 12 14, 15 16, 15 20"/>
    <circle cx="17" cy="9" r="3"/>
    <path d="M21 20 C 21 17, 19 15, 17 15"/>
  </RDI>
);

export const IconStar = ({ solid, ...p }: IconProps & { solid?: boolean }) => (
  <RDI {...p} fill={solid ? "currentColor" : "none"}>
    <path d="M12 3 L14.6 9 L21 9.9 L16.3 14.2 L17.5 20.5 L12 17.5 L6.5 20.5 L7.7 14.2 L3 9.9 L9.4 9 Z"/>
  </RDI>
);

export const IconPlus = (p: IconProps) => (
  <RDI {...p}><path d="M12 5 V19 M5 12 H19"/></RDI>
);

export const IconSearch = (p: IconProps) => (
  <RDI {...p}><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 L 21 21"/></RDI>
);

export const IconCrest = (p: IconProps) => (
  <RDI {...p}>
    <path d="M5 6 H 19 C 19 14, 16 18, 12 21 C 8 18, 5 14, 5 6 Z"/>
    <rect x="9" y="11" width="6" height="6" rx="1"/>
  </RDI>
);

export const IconList = (p: IconProps) => (
  <RDI {...p}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></RDI>
);

export const IconPencil = (p: IconProps) => (
  <RDI {...p}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </RDI>
);

export const IconTrash = (p: IconProps) => (
  <RDI {...p}>
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </RDI>
);

export const IconPerson = (p: IconProps) => (
  <RDI {...p}>
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </RDI>
);

export const IconQuill = (p: IconProps) => (
  <RDI {...p}>
    <path d="M20 4c-4 0-8 2-10 6L4 20l4-1 2-5c2-1 4-2 6-2"/>
    <path d="M20 4c0 4-2 8-6 10"/>
  </RDI>
);

export const IconMenu = (p: IconProps) => (
  <RDI {...p}>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </RDI>
);

export const IconX = (p: IconProps) => (
  <RDI {...p}><path d="M18 6 L6 18 M6 6 L18 18"/></RDI>
);

export const IconLogOut = (p: IconProps) => (
  <RDI {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </RDI>
);

// Official logo mark — crossed lances + shield + d6
export const LogoMark = ({ size = 28 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Left lance */}
    <g transform="translate(11 19) rotate(-40)">
      <circle cx="0" cy="0" r="3.4" fill="#e8a96b" stroke="#27101f" strokeWidth=".6"/>
      <rect x="-2.6" y="3.2" width="5.2" height="11.4" rx=".8" fill="#27101f"/>
      <line x1="-2.2" y1="6" x2="2.2" y2="6" stroke="#e8a96b" strokeWidth=".5" opacity=".7"/>
      <line x1="-2.2" y1="10" x2="2.2" y2="10" stroke="#e8a96b" strokeWidth=".5" opacity=".7"/>
      <rect x="-12" y="14.6" width="24" height="3.4" rx="1" fill="#e8a96b" stroke="#27101f" strokeWidth=".5"/>
      <circle cx="-12" cy="16.3" r="1.7" fill="#e8a96b" stroke="#27101f" strokeWidth=".5"/>
      <circle cx="12" cy="16.3" r="1.7" fill="#e8a96b" stroke="#27101f" strokeWidth=".5"/>
      <path d="M -2.6 18 L 0 95 L 2.6 18 Z" fill="#cccfd6" stroke="#27101f" strokeWidth=".7" strokeLinejoin="round"/>
      <line x1="0" y1="18" x2="0" y2="92" stroke="#27101f" strokeWidth=".5" opacity=".35"/>
    </g>
    {/* Right lance */}
    <g transform="translate(89 19) rotate(40)">
      <circle cx="0" cy="0" r="3.4" fill="#e8a96b" stroke="#27101f" strokeWidth=".6"/>
      <rect x="-2.6" y="3.2" width="5.2" height="11.4" rx=".8" fill="#27101f"/>
      <line x1="-2.2" y1="6" x2="2.2" y2="6" stroke="#e8a96b" strokeWidth=".5" opacity=".7"/>
      <line x1="-2.2" y1="10" x2="2.2" y2="10" stroke="#e8a96b" strokeWidth=".5" opacity=".7"/>
      <rect x="-12" y="14.6" width="24" height="3.4" rx="1" fill="#e8a96b" stroke="#27101f" strokeWidth=".5"/>
      <circle cx="-12" cy="16.3" r="1.7" fill="#e8a96b" stroke="#27101f" strokeWidth=".5"/>
      <circle cx="12" cy="16.3" r="1.7" fill="#e8a96b" stroke="#27101f" strokeWidth=".5"/>
      <path d="M -2.6 18 L 0 95 L 2.6 18 Z" fill="#cccfd6" stroke="#27101f" strokeWidth=".7" strokeLinejoin="round"/>
      <line x1="0" y1="18" x2="0" y2="92" stroke="#27101f" strokeWidth=".5" opacity=".35"/>
    </g>
    {/* Shield */}
    <path d="M 22 24 L 78 24 C 78 56, 72 78, 50 95 C 28 78, 22 56, 22 24 Z" fill="#5e2750" stroke="#e8a96b" strokeWidth="2.4"/>
    <path d="M 26 28 L 74 28 C 74 54, 68 74, 50 89 C 32 74, 26 54, 26 28 Z" fill="none" stroke="#e8a96b" strokeWidth=".8" opacity=".55"/>
    {/* d6 die */}
    <rect x="34" y="40" width="32" height="32" rx="4.5" fill="#fbeed4" stroke="#27101f" strokeWidth="1.3"/>
    <circle cx="42" cy="48" r="2.4" fill="#5e2750"/>
    <circle cx="58" cy="48" r="2.4" fill="#5e2750"/>
    <circle cx="50" cy="56" r="2.4" fill="#5e2750"/>
    <circle cx="42" cy="64" r="2.4" fill="#5e2750"/>
    <circle cx="58" cy="64" r="2.4" fill="#5e2750"/>
    {/* Top finial — orb */}
    <path d="M 50 2 C 47 2, 45 4, 45 7 C 45 10, 47 12, 50 12 C 53 12, 55 10, 55 7 C 55 4, 53 2, 50 2 Z" fill="#5e2750" stroke="#27101f" strokeWidth=".7"/>
    <path d="M 49 10 L 51 10 L 50 16 Z" fill="#5e2750"/>
    {/* Top finial — gorget/collar */}
    <path d="M 41 16 C 41 13, 44 12, 50 12 C 56 12, 59 13, 59 16 L 59 28 C 59 31, 56 33, 50 33 C 44 33, 41 31, 41 28 Z" fill="#e8a96b" stroke="#27101f" strokeWidth="1.1"/>
    <rect x="44" y="20" width="12" height="2.2" rx=".5" fill="#27101f"/>
    <path d="M 41 28 L 59 28 L 59 30 C 59 32, 56 33, 50 33 C 44 33, 41 32, 41 30 Z" fill="#27101f" opacity=".22"/>
    <circle cx="44" cy="26" r=".7" fill="#27101f"/>
    <circle cx="56" cy="26" r=".7" fill="#27101f"/>
  </svg>
);
