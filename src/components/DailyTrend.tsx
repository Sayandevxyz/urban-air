import { useTranslations } from "next-intl";
import { buildDailyGeometry, CHART_HEIGHT, CHART_WIDTH } from "@/domain/forecastChartGeometry";
import type { DailyTrendPoint } from "@/domain/types";

interface DailyTrendProps {
  readonly cityName: string;
  readonly daily: readonly DailyTrendPoint[];
}

/**
 * Pure SVG 7-day trend bar chart combining fill color and diagonal stripe pattern.
 */
export function DailyTrend({ cityName, daily }: DailyTrendProps) {
  const t = useTranslations("forecast");
  const { bars } = buildDailyGeometry(daily);
  const label = t("dailyChartLabel", { city: cityName });

  return (
    <figure className="mt-4">
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-auto w-full rounded-lg border border-borderc bg-surface p-2"
      >
        <defs>
          <pattern id="bar-stripe" width="6" height="6" patternUnits="userSpaceOnUse">
            <path d="M0 6 L6 0" stroke="#ffffff" strokeOpacity={0.35} strokeWidth="1.5" />
          </pattern>
        </defs>
        {bars.map((bar) => (
          <g key={bar.dateIso}>
            <rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} rx={4} fill="#0b57d0" />
            <rect
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              rx={4}
              fill="url(#bar-stripe)"
            />
            <text
              x={bar.x + bar.width / 2}
              y={bar.y - 4}
              textAnchor="middle"
              fontSize={11}
              fontWeight="bold"
              fill="currentColor"
            >
              {bar.avgUsAqi}
            </text>
            <text
              x={bar.x + bar.width / 2}
              y={CHART_HEIGHT - 8}
              textAnchor="middle"
              fontSize={10}
              fill="currentColor"
            >
              {bar.dateLabel}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-2 text-sm text-ink-muted">{label}</figcaption>
    </figure>
  );
}
