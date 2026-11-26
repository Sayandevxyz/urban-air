"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { AirQualityReport } from "@/domain/types";

interface ForecastSectionProps {
  readonly report: AirQualityReport;
}

const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const PAD_LEFT = 40;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

/**
 * Lightweight accessible SVG 48-hour forecast & 7-day trend with toggleable semantic data table.
 */
export function ForecastSection({ report }: ForecastSectionProps) {
  const t = useTranslations("forecast");
  const [activeRange, setActiveRange] = useState<"hourly" | "daily">("hourly");
  const [showTable, setShowTable] = useState(false);

  const hourly = report.hourly;
  const daily = report.daily;

  const hourlyValues = hourly.map((p) => p.usAqi);
  const minHourly = hourlyValues.length > 0 ? Math.min(...hourlyValues) : 0;
  const maxHourly = hourlyValues.length > 0 ? Math.max(...hourlyValues) : 100;
  const chartMax = Math.max(100, maxHourly + 20);

  const innerW = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

  const polylinePoints = hourly
    .map((point, index) => {
      const x =
        PAD_LEFT + (hourly.length <= 1 ? innerW / 2 : (index / (hourly.length - 1)) * innerW);
      const y = PAD_TOP + innerH - (point.usAqi / chartMax) * innerH;
      return `${Math.round(x)},${Math.round(y)}`;
    })
    .join(" ");

  const thresholdY = Math.round(PAD_TOP + innerH - (100 / chartMax) * innerH);

  return (
    <section
      id="forecast"
      aria-labelledby="forecast-heading"
      className="rounded-xl border border-borderc bg-surface-elevated p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="forecast-heading" className="text-xl font-bold text-ink">
          {t("sectionTitle")}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={t("sectionTitle")} className="flex gap-2">
            <button
              type="button"
              aria-pressed={activeRange === "hourly"}
              onClick={() => {
                setActiveRange("hourly");
              }}
              className={`min-h-[44px] rounded-lg border-2 px-3 py-2 text-sm font-semibold ${
                activeRange === "hourly"
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-borderc bg-surface text-ink hover:bg-surface-muted"
              }`}
            >
              {t("hourlyTab")}
            </button>
            <button
              type="button"
              aria-pressed={activeRange === "daily"}
              onClick={() => {
                setActiveRange("daily");
              }}
              className={`min-h-[44px] rounded-lg border-2 px-3 py-2 text-sm font-semibold ${
                activeRange === "daily"
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-borderc bg-surface text-ink hover:bg-surface-muted"
              }`}
            >
              {t("dailyTab")}
            </button>
          </div>

          <button
            type="button"
            aria-pressed={showTable}
            onClick={() => {
              setShowTable((prev) => !prev);
            }}
            className="min-h-[44px] rounded-lg border-2 border-borderc-strong bg-surface px-3 py-2 text-sm font-semibold text-ink hover:bg-surface-muted"
          >
            {showTable ? t("showChart") : t("showTable")}
          </button>
        </div>
      </div>

      {!showTable && activeRange === "hourly" && (
        <figure className="mt-4">
          <svg
            role="img"
            aria-label={t("hourlyChartLabel", {
              city: report.location.name,
              min: minHourly,
              max: maxHourly,
            })}
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="h-auto w-full rounded-lg border border-borderc bg-surface p-2"
          >
            <line
              x1={PAD_LEFT}
              y1={thresholdY}
              x2={CHART_WIDTH - PAD_RIGHT}
              y2={thresholdY}
              stroke="currentColor"
              strokeDasharray="6 4"
              strokeOpacity={0.5}
            />
            <text x={4} y={thresholdY + 4} fontSize={11} fill="currentColor">
              100
            </text>
            <text x={4} y={PAD_TOP + 10} fontSize={11} fill="currentColor">
              {chartMax}
            </text>
            <text x={4} y={CHART_HEIGHT - PAD_BOTTOM} fontSize={11} fill="currentColor">
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
            {hourly
              .filter((_, idx) => idx % 6 === 0)
              .map((point, i) => {
                const origIndex = i * 6;
                const x =
                  PAD_LEFT +
                  (hourly.length <= 1 ? innerW / 2 : (origIndex / (hourly.length - 1)) * innerW);
                const y = PAD_TOP + innerH - (point.usAqi / chartMax) * innerH;
                return (
                  <g key={point.timeIso}>
                    <circle cx={x} cy={y} r={4} fill="#0b57d0" />
                    <text
                      x={x}
                      y={CHART_HEIGHT - 8}
                      textAnchor="middle"
                      fontSize={10}
                      fill="currentColor"
                    >
                      {point.timeIso.slice(11, 16)}
                    </text>
                  </g>
                );
              })}
          </svg>
          <figcaption className="mt-2 text-sm text-ink-muted">
            {t("hourlyChartLabel", {
              city: report.location.name,
              min: minHourly,
              max: maxHourly,
            })}
          </figcaption>
        </figure>
      )}

      {!showTable && activeRange === "daily" && (
        <figure className="mt-4">
          <svg
            role="img"
            aria-label={t("dailyChartLabel", { city: report.location.name })}
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="h-auto w-full rounded-lg border border-borderc bg-surface p-2"
          >
            <defs>
              <pattern id="bar-stripe" width="6" height="6" patternUnits="userSpaceOnUse">
                <path d="M0 6 L6 0" stroke="#ffffff" strokeOpacity={0.35} strokeWidth="1.5" />
              </pattern>
            </defs>
            {daily.map((day, idx) => {
              const slotW = innerW / Math.max(1, daily.length);
              const barW = Math.min(48, slotW * 0.6);
              const x = PAD_LEFT + idx * slotW + (slotW - barW) / 2;
              const dailyMax = Math.max(100, ...daily.map((d) => d.maxUsAqi));
              const barH = Math.max(6, (day.avgUsAqi / dailyMax) * innerH);
              const y = PAD_TOP + innerH - barH;
              return (
                <g key={day.dateIso}>
                  <rect x={x} y={y} width={barW} height={barH} rx={4} fill="#0b57d0" />
                  <rect x={x} y={y} width={barW} height={barH} rx={4} fill="url(#bar-stripe)" />
                  <text
                    x={x + barW / 2}
                    y={y - 4}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight="bold"
                    fill="currentColor"
                  >
                    {day.avgUsAqi}
                  </text>
                  <text
                    x={x + barW / 2}
                    y={CHART_HEIGHT - 8}
                    textAnchor="middle"
                    fontSize={10}
                    fill="currentColor"
                  >
                    {day.dateIso.slice(5)}
                  </text>
                </g>
              );
            })}
          </svg>
          <figcaption className="mt-2 text-sm text-ink-muted">
            {t("dailyChartLabel", { city: report.location.name })}
          </figcaption>
        </figure>
      )}

      {showTable && activeRange === "hourly" && (
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="hourly-table-caption"
          className="mt-4 max-h-80 overflow-auto rounded-lg border border-borderc"
        >
          <table className="w-full border-collapse text-left text-sm">
            <caption id="hourly-table-caption" className="p-2 text-left font-semibold text-ink">
              {t("tableCaptionHourly")}
            </caption>
            <thead className="sticky top-0 bg-surface-muted text-ink">
              <tr>
                <th scope="col" className="p-2.5 font-bold">
                  {t("tableTime")}
                </th>
                <th scope="col" className="p-2.5 font-bold">
                  {t("tableUsAqi")}
                </th>
                <th scope="col" className="p-2.5 font-bold">
                  {t("tableEuAqi")}
                </th>
                <th scope="col" className="p-2.5 font-bold">
                  {t("tablePm25")}
                </th>
                <th scope="col" className="p-2.5 font-bold">
                  {t("tableNo2")}
                </th>
                <th scope="col" className="p-2.5 font-bold">
                  {t("tableO3")}
                </th>
              </tr>
            </thead>
            <tbody>
              {hourly.slice(0, 24).map((point) => (
                <tr key={point.timeIso} className="border-t border-borderc">
                  <th scope="row" className="p-2.5 font-medium text-ink">
                    {point.timeIso.slice(0, 16).replace("T", " ")}
                  </th>
                  <td className="p-2.5 tabular-nums">{point.usAqi}</td>
                  <td className="p-2.5 tabular-nums">{point.europeanAqi}</td>
                  <td className="p-2.5 tabular-nums">{point.pm25}</td>
                  <td className="p-2.5 tabular-nums">{point.no2}</td>
                  <td className="p-2.5 tabular-nums">{point.o3}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showTable && activeRange === "daily" && (
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="daily-table-caption"
          className="mt-4 overflow-auto rounded-lg border border-borderc"
        >
          <table className="w-full border-collapse text-left text-sm">
            <caption id="daily-table-caption" className="p-2 text-left font-semibold text-ink">
              {t("tableCaptionDaily")}
            </caption>
            <thead className="bg-surface-muted text-ink">
              <tr>
                <th scope="col" className="p-2.5 font-bold">
                  {t("tableDate")}
                </th>
                <th scope="col" className="p-2.5 font-bold">
                  {t("tableAvgAqi")}
                </th>
                <th scope="col" className="p-2.5 font-bold">
                  {t("tableRangeAqi")}
                </th>
                <th scope="col" className="p-2.5 font-bold">
                  {t("tablePm25")}
                </th>
              </tr>
            </thead>
            <tbody>
              {daily.map((day) => (
                <tr key={day.dateIso} className="border-t border-borderc">
                  <th scope="row" className="p-2.5 font-medium text-ink">
                    {day.dateIso}
                  </th>
                  <td className="p-2.5 tabular-nums">{day.avgUsAqi}</td>
                  <td className="p-2.5 tabular-nums">
                    {day.minUsAqi}–{day.maxUsAqi}
                  </td>
                  <td className="p-2.5 tabular-nums">{day.avgPm25}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
