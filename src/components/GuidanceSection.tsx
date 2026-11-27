// ============================================================================
// src/components/GuidanceSection.tsx
// Renders resident profile controls, personalized protection advice, and hacks.
// ============================================================================

"use client";

import { useTranslations } from "next-intl";
import { assessWinterSmog } from "@/domain/aqi";
import { buildIndoorAirHacks, buildPersonaGuidance } from "@/domain/guidance";
import { ISO_SLICE } from "@/lib/constants";
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

const f = <K extends keyof ResidentProfile, O extends string>(
  key: K,
  id: string,
  options: readonly O[],
  meta: readonly [string, string],
) => ({ key, id, options, label: meta[0], prefix: meta[1] });

const PROFILE_FIELDS = [
  f("persona", "persona-select", PERSONAS, ["personaLabel", "personas"]),
  f("commuteMode", "commute-select", COMMUTES, ["commuteLabel", "commutes"]),
  f("homeEnergyMode", "energy-select", ENERGIES, ["energyLabel", "energies"]),
  f("filtrationMode", "filtration-select", FILTRATIONS, ["filtrationLabel", "filtrations"]),
] as const;

const pickOpt = <T extends string>(opts: readonly T[], val: string, cur: T): T =>
  opts.find((v) => v === val) ?? cur;

function applyProfileSelection(
  p: ResidentProfile,
  k: keyof ResidentProfile,
  v: string,
): ResidentProfile {
  if (k === "persona") return { ...p, persona: pickOpt(PERSONAS, v, p.persona) };
  if (k === "commuteMode") return { ...p, commuteMode: pickOpt(COMMUTES, v, p.commuteMode) };
  if (k === "homeEnergyMode")
    return { ...p, homeEnergyMode: pickOpt(ENERGIES, v, p.homeEnergyMode) };
  return { ...p, filtrationMode: pickOpt(FILTRATIONS, v, p.filtrationMode) };
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

function GuidanceSummaryCards({ guidance }: { readonly guidance: PersonaGuidance }) {
  const t = useTranslations("guidance");
  const cards = [
    { title: t("maskCardTitle"), body: t(`maskAdvice.${guidance.maskAdvice}`) },
    {
      title: t("windowsCardTitle"),
      body: t(`windowsAdvice.${guidance.windowsAdvice}`),
      note: guidance.recommendedWindowIso
        ? t("cleanestWindowNote", {
            time: guidance.recommendedWindowIso.slice(ISO_SLICE.hourStart, ISO_SLICE.minuteEnd),
          })
        : undefined,
    },
    { title: t("outdoorCardTitle"), body: t(`outdoorAdvice.${guidance.outdoorAdvice}`) },
  ];
  return (
    <>
      <div className="mt-5 grid gap-4 md:grid-cols-3" aria-live="polite">
        {cards.map((card) => (
          <div key={card.title} className="rounded-lg border border-borderc bg-surface p-4">
            <h3 className="text-base font-bold text-ink">{card.title}</h3>
            <p className="mt-2 text-sm text-ink">{card.body}</p>
            {card.note && <p className="mt-2 text-xs font-semibold text-ink-muted">{card.note}</p>}
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-lg border border-borderc bg-surface p-4">
        <h3 className="text-base font-bold text-ink">{t("checklistTitle")}</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink">
          {guidance.checklistKeys.map((key) => (
            <li key={key}>{t(`checklist.${key}`)}</li>
          ))}
        </ul>
      </div>
    </>
  );
}

function IndoorHacksList({ hacks }: { readonly hacks: readonly IndoorAirHack[] }) {
  const t = useTranslations("guidance");
  return (
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
  );
}

/** Renders personalized household guidance (mask, windows, activity) and indoor air hacks. */
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
      <GuidanceSummaryCards guidance={guidance} />
      <IndoorHacksList hacks={hacks} />
    </section>
  );
}
