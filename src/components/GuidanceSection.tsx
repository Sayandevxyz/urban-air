"use client";

import { useTranslations } from "next-intl";
import { AdviceList } from "@/components/AdviceList";
import { PersonaPicker } from "@/components/PersonaPicker";
import { assessWinterSmog } from "@/domain/aqi";
import { buildIndoorAirHacks, buildPersonaGuidance } from "@/domain/guidance";
import type { AirQualityReport, ResidentProfile } from "@/domain/types";

interface GuidanceSectionProps {
  readonly report: AirQualityReport;
  readonly profile: ResidentProfile;
  readonly onChangeProfile: (next: ResidentProfile) => void;
}

/**
 * Renders personalized household guidance (mask, windows, activity) and contextual indoor air hacks.
 */
export function GuidanceSection({ report, profile, onChangeProfile }: GuidanceSectionProps) {
  const t = useTranslations("guidance");
  const smog = assessWinterSmog(report.current.usAqi, report.current.readings);
  const guidance = buildPersonaGuidance({
    usAqi: report.current.usAqi,
    smog,
    readings: report.current.readings,
    profile,
    hourly: report.hourly,
  });
  const hacks = buildIndoorAirHacks(report.current.usAqi, smog, report.current.readings, profile);

  return (
    <section
      id="guidance"
      className="rounded-xl border border-borderc bg-surface-elevated p-4 shadow-sm sm:p-6"
    >
      <h2 id="guidance-heading" className="text-xl font-bold text-ink">
        {t("sectionTitle")}
      </h2>
      <PersonaPicker profile={profile} onChangeProfile={onChangeProfile} />
      <AdviceList guidance={guidance} hacks={hacks} />
    </section>
  );
}
