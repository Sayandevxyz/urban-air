// ============================================================================
// src/domain/forecast-geometry.ts
// Computes accessible SVG polyline and bar geometry for hourly and daily charts.
// ============================================================================

import { CHART_HEADROOM_AQI, DEFAULT_CHART_MAX_AQI, ISO_SLICE } from "@/lib/constants";
import type { DailyTrendPoint, HourlyForecastPoint } from "@/types/air-quality";

/** Full SVG viewBox width shared by hourly and daily forecast charts. */
export const CHART_WIDTH = 640;
/** Full SVG viewBox height shared by hourly and daily forecast charts. */
export const CHART_HEIGHT = 220;
/** Left SVG margin reserved for Y-axis numeric labels. */
export const CHART_PAD_LEFT = 40;
/** Right SVG margin keeping terminal markers inside the canvas. */
export const CHART_PAD_RIGHT = 16;
/** Top SVG padding keeping peak labels clear of the upper border. */
export const CHART_PAD_TOP = 16;
/** Bottom SVG margin reserved for timestamp and date axis labels. */
export const CHART_PAD_BOTTOM = 28;
/** Usable inner SVG plotting width after accounting for margins. */
export const CHART_INNER_WIDTH = CHART_WIDTH - CHART_PAD_LEFT - CHART_PAD_RIGHT;
/** Usable inner SVG plotting height after accounting for margins. */
export const CHART_INNER_HEIGHT = CHART_HEIGHT - CHART_PAD_TOP - CHART_PAD_BOTTOM;

const HOURLY_TICK_STEP = 6;
const DAILY_BAR_MAX_WIDTH = 48;
const DAILY_BAR_SLOT_RATIO = 0.6;
const DAILY_BAR_MIN_HEIGHT = 6;

interface HourlyTickMarker {
  readonly timeIso: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
}

/** Precomputed geometry for rendering the 48-hour accessible US AQI chart. */
export interface HourlyChartGeometry {
  readonly minHourly: number;
  readonly maxHourly: number;
  readonly chartMax: number;
  readonly thresholdY: number;
  readonly polylinePoints: string;
  readonly tickMarkers: readonly HourlyTickMarker[];
}

interface DailyBarGeometry {
  readonly dateIso: string;
  readonly dateLabel: string;
  readonly avgUsAqi: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Precomputed bar rectangles and upper axis bound for the 7-day trend chart. */
export interface DailyChartGeometry {
  readonly dailyMax: number;
  readonly bars: readonly DailyBarGeometry[];
}

/** Computes the horizontal SVG X coordinate for an indexed forecast point. */
export function computeHourlyX(index: number, count: number): number {
  if (count <= 1) {
    return CHART_PAD_LEFT + CHART_INNER_WIDTH / 2;
  }
  return CHART_PAD_LEFT + (index / (count - 1)) * CHART_INNER_WIDTH;
}

/** Computes the vertical SVG Y coordinate for a US AQI value within the chart domain. */
export function computeChartY(usAqi: number, chartMax: number): number {
  const safeMax = Math.max(1, chartMax);
  return CHART_PAD_TOP + CHART_INNER_HEIGHT - (usAqi / safeMax) * CHART_INNER_HEIGHT;
}

/** Computes SVG polyline coordinates, threshold guide, and sampled ticks for 48h forecasts. */
export function buildHourlyGeometry(hourly: readonly HourlyForecastPoint[]): HourlyChartGeometry {
  const values = hourly.map((point) => point.usAqi);
  const minHourly = values.length > 0 ? Math.min(...values) : 0;
  const maxHourly = values.length > 0 ? Math.max(...values) : DEFAULT_CHART_MAX_AQI;
  const chartMax = Math.max(DEFAULT_CHART_MAX_AQI, maxHourly + CHART_HEADROOM_AQI);
  const thresholdY = Math.round(computeChartY(DEFAULT_CHART_MAX_AQI, chartMax));

  const polylinePoints = hourly
    .map((point, index) => {
      const x = Math.round(computeHourlyX(index, hourly.length));
      const y = Math.round(computeChartY(point.usAqi, chartMax));
      return `${x},${y}`;
    })
    .join(" ");

  const tickMarkers: HourlyTickMarker[] = [];
  hourly.forEach((point, index) => {
    if (index % HOURLY_TICK_STEP === 0) {
      tickMarkers.push({
        timeIso: point.timeIso,
        label: point.timeIso.slice(ISO_SLICE.hourStart, ISO_SLICE.minuteEnd),
        x: computeHourlyX(index, hourly.length),
        y: computeChartY(point.usAqi, chartMax),
      });
    }
  });

  return { minHourly, maxHourly, chartMax, thresholdY, polylinePoints, tickMarkers };
}

/** Computes SVG bar positions and heights for 7-day trend visualization. */
export function buildDailyGeometry(daily: readonly DailyTrendPoint[]): DailyChartGeometry {
  const maxCandidates = daily.map((day) => day.maxUsAqi);
  const dailyMax = Math.max(DEFAULT_CHART_MAX_AQI, ...maxCandidates);
  const slotWidth = CHART_INNER_WIDTH / Math.max(1, daily.length);
  const width = Math.min(DAILY_BAR_MAX_WIDTH, slotWidth * DAILY_BAR_SLOT_RATIO);

  const bars: DailyBarGeometry[] = daily.map((day, index) => {
    const x = CHART_PAD_LEFT + index * slotWidth + (slotWidth - width) / 2;
    const height = Math.max(DAILY_BAR_MIN_HEIGHT, (day.avgUsAqi / dailyMax) * CHART_INNER_HEIGHT);
    const y = CHART_PAD_TOP + CHART_INNER_HEIGHT - height;
    return {
      dateIso: day.dateIso,
      dateLabel: day.dateIso.slice(ISO_SLICE.monthDayStart),
      avgUsAqi: day.avgUsAqi,
      x,
      y,
      width,
      height,
    };
  });

  return { dailyMax, bars };
}
