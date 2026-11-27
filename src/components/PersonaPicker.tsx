import { useTranslations } from "next-intl";
import type {
  CommuteMode,
  FiltrationMode,
  HomeEnergyMode,
  PersonaId,
  ResidentProfile,
} from "@/types/guidance";

interface PersonaPickerProps {
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
          if (matched !== undefined) onSelect(matched);
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
 * Household profile selector fieldset covering persona sensitivity, commute, energy, and filtration.
 */
export function PersonaPicker({ profile, onChangeProfile }: PersonaPickerProps) {
  const t = useTranslations("guidance");

  return (
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
          onSelect={(persona) => {
            onChangeProfile({ ...profile, persona });
          }}
        />
        <ProfileSelect
          id="commute-select"
          name="commuteMode"
          label={t("commuteLabel")}
          value={profile.commuteMode}
          options={COMMUTE_OPTIONS}
          labelFor={(opt) => t(`commutes.${opt}`)}
          onSelect={(commuteMode) => {
            onChangeProfile({ ...profile, commuteMode });
          }}
        />
        <ProfileSelect
          id="energy-select"
          name="homeEnergyMode"
          label={t("energyLabel")}
          value={profile.homeEnergyMode}
          options={ENERGY_OPTIONS}
          labelFor={(opt) => t(`energies.${opt}`)}
          onSelect={(homeEnergyMode) => {
            onChangeProfile({ ...profile, homeEnergyMode });
          }}
        />
        <ProfileSelect
          id="filtration-select"
          name="filtrationMode"
          label={t("filtrationLabel")}
          value={profile.filtrationMode}
          options={FILTRATION_OPTIONS}
          labelFor={(opt) => t(`filtrations.${opt}`)}
          onSelect={(filtrationMode) => {
            onChangeProfile({ ...profile, filtrationMode });
          }}
        />
      </div>
    </fieldset>
  );
}
