// ============================================================================
// src/components/UiPrimitives.tsx
// Provides reusable card containers, tone surfaces, and accessible inputs.
// ============================================================================

import type { ReactNode } from "react";
import { TONE_SURFACE_CLASSES } from "@/lib/constants";

export { TONE_SURFACE_CLASSES };

const SECTION_CARD_CLASS =
  "rounded-xl border border-borderc bg-surface-elevated p-4 shadow-sm sm:p-6";
const FIELD_INPUT_CLASS =
  "mt-1 min-h-[48px] w-full rounded-lg border-2 border-borderc-strong px-3 py-2 text-base text-ink";

/** Elevated card landmark wrapper ensuring consistent spacing and border tokens. */
export function SectionCard({
  id,
  className,
  children,
}: {
  readonly id?: string;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={className ? `${className} ${SECTION_CARD_CLASS}` : SECTION_CARD_CLASS}
    >
      {children}
    </section>
  );
}

/** Accessible labeled select control with 48px touch target height. */
export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly { readonly value: string; readonly label: string }[];
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className={`${FIELD_INPUT_CLASS} bg-surface`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface NumericFieldProps {
  readonly id: string;
  readonly label: string;
  readonly min?: number;
  readonly max: number;
  readonly step?: number;
  readonly value: string | number;
  readonly surfaceClassName?: string;
  readonly invalid?: boolean;
  readonly errorId?: string;
  readonly errorText?: string;
  readonly onChange: (value: string) => void;
}

/** Accessible numeric field supporting range constraints and inline validation errors. */
export function NumericField({
  id,
  label,
  min = 0,
  max,
  step,
  value,
  surfaceClassName = "bg-surface",
  invalid,
  errorId,
  errorText,
  onChange,
}: NumericFieldProps) {
  const showError = Boolean(invalid && errorText && errorId);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-invalid={invalid}
        aria-describedby={showError ? errorId : undefined}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className={`${FIELD_INPUT_CLASS} ${surfaceClassName}`}
      />
      {showError && (
        <p id={errorId} className="mt-1 text-xs font-semibold text-rose-800 dark:text-rose-200">
          {errorText}
        </p>
      )}
    </div>
  );
}
