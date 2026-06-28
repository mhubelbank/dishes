// Renders a Tabler icon by name. Icons are inlined as SVGs with
// stroke="currentColor" so they inherit color from text styling.
//
// To add an icon: paste its inner SVG markup into ICONS below. Paths come from
// https://tabler.io/icons (MIT licensed).

const ICONS = {
  home: "<path d='M5 12l-2 0l9 -9l9 9l-2 0'/><path d='M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7'/><path d='M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6'/>",
  calendar:
    "<path d='M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z'/><path d='M16 3v4'/><path d='M8 3v4'/><path d='M4 11h16'/><path d='M8 15h2v2h-2z'/>",
  fridge:
    "<path d='M5 3m0 2a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z'/><path d='M5 10h14'/><path d='M9 6v1'/><path d='M9 13v2'/>",
  book: "<path d='M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0'/><path d='M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0'/><path d='M3 6l0 13'/><path d='M12 6l0 13'/><path d='M21 6l0 13'/>",
  leaf: "<path d='M5 21c.5 -4.5 2.5 -8 7 -10'/><path d='M9 18c6.218 0 10.5 -3.288 11 -12v-2h-4.014c-9 0 -11.986 4 -12 9c0 1 0 3 2 5h3z'/>",
  haze:
    "<path d='M3 12h1'/><path d='M12 3v1'/><path d='M20 12h1'/><path d='M5.6 5.6l.7 .7'/><path d='M18.4 5.6l-.7 .7'/><path d='M8 12a4 4 0 1 1 8 0'/><path d='M3 16h18'/><path d='M3 20h18'/>",
  comet:
    "<path d='M15.5 18.5l-3 1.5l.5 -3.5l-2 -2l3 -.5l1.5 -3l1.5 3l3 .5l-2 2l.5 3.5l-3 -1.5'/><path d='M4 4l7 7'/><path d='M9 4l3.5 3.5'/><path d='M4 9l3.5 3.5'/>",
  sunrise:
    "<path d='M3 17h18'/><path d='M7 17a5 5 0 0 1 10 0'/><path d='M12 3v7'/><path d='M4.2 10.2l1.4 1.4'/><path d='M19.8 10.2l-1.4 1.4'/><path d='M12 10l3 -3'/><path d='M12 10l-3 -3'/>",
  sun: "<circle cx='12' cy='12' r='4'/><path d='M3 12h1'/><path d='M20 12h1'/><path d='M12 3v1'/><path d='M12 20v1'/><path d='M5.6 5.6l.7 .7'/><path d='M17.7 17.7l.7 .7'/><path d='M18.4 5.6l-.7 .7'/><path d='M6.3 17.7l-.7 .7'/>",
  moon:
    "<path d='M12 3c.132 0 .263 .004 .393 .01a7.5 7.5 0 0 0 7.92 10.998a9 9 0 1 1 -8.313 -11.008z'/>",
  "moon-stars":
    "<path d='M12 3c.132 0 .263 .004 .393 .01a7.5 7.5 0 0 0 7.92 10.998a9 9 0 1 1 -8.313 -11.008z'/><path d='M17 4h.01'/><path d='M20 7h.01'/>",
  settings:
    "<path d='M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z'/><circle cx='12' cy='12' r='3'/>",
  plus: "<line x1='12' y1='5' x2='12' y2='19'/><line x1='5' y1='12' x2='19' y2='12'/>",
  search: "<circle cx='10' cy='10' r='7'/><line x1='21' y1='21' x2='15' y2='15'/>",
  refresh:
    "<path d='M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4'/><path d='M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4'/>",
  x: "<path d='M18 6l-12 12'/><path d='M6 6l12 12'/>",
  "chevron-left": "<polyline points='15 6 9 12 15 18'/>",
  "chevron-right": "<polyline points='9 6 15 12 9 18'/>",
  "alert-circle":
    "<circle cx='12' cy='12' r='9'/><line x1='12' y1='8' x2='12' y2='12'/><line x1='12' y1='16' x2='12.01' y2='16'/>",
  "info-circle":
    "<circle cx='12' cy='12' r='9'/><line x1='12' y1='8' x2='12.01' y2='8'/><polyline points='11 12 12 12 12 16 13 16'/>",
  "clipboard-check":
    "<path d='M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2'/><path d='M9 5a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2'/><path d='M9 14l2 2l4 -4'/>",
  check: "<polyline points='5 12 10 17 20 7'/>",
  "external-link":
    "<path d='M11 7h-5a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-5'/><path d='M10 14l10 -10'/><path d='M15 4h5v5'/>",
  sparkles:
    "<path d='M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2z'/><path d='M16 6a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2z'/><path d='M9 18a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z'/>",
  github:
    "<path d='M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5'/>",
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  // Inline label for accessibility. Omit for purely decorative icons.
  label?: string;
}

export function Icon({ name, size = 16, label }: IconProps) {
  const paths = ICONS[name];
  if (!paths) {
    if (import.meta.env.DEV) {
      console.warn(`Icon "${name}" not found. Add it to ICONS in Icon.tsx.`);
    }
    return null;
  }

  // Build the SVG inline so we can color it via `currentColor`.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="${!label}">${paths}</svg>`;

  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      style={{ display: "inline-flex", lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
