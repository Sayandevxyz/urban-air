"use client";

import { useTranslations } from "next-intl";
import { PersonaPicker } from "@/components/PersonaPicker";
import { assessWinterSmog } from "@/domain/aqi";
import { buildIndoorAirHacks, buildPersonaGuidance } from "@/domain/guidance";
import type { AirQualityReport } from "@/types/air-quality";
import type { IndoorAirHack, PersonaGuidance, ResidentProfile } from "@/types/guidance";

function GuidanceCards({ guidance }: { readonly guidance: PersonaGuidance }) {
  const t = useTranslations("guidance");
  return (
    <div className="mt-5 grid gap-4 md:grid-cols-3" aria-live="polite">
      <div className="rounded-lg border border-borderc bg-surface p-4">
        <h3 className="text-base font-bold text-ink">{t("maskCardTitle")}</h3>
        <p className="mt-2 text-sm text-ink">{t(`maskAdvice.${guidance.maskAdvice}`)}</p>
      </div>

      <div className="rounded-lg border border-borderc bg-surface p-4">
        <h3 className="text-base font-bold text-ink">{t("windowsCardTitle")}</h3>
        <p className="mt-2 text-sm text-ink">{t(`windowsAdvice.${guidance.windowsAdvice}`)}</p>
        {guidance.recommendedWindowIso && (
          <p className="mt-2 text-xs font-semibold text-ink-muted">
            {t("cleanestWindowNote", { time: guidance.recommendedWindowIso.slice(11, 16) })}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-borderc bg-surface p-4">
        <h3 className="text-base font-bold text-ink">{t("outdoorCardTitle")}</h3>
        <p className="mt-2 text-sm text-ink">{t(`outdoorAdvice.${guidance.outdoorAdvice}`)}</p>
      </div>
    </div>
  );
}

function AdviceList({
  guidance,
  hacks,
}: {
  readonly guidance: PersonaGuidance;
  readonly hacks: readonly IndoorAirHack[];
}) {
  const t = useTranslations("guidance");
  return (
    <>
      <GuidanceCards guidance={guidance} />

      <div className="mt-5 rounded-lg border border-borderc bg-surface p-4">
        <h3 className="text-base font-bold text-ink">{t("checklistTitle")}</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink">
          {guidance.checklistKeys.map((key) => (
            <li key={key}>{t(`checklist.${key}`)}</li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-bold text-ink">{t("indoorHacksTitle")}</h3>
        <ul className="mt-3 grid gap-4 sm:grid-cols-2">
          {hacks.map((hack) => (
            <li key={hack.id} className="rounded-lg border border-borderc bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-base font-bold text-ink">{t(`hacks.${hack.id}.title`)}</h4>
                <span className="shrink-0 rounded-full border border-borderc-strong px-2.5 py-0.5 text-xs font-bold text-ink">
                  {t(`priorityLabels.${hack.priority}`)}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink-muted">{t(`hacks.${hack.id}.desc`)}</p>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/**
 * Renders personalized household guidance (mask, windows, activity) and contextual indoor air hacks.
 */
export function GuidanceSection({
  report,
  profile,
  onChangeProfile,
}: {
  readonly report: AirQualityReport;
  readonly profile: ResidentProfile;
  readonly onChangeProfile: (next: ResidentProfile) => void;
}) {
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
