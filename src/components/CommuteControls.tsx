import { useTranslations } from "next-intl";
import { COMMUTE_MAX_KM, OUTDOOR_MAX_HOURS } from "@/lib/constants";

interface RoutineToggleItem {
  readonly key: string;
  readonly checked: boolean;
  readonly setter: (next: boolean) => void;
}

interface CommuteControlsProps {
  readonly commuteDistanceKm: number;
  readonly outdoorHours: number;
  readonly onChangeDistance: (val: number) => void;
  readonly onChangeOutdoorHours: (val: number) => void;
  readonly toggles: readonly RoutineToggleItem[];
}

/**
 * Renders numeric distance/hour inputs and low-emission routine toggles for the impact simulator.
 */
export function CommuteControls({
  commuteDistanceKm,
  outdoorHours,
  onChangeDistance,
  onChangeOutdoorHours,
  toggles,
}: CommuteControlsProps) {
  const t = useTranslations("routines");

  return (
    <>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="impact-distance-input" className="block text-sm font-semibold text-ink">
            {t("distanceLabel")}
          </label>
          <input
            id="impact-distance-input"
            type="number"
            min={0}
            max={COMMUTE_MAX_KM}
            step={1}
            value={commuteDistanceKm}
            onChange={(event) => {
              onChangeDistance(Number(event.target.value));
            }}
            className="mt-1 min-h-[48px] w-full rounded-lg border-2 border-borderc-strong bg-surface-elevated px-3 py-2 text-base text-ink"
          />
        </div>

        <div>
          <label htmlFor="impact-hours-input" className="block text-sm font-semibold text-ink">
            {t("outdoorHoursLabel")}
          </label>
          <input
            id="impact-hours-input"
            type="number"
            min={0}
            max={OUTDOOR_MAX_HOURS}
            step={0.5}
            value={outdoorHours}
            onChange={(event) => {
              onChangeOutdoorHours(Number(event.target.value));
            }}
            className="mt-1 min-h-[48px] w-full rounded-lg border-2 border-borderc-strong bg-surface-elevated px-3 py-2 text-base text-ink"
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {toggles.map(({ key, checked, setter }) => (
          <div key={key} className="flex min-h-[44px] items-center gap-3">
            <input
              id={`toggle-${key}`}
              type="checkbox"
              checked={checked}
              onChange={(event) => {
                setter(event.target.checked);
              }}
              className="h-5 w-5 shrink-0 accent-accent"
            />
            <label htmlFor={`toggle-${key}`} className="text-sm font-medium text-ink">
              {t(`toggles.${key}`)}
            </label>
          </div>
        ))}
      </div>
    </>
  );
}
