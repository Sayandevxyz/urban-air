import { useTranslations } from "next-intl";
import {
  buildHourlyGeometry,
  CHART_HEIGHT,
  CHART_PAD_BOTTOM,
  CHART_PAD_LEFT,
  CHART_PAD_RIGHT,
  CHART_PAD_TOP,
  CHART_WIDTH,
} from "@/domain/forecastChartGeometry";
import type { HourlyForecastPoint } from "@/domain/types";

interface HourlyChartProps {
  readonly cityName: string;
  readonly hourly: readonly HourlyForecastPoint[];
}

/**
 * Pure SVG 48-hour US AQI line chart with 100-AQI threshold reference and descriptive figcaption.
 */
export function HourlyChart({ cityName, hourly }: HourlyChartProps) {
  const t = useTranslations("forecast");
  const { minHourly, maxHourly, chartMax, thresholdY, polylinePoints, tickMarkers } =
    buildHourlyGeometry(hourly);

  const label = t("hourlyChartLabel", { city: cityName, min: minHourly, max: maxHourly });

  return (
    <figure className="mt-4">
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-auto w-full rounded-lg border border-borderc bg-surface p-2"
      >
        <line
          x1={CHART_PAD_LEFT}
          y1={thresholdY}
          x2={CHART_WIDTH - CHART_PAD_RIGHT}
          y2={thresholdY}
          stroke="currentColor"
          strokeDasharray="6 4"
          strokeOpacity={0.5}
        />
        <text x={4} y={thresholdY + 4} fontSize={11} fill="currentColor">
          100
        </text>
        <text x={4} y={CHART_PAD_TOP + 10} fontSize={11} fill="currentColor">
          {chartMax}
        </text>
        <text x={4} y={CHART_HEIGHT - CHART_PAD_BOTTOM} fontSize={11} fill="currentColor">
          0
        </text>
        {polylinePoints && (
          <polyline
            fill="none"
            stroke="#0b57d0"
            strokeWidth={3}
            strokeLinejoin="round"
            points={polylinePoints}
          />
        )}
        {tickMarkers.map((marker) => (
          <g key={marker.timeIso}>
            <circle cx={marker.x} cy={marker.y} r={4} fill="#0b57d0" />
            <text
              x={marker.x}
              y={CHART_HEIGHT - 8}
              textAnchor="middle"
              fontSize={10}
              fill="currentColor"
            >
              {marker.label}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-2 text-sm text-ink-muted">{label}</figcaption>
    </figure>
  );
}
