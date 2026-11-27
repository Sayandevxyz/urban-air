import type { ReactNode } from "react";
import type { AqiCategory, UsAqiClassification } from "@/types/air-quality";

export interface AqiVisualStyle {
  readonly cardClass: string;
  readonly badgeClass: string;
  readonly barColor: string;
  readonly patternLabel: string;
}

/**
 * WCAG AA/AAA verified high-contrast light and dark color + border + pattern tokens per AQI tier.
 */
export const AQI_VISUAL_STYLES: Readonly<Record<AqiCategory, AqiVisualStyle>> = {
  good: {
    cardClass:
      "border-emerald-700 bg-emerald-50 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-100",
    badgeClass:
      "border-emerald-700 bg-emerald-100 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-900 dark:text-emerald-50",
    barColor: "#047857",
    patternLabel: "Level 1",
  },
  moderate: {
    cardClass:
      "border-amber-700 bg-amber-50 text-amber-950 dark:border-amber-400 dark:bg-amber-950/60 dark:text-amber-100",
    badgeClass:
      "border-amber-700 bg-amber-100 text-amber-950 dark:border-amber-400 dark:bg-amber-900 dark:text-amber-50",
    barColor: "#b45309",
    patternLabel: "Level 2",
  },
  sensitive: {
    cardClass:
      "border-orange-700 bg-orange-50 text-orange-950 dark:border-orange-400 dark:bg-orange-950/60 dark:text-orange-100",
    badgeClass:
      "border-orange-700 bg-orange-100 text-orange-950 dark:border-orange-400 dark:bg-orange-900 dark:text-orange-50",
    barColor: "#c2410c",
    patternLabel: "Level 3",
  },
  unhealthy: {
    cardClass:
      "border-rose-700 bg-rose-50 text-rose-950 dark:border-rose-400 dark:bg-rose-950/60 dark:text-rose-100",
    badgeClass:
      "border-rose-700 bg-rose-100 text-rose-950 dark:border-rose-400 dark:bg-rose-900 dark:text-rose-50",
    barColor: "#be123c",
    patternLabel: "Level 4",
  },
  very_unhealthy: {
    cardClass:
      "border-purple-700 bg-purple-50 text-purple-950 dark:border-purple-400 dark:bg-purple-950/60 dark:text-purple-100",
    badgeClass:
      "border-purple-700 bg-purple-100 text-purple-950 dark:border-purple-400 dark:bg-purple-900 dark:text-purple-50",
    barColor: "#7e22ce",
    patternLabel: "Level 5",
  },
  hazardous: {
    cardClass:
      "border-red-800 bg-red-100 text-red-950 dark:border-red-300 dark:bg-red-950/75 dark:text-red-50",
    badgeClass:
      "border-red-800 bg-red-200 text-red-950 dark:border-red-300 dark:bg-red-900 dark:text-red-50",
    barColor: "#991b1b",
    patternLabel: "Level 6",
  },
};

const SEVERITY_ICON_NODES: Readonly<Record<UsAqiClassification["iconId"], ReactNode>> = {
  leaf: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 21c8-2 14-8 14-16-8 0-14 6-14 16Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 21c3-4 6-7 10-10" />
    </>
  ),
  "sun-cloud": (
    <>
      <circle cx="9" cy="9" r="3.5" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 18h10a3.5 3.5 0 0 0 .5-6.96A4.5 4.5 0 0 0 9 12a3 3 0 0 0-2 6Z"
      />
    </>
  ),
  "shield-alert": (
    <>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-3Z"
      />
      <path strokeLinecap="round" d="M12 8v4m0 4h.01" />
    </>
  ),
  "mask-warning": (
    <>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 10c2-2 5-3 8-3s6 1 8 3v3c0 3.5-3.5 6-8 6s-8-2.5-8-6v-3Z"
      />
      <path strokeLinecap="round" d="M8 12h8M9 15h6" />
    </>
  ),
  "smog-danger": (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 2 20h20L12 3Z" />
      <path strokeLinecap="round" d="M12 9v5m0 3h.01" />
    </>
  ),
  biohazard: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 7v5m0 4h.01M7.5 16.5l9-9" />
    </>
  ),
};

function VectorIcon({
  className,
  children,
}: {
  readonly className: string;
  readonly children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/**
 * Distinct severity SVG icon paired with text and color so AQI categories never rely on color alone.
 */
export function AqiSeverityIcon({
  iconId,
  className = "h-6 w-6",
}: {
  readonly iconId: UsAqiClassification["iconId"];
  readonly className?: string;
}) {
  return <VectorIcon className={className}>{SEVERITY_ICON_NODES[iconId]}</VectorIcon>;
}

/**
 * Pin icon for geolocation trigger button.
 */
export function LocationPinIcon({ className = "h-5 w-5" }: { readonly className?: string }) {
  return (
    <VectorIcon className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"
      />
      <circle cx="12" cy="10" r="2.5" />
    </VectorIcon>
  );
}

/**
 * Search magnifier icon for city search combobox.
 */
export function SearchIcon({ className = "h-5 w-5" }: { readonly className?: string }) {
  return (
    <VectorIcon className={className}>
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="m20 20-3.5-3.5" />
    </VectorIcon>
  );
}
