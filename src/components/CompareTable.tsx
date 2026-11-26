import { useTranslations } from "next-intl";
import {
  assessPollutants,
  assessWinterSmog,
  classifyUsAqi,
  findDominantPollutant,
} from "@/domain/aqi";
import { scoreActivityWindows } from "@/domain/planner";
import type { AirQualityReport, CityLocation } from "@/domain/types";

interface CompareTableProps {
  readonly cities: readonly CityLocation[];
  readonly reports: Readonly<Record<string, AirQualityReport>>;
  readonly loading: boolean;
  readonly onRemoveCity: (cityKey: string) => void;
}

/**
 * Accessible keyboard-scrollable comparison table for up to 3 selected cities.
 */
export function CompareTable({ cities, reports, loading, onRemoveCity }: CompareTableProps) {
  const t = useTranslations("compare");
  const tDash = useTranslations("dashboard");
  const tPol = useTranslations("pollutants");
  const headers = [
    "cityCol",
    "usAqiCol",
    "euAqiCol",
    "dominantCol",
    "smogCol",
    "bestHourCol",
  ] as const;

  return (
    <div
      tabIndex={0}
      role="region"
      aria-labelledby="compare-table-caption"
      aria-busy={loading}
      className="relative mt-4 overflow-x-auto rounded-lg border border-borderc"
    >
      <table className="w-full border-collapse text-left text-sm">
        <caption id="compare-table-caption" className="p-2.5 text-left font-semibold text-ink">
          {t("sectionTitle")}
        </caption>
        <thead className="bg-surface-muted text-ink">
          <tr>
            {headers.map((key) => (
              <th key={key} scope="col" className="p-3 font-bold">
                {t(key)}
              </th>
            ))}
            <th scope="col" className="relative p-3 font-bold">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {cities.map((city) => {
            const rep = reports[city.key];
            if (!rep) return null;
            const usMeta = classifyUsAqi(rep.current.usAqi);
            const dominant = findDominantPollutant(assessPollutants(rep.current.readings));
            const smog = assessWinterSmog(rep.current.usAqi, rep.current.readings);
            const best = scoreActivityWindows(rep.hourly, "walk", "general").bestWindow;
            return (
              <tr key={city.key} className="border-t border-borderc">
                <th scope="row" className="p-3 font-bold text-ink">
                  {city.name}
                </th>
                <td className="p-3 font-semibold tabular-nums">
                  {rep.current.usAqi} ({tDash(`categories.${usMeta.category}`)})
                </td>
                <td className="p-3 tabular-nums">{rep.current.europeanAqi}</td>
                <td className="p-3">{tPol(`items.${dominant}.name`)}</td>
                <td className="p-3 font-semibold">{t(`smogSeverity.${smog.severity}`)}</td>
                <td className="p-3 tabular-nums">
                  {best ? `${best.timeIso.slice(11, 16)} UTC` : "—"}
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => {
                      onRemoveCity(city.key);
                    }}
                    className="min-h-[44px] rounded-md border border-borderc-strong px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-muted"
                  >
                    {t("removeCity", { city: city.name })}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
