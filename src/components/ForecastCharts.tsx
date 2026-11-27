// ============================================================================
// src/components/ForecastCharts.tsx
// Renders accessible pure SVG 48-hour hourly polyline and 7-day trend charts.
// ============================================================================

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  buildDailyGeometry,
  buildHourlyGeometry,
  CHART_HEIGHT,
  CHART_PAD_BOTTOM,
  CHART_PAD_LEFT,
  CHART_PAD_RIGHT,
  CHART_PAD_TOP,
  CHART_WIDTH,
  type DailyChartGeometry,
  type HourlyChartGeometry,
} from "@/domain/forecast-geometry";
import type { DailyTrendPoint, HourlyForecastPoint } from "@/types/air-quality";

const X_LBL = 4;
const DY_TH = 4;
const DY_TOP = 10;
const DY_BOT = 8;
const FS_AX = 11;
const FS_TK = 10;
const LINE_W = 3;
const DOT_R = 4;
const BAR_R = 4;
const GUIDE_OP = 0.5;
const STRIPE_OP = 0.35;

function ChartFigure({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <figure className="mt-4">
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-auto w-full rounded-lg border border-borderc bg-surface p-2"
      >
        {children}
      </svg>
      <figcaption className="mt-2 text-sm text-ink-muted">{label}</figcaption>
    </figure>
  );
}

function HourlyAxisGuides({
  chartMax,
  thresholdY,
}: {
  readonly chartMax: number;
  readonly thresholdY: number;
}) {
  return (
    <>
      <line
        x1={CHART_PAD_LEFT}
        y1={thresholdY}
        x2={CHART_WIDTH - CHART_PAD_RIGHT}
        y2={thresholdY}
        stroke="currentColor"
        strokeDasharray="6 4"
        strokeOpacity={GUIDE_OP}
      />
      <text x={X_LBL} y={thresholdY + DY_TH} fontSize={FS_AX} fill="currentColor">
        100
      </text>
      <text x={X_LBL} y={CHART_PAD_TOP + DY_TOP} fontSize={FS_AX} fill="currentColor">
        {chartMax}
      </text>
      <text x={X_LBL} y={CHART_HEIGHT - CHART_PAD_BOTTOM} fontSize={FS_AX} fill="currentColor">
        0
      </text>
    </>
  );
}

function HourlyAxisAndSeries({ geometry }: { readonly geometry: HourlyChartGeometry }) {
  const { chartMax, thresholdY, polylinePoints, tickMarkers } = geometry;
  return (
    <>
      <HourlyAxisGuides chartMax={chartMax} thresholdY={thresholdY} />
      {polylinePoints && (
        <polyline
          fill="none"
          stroke="#0b57d0"
          strokeWidth={LINE_W}
          strokeLinejoin="round"
          points={polylinePoints}
        />
      )}
      {tickMarkers.map((m) => (
        <g key={m.timeIso}>
          <circle cx={m.x} cy={m.y} r={DOT_R} fill="#0b57d0" />
          <text
            x={m.x}
            y={CHART_HEIGHT - DY_BOT}
            textAnchor="middle"
            fontSize={FS_TK}
            fill="currentColor"
          >
            {m.label}
          </text>
        </g>
      ))}
    </>
  );
}

/** Pure SVG 48-hour US AQI line chart with 100-AQI threshold guide and figcaption. */
export function HourlyChart({
  cityName,
  hourly,
}: {
  readonly cityName: string;
  readonly hourly: readonly HourlyForecastPoint[];
}) {
  const t = useTranslations("forecast");
  const geometry = buildHourlyGeometry(hourly);
  const label = t("hourlyChartLabel", {
    city: cityName,
    min: geometry.minHourly,
    max: geometry.maxHourly,
  });
  return (
    <ChartFigure label={label}>
      <HourlyAxisAndSeries geometry={geometry} />
    </ChartFigure>
  );
}

function DailyBarItem({ bar }: { readonly bar: DailyChartGeometry["bars"][number] }) {
  const cx = bar.x + bar.width / 2;
  return (
    <g>
      <rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} rx={BAR_R} fill="#0b57d0" />
      <rect
        x={bar.x}
        y={bar.y}
        width={bar.width}
        height={bar.height}
        rx={BAR_R}
        fill="url(#bar-stripe)"
      />
      <text
        x={cx}
        y={bar.y - DY_TH}
        textAnchor="middle"
        fontSize={FS_AX}
        fontWeight="bold"
        fill="currentColor"
      >
        {bar.avgUsAqi}
      </text>
      <text
        x={cx}
        y={CHART_HEIGHT - DY_BOT}
        textAnchor="middle"
        fontSize={FS_TK}
        fill="currentColor"
      >
        {bar.dateLabel}
      </text>
    </g>
  );
}

/** Pure SVG 7-day trend bar chart combining fill color and diagonal stripe pattern. */
export function DailyTrend({
  cityName,
  daily,
}: {
  readonly cityName: string;
  readonly daily: readonly DailyTrendPoint[];
}) {
  const t = useTranslations("forecast");
  const { bars } = buildDailyGeometry(daily);
  return (
    <ChartFigure label={t("dailyChartLabel", { city: cityName })}>
      <defs>
        <pattern id="bar-stripe" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 6 L6 0" stroke="#ffffff" strokeOpacity={STRIPE_OP} strokeWidth="1.5" />
        </pattern>
      </defs>
      {bars.map((bar) => (
        <DailyBarItem key={bar.dateIso} bar={bar} />
      ))}
    </ChartFigure>
  );
}
