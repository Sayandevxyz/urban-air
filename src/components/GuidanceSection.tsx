"use client";

import { useTranslations } from "next-intl";
import { assessWinterSmog } from "@/domain/aqi";
import { buildIndoorAirHacks, buildPersonaGuidance } from "@/domain/guidance";
import type { AirQualityReport } from "@/types/air-quality";
import type {
  CommuteMode,
  FiltrationMode,
  HomeEnergyMode,
  IndoorAirHack,
  PersonaGuidance,
  PersonaId,
  ResidentProfile,
} from "@/types/guidance";

const PERSONAS: readonly PersonaId[] = [
  "general",
  "children",
  "elderly",
  "asthma",
  "pregnant",
  "athlete",
  "worker",
];
const COMMUTES: readonly CommuteMode[] = ["car", "transit", "two_wheeler", "walk_cycle"];
const ENERGIES: readonly HomeEnergyMode[] = ["gas_biomass", "electric_induction"];
const FILTRATIONS: readonly FiltrationMode[] = ["none", "hepa", "diy_box_fan"];

const PROFILE_FIELDS = [
  {
    key: "persona",
    id: "persona-select",
    label: "personaLabel",
    options: PERSONAS,
    prefix: "personas",
  },
  {
    key: "commuteMode",
    id: "commute-select",
    label: "commuteLabel",
    options: COMMUTES,
    prefix: "commutes",
  },
  {
    key: "homeEnergyMode",
    id: "energy-select",
    label: "energyLabel",
    options: ENERGIES,
    prefix: "energies",
  },
  {
    key: "filtrationMode",
    id: "filtration-select",
    label: "filtrationLabel",
    options: FILTRATIONS,
    prefix: "filtrations",
  },
] as const;

function applyProfileSelection(
  profile: ResidentProfile,
  key: keyof ResidentProfile,
  value: string,
): ResidentProfile {
  const persona = key === "persona" ? PERSONAS.find((item) => item === value) : undefined;
  if (persona) return { ...profile, persona };
  const commute = key === "commuteMode" ? COMMUTES.find((item) => item === value) : undefined;
  if (commute) return { ...profile, commuteMode: commute };
  const energy = key === "homeEnergyMode" ? ENERGIES.find((item) => item === value) : undefined;
  if (energy) return { ...profile, homeEnergyMode: energy };
  const filtration =
    key === "filtrationMode" ? FILTRATIONS.find((item) => item === value) : undefined;
  return filtration ? { ...profile, filtrationMode: filtration } : profile;
}

function PersonaPicker({
  profile,
  onChangeProfile,
}: {
  readonly profile: ResidentProfile;
  readonly onChangeProfile: (next: ResidentProfile) => void;
}) {
  const t = useTranslations("guidance");
  return (
    <fieldset className="mt-4 rounded-lg border border-borderc bg-surface p-4">
      <legend className="px-2 text-sm font-bold text-ink">{t("profileLegend")}</legend>
      <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PROFILE_FIELDS.map((field) => (
          <div key={field.id}>
            <label htmlFor={field.id} className="block text-sm font-semibold text-ink">
              {t(field.label)}
            </label>
            <select
              id={field.id}
              name={field.key}
              value={profile[field.key]}
              onChange={(event) => {
                onChangeProfile(applyProfileSelection(profile, field.key, event.target.value));
              }}
              className="mt-1 min-h-[48px] w-full rounded-lg border-2 border-borderc-strong bg-surface-elevated px-3 py-2 text-base text-ink"
            >
              {field.options.map((opt) => (
                <option key={opt} value={opt}>
                  {t(`${field.prefix}.${opt}`)}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </fieldset>
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
