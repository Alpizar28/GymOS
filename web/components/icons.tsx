import type { ImgHTMLAttributes, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;
type BrandIconProps = ImgHTMLAttributes<HTMLImageElement>;

function baseProps(props: IconProps) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export function BrandIcon(props: BrandIconProps) {
  return (
    <img
      src="/logo-mark.svg"
      alt=""
      aria-hidden
      {...props}
    />
  );
}

export function TodayIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <rect x="4" y="6" width="16" height="12" rx="2.5" />
      <path d="M8 3v3" />
      <path d="M16 3v3" />
      <path d="M4 10h16" />
      <path d="M9 14h6" />
    </svg>
  );
}

export function RoutinesIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 10h18" />
      <path d="M9 10v9" />
    </svg>
  );
}

export function WorkoutsIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 7h6" />
      <path d="M9 11h6" />
      <path d="M9 15h4" />
      <path d="M7 7h.01" />
      <path d="M7 11h.01" />
      <path d="M7 15h.01" />
    </svg>
  );
}

export function HistoryIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v4h4" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function ProfileIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

export function StatsIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20v-4" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z" />
    </svg>
  );
}

export function LibraryIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M5 4h4v16H5z" />
      <path d="M10 4h4v16h-4z" />
      <path d="M15 4h4v16h-4z" />
    </svg>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M12 3c1 3-1 4-1 6 0 1 1 2 2 2 2 0 3-2 3-4 2 2 3 4 3 7a6 6 0 1 1-12 0c0-3 2-5 5-7z" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function WeightIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M4 10h3" />
      <path d="M17 10h3" />
      <path d="M7 8v4" />
      <path d="M17 8v4" />
      <path d="M10 10h4" />
      <path d="M4 14h3" />
      <path d="M17 14h3" />
      <path d="M7 12v4" />
      <path d="M17 12v4" />
      <path d="M10 14h4" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M4 7h16" />
      <path d="M10 3h4" />
      <path d="M7 7l1 13h8l1-13" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

export function OfflineIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M3 8a15 15 0 0 1 18 0" />
      <path d="M6 12a10 10 0 0 1 12 0" />
      <path d="M9.5 15.5a5 5 0 0 1 5 0" />
      <path d="M12 19h.01" />
      <path d="M4 4l16 16" />
    </svg>
  );
}
