// Inline SVG glyphs. Stroke icons, 24-unit grid, `currentColor`.

import type { JSX } from "preact";

type Props = JSX.SVGAttributes<SVGSVGElement>;

function Svg({ children, ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      width="1em"
      height="1em"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const MonitorIcon = (p: Props) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </Svg>
);
export const ServerIcon = (p: Props) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="7" rx="1.5" />
    <rect x="3" y="13" width="18" height="7" rx="1.5" />
    <path d="M7 7.5h.01M7 16.5h.01" />
  </Svg>
);
export const BothIcon = (p: Props) => (
  <Svg {...p}>
    <rect x="2.5" y="5" width="12" height="9" rx="1.5" />
    <path d="M6 18h5M8.5 14v4" />
    <rect x="15.5" y="9" width="6" height="4" rx="1" />
    <rect x="15.5" y="15" width="6" height="4" rx="1" />
  </Svg>
);
export const FolderIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Svg>
);
export const CheckIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </Svg>
);
export const WarnIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M12 3l10 18H2z" />
    <path d="M12 10v5M12 18.5h.01" />
  </Svg>
);
export const InfoIcon = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.5h.01" />
  </Svg>
);
export const DownloadIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M12 4v11M7 10l5 5 5-5M4 19h16" />
  </Svg>
);
export const ExternalIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
  </Svg>
);
export const SunIcon = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
);
export const MoonIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </Svg>
);
export const GithubIcon = (p: Props) => (
  <Svg {...p} stroke="none" fill="currentColor">
    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 6.84c.85 0 1.71.11 2.51.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z" />
  </Svg>
);
export const ArrowLeftIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);
export const ArrowRightIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
export const RefreshIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" />
  </Svg>
);
export const PhoneIcon = (p: Props) => (
  <Svg {...p}>
    <rect x="7" y="2.5" width="10" height="19" rx="2" />
    <path d="M11 18h2" />
  </Svg>
);
export const KeyIcon = (p: Props) => (
  <Svg {...p}>
    <circle cx="8" cy="14" r="4" />
    <path d="M11 11l9-9M16 6l2 2M13.5 8.5l2 2" />
  </Svg>
);
export const RocketIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M12 3c3 2 5 6 5 10l-2 2H9l-2-2c0-4 2-8 5-10z" />
    <path d="M9 15l-3 2 1-4M15 15l3 2-1-4M12 15v6" />
    <circle cx="12" cy="9" r="1.2" />
  </Svg>
);

// The three platform glyphs. Each is the mark that OS is known by, drawn on
// the same 24-unit grid as the rest: Windows' four panes, Apple's apple, and
// a Tux-shaped penguin for Linux. Filled rather than stroked — at 1em these
// read as logos, and an outline penguin is a smudge.
export const WindowsIcon = (p: Props) => (
  <Svg {...p} stroke="none" fill="currentColor">
    <path d="M3 5.6l7.6-1.05v7.2H3zM11.6 4.4L21 3.1v8.65h-9.4zM3 12.75h7.6v7.2L3 18.9zM11.6 12.75H21v8.65l-9.4-1.3z" />
  </Svg>
);
export const AppleIcon = (p: Props) => (
  <Svg {...p} stroke="none" fill="currentColor">
    <path d="M16.3 12.7c0-2.2 1.8-3.3 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.5 0-2.8.9-3.6 2.2-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.2 1.1 0 1.5-.7 2.8-.7 1.3 0 1.6.7 2.8.7 1.2 0 1.9-1.1 2.6-2.1.8-1.2 1.2-2.3 1.2-2.4-.1 0-2.2-.9-2.2-3.5zM14.1 6.3c.6-.7 1-1.7.9-2.7-.9 0-2 .6-2.6 1.3-.6.6-1.1 1.7-.9 2.6 1 .1 2-.5 2.6-1.2z" />
  </Svg>
);
export const LinuxIcon = (p: Props) => (
  <Svg {...p} stroke="none" fill="currentColor">
    <path d="M12 2c-2.3 0-3.6 1.7-3.6 4.1 0 1.3.1 2.2-.2 2.9-.3.8-1 1.6-1.8 2.9-.9 1.5-1.6 2.9-2.3 3.8-.5.7-.7 1.4-.3 1.9.4.5 1.2.5 2 .7.9.2 1.4.6 1.8 1 .5.5 1.3 1.1 2.7 1.1h3.4c1.4 0 2.2-.6 2.7-1.1.4-.4.9-.8 1.8-1 .8-.2 1.6-.2 2-.7.4-.5.2-1.2-.3-1.9-.7-.9-1.4-2.3-2.3-3.8-.8-1.3-1.5-2.1-1.8-2.9-.3-.7-.2-1.6-.2-2.9C15.6 3.7 14.3 2 12 2zm-1.6 3.1c.5 0 .9.6.9 1.3s-.4 1.3-.9 1.3-.9-.6-.9-1.3.4-1.3.9-1.3zm3.2 0c.5 0 .9.6.9 1.3s-.4 1.3-.9 1.3-.9-.6-.9-1.3.4-1.3.9-1.3zM12 8.4c1 0 2 .5 2 1 0 .3-.3.5-.7.8-.4.3-.9.6-1.3.6s-.9-.3-1.3-.6c-.4-.3-.7-.5-.7-.8 0-.5 1-1 2-1z" />
  </Svg>
);

export const CopyIcon = (p: Props) => (
  <Svg {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M6 15H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1" />
  </Svg>
);
