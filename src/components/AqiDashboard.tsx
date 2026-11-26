"use client";

import { useTranslations } from "next-intl";
import { AqiHeadline } from "@/components/AqiHeadline";
import { AqiSeverityIcon } from "@/components/icons/AqiIcons";
import { PollutantGrid } from "@/components/PollutantGrid";
import { assessPollutants, assessWinterSmog, findDominantPollutant } from "@/domain/aqi";
import type { AirQualityReport } from "@/domain/types";

interface AqiDashboardProps {
  readonly report: AirQualityReport;
}

/**
 * Live AQI dashboard presenting severe winter smog alerts, dual AQI scales, and WHO pollutants.
 */
export function AqiDashboard({ report }: AqiDashboardProps) {
  const tDash = useTranslations("dashboard");
  const assessments = assessPollutants(report.current.readings);
  const dominant = findDominantPollutant(assessments);
  const smog = assessWinterSmog(report.current.usAqi, report.current.readings);

  return (
    <section id="dashboard" className="space-y-5" aria-live="polite">
      {smog.isWinterSmogAlert && (
        <div
          role="alert"
          className="rounded-xl border-2 border-rose-800 bg-rose-50 p-4 text-rose-950 shadow-sm dark:border-rose-300 dark:bg-rose-950/80 dark:text-rose-50"
        >
          <div className="flex items-start gap-3">
            <AqiSeverityIcon iconId="smog-danger" className="mt-0.5 h-6 w-6 shrink-0" />
            <div>
              <h2 className="text-lg font-bold">
                {smog.severity === "smog_emergency"
                  ? tDash("smogAlertEmergencyTitle")
                  : tDash("smogAlertSevereTitle")}
              </h2>
              <p className="mt-1 text-sm">{tDash("smogAlertBody")}</p>
              {smog.inversionTrapLikely && (
                <p className="mt-1 text-sm font-semibold">{tDash("inversionNote")}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <AqiHeadline report={report} dominant={dominant} />
      <PollutantGrid assessments={assessments} />
    </section>
  );
}
