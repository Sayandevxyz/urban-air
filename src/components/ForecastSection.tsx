// ============================================================================
// src/components/ForecastSection.tsx
// Pairs 48h and 7-day SVG charts with toggleable semantic HTML data tables.
// ============================================================================

"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { DailyTrend, HourlyChart } from "@/components/ForecastCharts";
import { HOURLY_PREVIEW_COUNT, ISO_SLICE } from "@/lib/constants";
import type { AirQualityReport, DailyTrendPoint, HourlyForecastPoint } from "@/types/air-quality";

function ForecastTableShell({
  captionId,
  caption,
  headerKeys,
  children,
}: {
  readonly captionId: string;
  readonly caption: string;
  readonly headerKeys: readonly string[];
  readonly children: ReactNode;
}) {
  const t = useTranslations("forecast");
  return (
    <div
      tabIndex={0}
      role="region"
      aria-labelledby={captionId}
      className="mt-4 max-h-80 overflow-auto rounded-lg border border-borderc"
    >
      <table className="w-full border-collapse text-left text-sm">
        <caption id={captionId} className="p-2 text-left font-semibold text-ink">
          {caption}
        </caption>
        <thead className="sticky top-0 bg-surface-muted text-ink">
          <tr>
            {headerKeys.map((key) => (
              <th key={key} scope="col" className="p-2.5 font-bold">
                {t(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function HourlyRows({ hourly }: { readonly hourly: readonly HourlyForecastPoint[] }) {
  return hourly.slice(0, HOURLY_PREVIEW_COUNT).map((point) => (
    <tr key={point.timeIso} className="border-t border-borderc">
      <th scope="row" className="p-2.5 font-medium text-ink">
        {point.timeIso.slice(0, ISO_SLICE.minuteEnd).replace("T", " ")}
      </th>
      <td className="p-2.5 tabular-nums">{point.usAqi}</td>
      <td className="p-2.5 tabular-nums">{point.europeanAqi}</td>
      <td className="p-2.5 tabular-nums">{point.pm25}</td>
      <td className="p-2.5 tabular-nums">{point.no2}</td>
      <td className="p-2.5 tabular-nums">{point.o3}</td>
    </tr>
  ));
}

function DailyRows({ daily }: { readonly daily: readonly DailyTrendPoint[] }) {
  return daily.map((day) => (
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
  ));
}

function ForecastDataTable({
  activeRange,
  hourly,
  daily,
}: {
  readonly activeRange: "hourly" | "daily";
  readonly hourly: readonly HourlyForecastPoint[];
  readonly daily: readonly DailyTrendPoint[];
}) {
  const t = useTranslations("forecast");
  if (activeRange === "hourly") {
    return (
      <ForecastTableShell
        captionId="hourly-table-caption"
        caption={t("tableCaptionHourly")}
        headerKeys={["tableTime", "tableUsAqi", "tableEuAqi", "tablePm25", "tableNo2", "tableO3"]}
      >
        <HourlyRows hourly={hourly} />
      </ForecastTableShell>
    );
  }
  return (
    <ForecastTableShell
      captionId="daily-table-caption"
      caption={t("tableCaptionDaily")}
      headerKeys={["tableDate", "tableAvgAqi", "tableRangeAqi", "tablePm25"]}
    >
      <DailyRows daily={daily} />
    </ForecastTableShell>
  );
}

function ForecastRangeControls({
  activeRange,
  showTable,
  onSelectRange,
  onToggleTable,
}: {
  readonly activeRange: "hourly" | "daily";
  readonly showTable: boolean;
  readonly onSelectRange: (next: "hourly" | "daily") => void;
  readonly onToggleTable: () => void;
}) {
  const t = useTranslations("forecast");
  const baseBtn = "min-h-[44px] rounded-lg border-2 px-3 py-2 text-sm font-semibold";
  const tabClass = (active: boolean) =>
    `${baseBtn} ${active ? "border-accent bg-accent text-accent-ink" : "border-borderc bg-surface text-ink hover:bg-surface-muted"}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label={t("sectionTitle")} className="flex flex-wrap gap-2">
        {(["hourly", "daily"] as const).map((range) => (
          <button
            key={range}
            type="button"
            aria-pressed={activeRange === range}
            onClick={() => {
              onSelectRange(range);
            }}
            className={tabClass(activeRange === range)}
          >
            {t(range === "hourly" ? "hourlyTab" : "dailyTab")}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-pressed={showTable}
        onClick={onToggleTable}
        className={`${baseBtn} border-borderc-strong bg-surface text-ink hover:bg-surface-muted`}
      >
        {t(showTable ? "showChart" : "showTable")}
      </button>
    </div>
  );
}

/** Interactive forecast section pairing accessible SVG charts with semantic HTML data tables. */
export function ForecastSection({ report }: { readonly report: AirQualityReport }) {
  const t = useTranslations("forecast");
  const [activeRange, setActiveRange] = useState<"hourly" | "daily">("hourly");
  const [showTable, setShowTable] = useState(false);

  return (
    <section
      id="forecast"
      className="rounded-xl border border-borderc bg-surface-elevated p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="forecast-heading" className="text-xl font-bold text-ink">
          {t("sectionTitle")}
        </h2>
        <ForecastRangeControls
          activeRange={activeRange}
          showTable={showTable}
          onSelectRange={setActiveRange}
          onToggleTable={() => {
            setShowTable((prev) => !prev);
          }}
        />
      </div>
      {showTable ? (
        <ForecastDataTable activeRange={activeRange} hourly={report.hourly} daily={report.daily} />
      ) : activeRange === "hourly" ? (
        <HourlyChart cityName={report.location.name} hourly={report.hourly} />
      ) : (
        <DailyTrend cityName={report.location.name} daily={report.daily} />
      )}
    </section>
  );
}
