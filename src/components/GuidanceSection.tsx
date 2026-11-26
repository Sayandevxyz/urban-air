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

function ProfileSelect<T extends string>({
  id,
  name,
  label,
  value,
  options,
  labelFor,
  onSelect,
}: {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly value: T;
  readonly options: readonly T[];
  readonly labelFor: (option: T) => string;
  readonly onSelect: (next: T) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(event) => {
          const matched = options.find((item) => item === event.target.value);
          if (matched !== undefined) {
            onSelect(matched);
          }
        }}
        className="mt-1 min-h-[48px] w-full rounded-lg border-2 border-borderc-strong bg-surface-elevated px-3 py-2 text-base text-ink"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {labelFor(opt)}
          </option>
        ))}
      </select>
    </div>
  );
}

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
      className="rounded-xl border border-borderc bg-surface-elevated p-4 shadow-sm sm:p-6"
    >
      <h2 id="guidance-heading" className="text-xl font-bold text-ink">
        {t("sectionTitle")}
      </h2>

      <fieldset className="mt-4 rounded-lg border border-borderc bg-surface p-4">
        <legend className="px-2 text-sm font-bold text-ink">{t("profileLegend")}</legend>

        <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ProfileSelect
            id="persona-select"
            name="persona"
            label={t("personaLabel")}
            value={profile.persona}
            options={PERSONA_OPTIONS}
            labelFor={(opt) => t(`personas.${opt}`)}
            onSelect={(next) => {
              onChangeProfile({ ...profile, persona: next });
            }}
          />
          <ProfileSelect
            id="commute-select"
            name="commuteMode"
            label={t("commuteLabel")}
            value={profile.commuteMode}
            options={COMMUTE_OPTIONS}
            labelFor={(opt) => t(`commutes.${opt}`)}
            onSelect={(next) => {
              onChangeProfile({ ...profile, commuteMode: next });
            }}
          />
          <ProfileSelect
            id="energy-select"
            name="homeEnergyMode"
            label={t("energyLabel")}
            value={profile.homeEnergyMode}
            options={ENERGY_OPTIONS}
            labelFor={(opt) => t(`energies.${opt}`)}
            onSelect={(next) => {
              onChangeProfile({ ...profile, homeEnergyMode: next });
            }}
          />
          <ProfileSelect
            id="filtration-select"
            name="filtrationMode"
            label={t("filtrationLabel")}
            value={profile.filtrationMode}
            options={FILTRATION_OPTIONS}
            labelFor={(opt) => t(`filtrations.${opt}`)}
            onSelect={(next) => {
              onChangeProfile({ ...profile, filtrationMode: next });
            }}
          />
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
