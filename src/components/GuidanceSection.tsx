"use client";

import { useTranslations } from "next-intl";
import { assessWinterSmog } from "@/domain/aqi";
import { buildIndoorAirHacks, buildPersonaGuidance } from "@/domain/guidance";
import type {
  AirQualityReport,
  CommuteMode,
  FiltrationMode,
  HomeEnergyMode,
  PersonaId,
  ResidentProfile,
} from "@/domain/types";

interface GuidanceSectionProps {
  readonly report: AirQualityReport;
  readonly profile: ResidentProfile;
  readonly onChangeProfile: (next: ResidentProfile) => void;
}

const PERSONA_OPTIONS: readonly PersonaId[] = [
  "general",
  "children",
  "elderly",
  "asthma",
  "pregnant",
  "athlete",
  "worker",
];
const COMMUTE_OPTIONS: readonly CommuteMode[] = ["car", "transit", "two_wheeler", "walk_cycle"];
const ENERGY_OPTIONS: readonly HomeEnergyMode[] = ["gas_biomass", "electric_induction"];
const FILTRATION_OPTIONS: readonly FiltrationMode[] = ["none", "hepa", "diy_box_fan"];

/**
 * Renders personalized household guidance (mask, windows, activity) and contextual indoor air hacks.
 */
export function GuidanceSection({ report, profile, onChangeProfile }: GuidanceSectionProps) {
  const t = useTranslations("guidance");
  const smog = assessWinterSmog(report.current.usAqi, report.current.readings);
  const guidance = buildPersonaGuidance(
    report.current.usAqi,
    smog,
    report.current.readings,
    profile,
    report.hourly,
  );
  const hacks = buildIndoorAirHacks(report.current.usAqi, smog, report.current.readings, profile);

  return (
    <section
      id="guidance"
      aria-labelledby="guidance-heading"
      className="rounded-xl border border-borderc bg-surface-elevated p-4 shadow-sm sm:p-6"
    >
      <h2 id="guidance-heading" className="text-xl font-bold text-ink">
        {t("sectionTitle")}
      </h2>

      <fieldset className="mt-4 rounded-lg border border-borderc bg-surface p-4">
        <legend className="px-2 text-sm font-bold text-ink">{t("profileLegend")}</legend>

        <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="persona-select" className="block text-sm font-semibold text-ink">
              {t("personaLabel")}
            </label>
            <select
              id="persona-select"
              name="persona"
              value={profile.persona}
              onChange={(event) => {
                const next = PERSONA_OPTIONS.find((item) => item === event.target.value);
                if (next) onChangeProfile({ ...profile, persona: next });
              }}
              className="mt-1 min-h-[48px] w-full rounded-lg border-2 border-borderc-strong bg-surface-elevated px-3 py-2 text-base text-ink"
            >
              {PERSONA_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {t(`personas.${p}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="commute-select" className="block text-sm font-semibold text-ink">
              {t("commuteLabel")}
            </label>
            <select
              id="commute-select"
              name="commuteMode"
              value={profile.commuteMode}
              onChange={(event) => {
                const next = COMMUTE_OPTIONS.find((item) => item === event.target.value);
                if (next) onChangeProfile({ ...profile, commuteMode: next });
              }}
              className="mt-1 min-h-[48px] w-full rounded-lg border-2 border-borderc-strong bg-surface-elevated px-3 py-2 text-base text-ink"
            >
              {COMMUTE_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {t(`commutes.${c}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="energy-select" className="block text-sm font-semibold text-ink">
              {t("energyLabel")}
            </label>
            <select
              id="energy-select"
              name="homeEnergyMode"
              value={profile.homeEnergyMode}
              onChange={(event) => {
                const next = ENERGY_OPTIONS.find((item) => item === event.target.value);
                if (next) onChangeProfile({ ...profile, homeEnergyMode: next });
              }}
              className="mt-1 min-h-[48px] w-full rounded-lg border-2 border-borderc-strong bg-surface-elevated px-3 py-2 text-base text-ink"
            >
              {ENERGY_OPTIONS.map((e) => (
                <option key={e} value={e}>
                  {t(`energies.${e}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filtration-select" className="block text-sm font-semibold text-ink">
              {t("filtrationLabel")}
            </label>
            <select
              id="filtration-select"
              name="filtrationMode"
              value={profile.filtrationMode}
              onChange={(event) => {
                const next = FILTRATION_OPTIONS.find((item) => item === event.target.value);
                if (next) onChangeProfile({ ...profile, filtrationMode: next });
              }}
              className="mt-1 min-h-[48px] w-full rounded-lg border-2 border-borderc-strong bg-surface-elevated px-3 py-2 text-base text-ink"
            >
              {FILTRATION_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {t(`filtrations.${f}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

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
              {t("cleanestWindowNote", {
                time: guidance.recommendedWindowIso.slice(11, 16),
              })}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-borderc bg-surface p-4">
          <h3 className="text-base font-bold text-ink">{t("outdoorCardTitle")}</h3>
          <p className="mt-2 text-sm text-ink">{t(`outdoorAdvice.${guidance.outdoorAdvice}`)}</p>
        </div>
      </div>

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
    </section>
  );
}
