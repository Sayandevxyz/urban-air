import type { AqiCategory } from "@/domain/types";

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
