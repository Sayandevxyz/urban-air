import { useTranslations } from "next-intl";
import type { RoutineAlternative } from "@/domain/types";

interface RoutineListProps {
  readonly routines: readonly RoutineAlternative[];
}

/**
 * Renders tailored low-emission daily routine cards with localized explanations of environmental impact.
 */
export function RoutineList({ routines }: RoutineListProps) {
  const t = useTranslations("routines");

  return (
    <div>
      <h2 id="routines-heading" className="text-xl font-bold text-ink">
        {t("sectionTitle")}
      </h2>
      <h3 className="mt-4 text-lg font-bold text-ink">{t("routinesTitle")}</h3>

      <ul className="mt-3 grid gap-4 md:grid-cols-2">
        {routines.map((routine) => (
          <li key={routine.id} className="rounded-lg border border-borderc bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-base font-bold text-ink">{t(`items.${routine.id}.title`)}</h4>
              <span className="shrink-0 rounded-full border border-borderc-strong px-2.5 py-0.5 text-xs font-bold text-ink">
                {routine.priority === "high" ? t("priorityHigh") : t("priorityMedium")}
              </span>
            </div>
            <p className="mt-2 text-sm text-ink-muted">{t(`items.${routine.id}.desc`)}</p>
            <p className="mt-2 rounded bg-surface-muted p-2 text-xs font-semibold text-ink">
              {t(`items.${routine.id}.whyImpact`)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
