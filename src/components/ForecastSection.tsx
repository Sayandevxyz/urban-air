"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { DailyTrend } from "@/components/DailyTrend";
import { ForecastDataTable } from "@/components/ForecastDataTable";
import { HourlyChart } from "@/components/HourlyChart";
import type { AirQualityReport } from "@/domain/types";

interface ForecastSectionProps {
  readonly report: AirQualityReport;
}

/**
 * Interactive forecast section pairing accessible SVG charts with semantic HTML data tables.
 */
export function ForecastSection({ report }: ForecastSectionProps) {
  const t = useTranslations("forecast");
  const [activeRange, setActiveRange] = useState<"hourly" | "daily">("hourly");
  const [showTable, setShowTable] = useState(false);

  const tabClass = (active: boolean) =>
    `min-h-[44px] rounded-lg border-2 px-3 py-2 text-sm font-semibold ${
      active
        ? "border-accent bg-accent text-accent-ink"
        : "border-borderc bg-surface text-ink hover:bg-surface-muted"
    }`;

  return (
    <section
      id="forecast"
      className="rounded-xl border border-borderc bg-surface-elevated p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="forecast-heading" className="text-xl font-bold text-ink">
          {t("sectionTitle")}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={t("sectionTitle")} className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={activeRange === "hourly"}
              onClick={() => {
                setActiveRange("hourly");
              }}
              className={tabClass(activeRange === "hourly")}
            >
              {t("hourlyTab")}
            </button>
            <button
              type="button"
              aria-pressed={activeRange === "daily"}
              onClick={() => {
                setActiveRange("daily");
              }}
              className={tabClass(activeRange === "daily")}
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
