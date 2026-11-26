import { useTranslations } from "next-intl";
import type { DailyTrendPoint, HourlyForecastPoint } from "@/domain/types";
import { HOURLY_PREVIEW_COUNT } from "@/lib/constants";

interface ForecastDataTableProps {
  readonly activeRange: "hourly" | "daily";
  readonly hourly: readonly HourlyForecastPoint[];
  readonly daily: readonly DailyTrendPoint[];
}

function HourlyTable({ hourly }: { readonly hourly: readonly HourlyForecastPoint[] }) {
  const t = useTranslations("forecast");
  const headers = [
    "tableTime",
    "tableUsAqi",
    "tableEuAqi",
    "tablePm25",
    "tableNo2",
    "tableO3",
  ] as const;

  return (
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
            {headers.map((key) => (
              <th key={key} scope="col" className="p-2.5 font-bold">
                {t(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hourly.slice(0, HOURLY_PREVIEW_COUNT).map((point) => (
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
  );
}

function DailyTable({ daily }: { readonly daily: readonly DailyTrendPoint[] }) {
  const t = useTranslations("forecast");
  const headers = ["tableDate", "tableAvgAqi", "tableRangeAqi", "tablePm25"] as const;

  return (
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
            {headers.map((key) => (
              <th key={key} scope="col" className="p-2.5 font-bold">
                {t(key)}
              </th>
            ))}
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
  );
}

/**
 * Semantic HTML table alternative rendering exact hourly or daily forecast telemetry.
 */
export function ForecastDataTable({ activeRange, hourly, daily }: ForecastDataTableProps) {
  return activeRange === "hourly" ? <HourlyTable hourly={hourly} /> : <DailyTable daily={daily} />;
}
