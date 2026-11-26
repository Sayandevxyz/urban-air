import type { UsAqiClassification } from "@/domain/types";

interface IconProps {
  readonly className?: string;
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
  switch (iconId) {
    case "leaf":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className={className}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 21c8-2 14-8 14-16-8 0-14 6-14 16Z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 21c3-4 6-7 10-10" />
        </svg>
      );
    case "sun-cloud":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className={className}
          aria-hidden="true"
        >
          <circle cx="9" cy="9" r="3.5" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 18h10a3.5 3.5 0 0 0 .5-6.96A4.5 4.5 0 0 0 9 12a3 3 0 0 0-2 6Z"
          />
        </svg>
      );
    case "shield-alert":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className={className}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-3Z"
          />
          <path strokeLinecap="round" d="M12 8v4m0 4h.01" />
        </svg>
      );
    case "mask-warning":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className={className}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 10c2-2 5-3 8-3s6 1 8 3v3c0 3.5-3.5 6-8 6s-8-2.5-8-6v-3Z"
          />
          <path strokeLinecap="round" d="M8 12h8M9 15h6" />
        </svg>
      );
    case "smog-danger":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className={className}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 2 20h20L12 3Z" />
          <path strokeLinecap="round" d="M12 9v5m0 3h.01" />
        </svg>
      );
    case "biohazard":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className={className}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" d="M12 7v5m0 4h.01M7.5 16.5l9-9" />
        </svg>
      );
  }
}

/**
 * Pin icon for geolocation trigger button.
 */
export function LocationPinIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"
      />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

/**
 * Search magnifier icon for city search combobox.
 */
export function SearchIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="m20 20-3.5-3.5" />
    </svg>
  );
}
