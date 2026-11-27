// ============================================================================
// src/hooks/useLocalAlerts.ts
// Stores local alert threshold rules and evaluates active warnings in memory.
// ============================================================================

"use client";

import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { evaluateThresholdAlerts } from "@/domain/alerts";
import { ALERT_DEFAULT_THRESHOLD, ALERT_THRESHOLD_MAX, ALERT_THRESHOLD_MIN } from "@/lib/constants";
import { safeJsonParse, toMap, toNum, toStr } from "@/lib/errors";
import type { AirQualityReport, CityLocation } from "@/types/air-quality";
import type { ThresholdAlertRule, TriggeredAlert } from "@/types/guidance";

const ALERTS_STORAGE_KEY = "urban-air:alerts:v1";
const RULE_ID_RANDOM_SPAN = 1_000;
const DEFAULT_RULES: readonly ThresholdAlertRule[] = [
  {
    id: "default-us-aqi-100",
    cityKey: "delhi",
    cityName: "Delhi",
    metric: "usAqi",
    threshold: ALERT_DEFAULT_THRESHOLD,
    enabled: true,
  },
];

function toValidRule(item: unknown): ThresholdAlertRule | null {
  try {
    const m = toMap(item);
    const metric = m.get("metric");
    const enabled = m.get("enabled");
    if ((metric !== "usAqi" && metric !== "pm25") || typeof enabled !== "boolean") return null;
    return {
      id: toStr(m.get("id")),
      cityKey: toStr(m.get("cityKey")),
      cityName: toStr(m.get("cityName")),
      metric,
      threshold: toNum(m.get("threshold")),
      enabled,
    };
  } catch {
    return null;
  }
}

function loadStoredRules(): readonly ThresholdAlertRule[] | null {
  try {
    const raw = window.localStorage.getItem(ALERTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = safeJsonParse(raw);
    if (!parsed.ok || !Array.isArray(parsed.value)) return null;
    return parsed.value.map(toValidRule).filter((r): r is ThresholdAlertRule => r !== null);
  } catch {
    return null;
  }
}

function persistRules(rules: readonly ThresholdAlertRule[]): void {
  try {
    window.localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(rules));
  } catch {
    // Ignore storage quota errors.
  }
}

type AlertAddInput = {
  cityKey: string;
  cityName: string;
  metric: "usAqi" | "pm25";
  threshold: number;
};

function parseValidAlertThreshold(rawValue: string): number | null {
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric) || numeric < ALERT_THRESHOLD_MIN || numeric > ALERT_THRESHOLD_MAX)
    return null;
  return Math.round(numeric);
}

/** Manages state and threshold range validation for creating a local alert rule. */
export function useAlertForm(
  cityOptions: readonly CityLocation[],
  defaultCityKey: string,
  onAddRule: (input: AlertAddInput) => void,
) {
  const [cityKey, setCityKey] = useState(defaultCityKey);
  const [metric, setMetric] = useState<"usAqi" | "pm25">("usAqi");
  const [thresholdRaw, setThresholdRaw] = useState(String(ALERT_DEFAULT_THRESHOLD));
  const [invalid, setInvalid] = useState(false);

  const updateMetric = (value: string) => {
    setMetric(value === "pm25" ? "pm25" : "usAqi");
  };
  const updateThreshold = (value: string) => {
    setThresholdRaw(value);
    setInvalid(false);
  };
  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    const threshold = parseValidAlertThreshold(thresholdRaw);
    if (threshold === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    const chosen = cityOptions.find((c) => c.key === cityKey) ?? cityOptions[0];
    if (chosen) onAddRule({ cityKey: chosen.key, cityName: chosen.name, metric, threshold });
  };

  return {
    cityKey,
    setCityKey,
    metric,
    updateMetric,
    thresholdRaw,
    updateThreshold,
    invalid,
    handleSubmit,
  };
}

/** Manages local browser threshold alert rules and evaluates active warnings against reports. */
export function useLocalAlerts(reportsByCityKey: Readonly<Record<string, AirQualityReport>>) {
  const [rules, setRules] = useState<readonly ThresholdAlertRule[]>(DEFAULT_RULES);
  useEffect(() => {
    const stored = loadStoredRules();
    if (stored) setRules(stored);
  }, []);

  const updateRules = useCallback(
    (updater: (prev: readonly ThresholdAlertRule[]) => readonly ThresholdAlertRule[]) => {
      setRules((prev) => {
        const next = updater(prev);
        persistRules(next);
        return next;
      });
    },
    [],
  );

  const addRule = useCallback(
    (input: { cityKey: string; cityName: string; metric: "usAqi" | "pm25"; threshold: number }) => {
      const id = `rule-${Date.now()}-${Math.round(Math.random() * RULE_ID_RANDOM_SPAN)}`;
      updateRules((prev) => [...prev, { ...input, id, enabled: true }]);
    },
    [updateRules],
  );
  const toggleRule = useCallback(
    (id: string) => {
      updateRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
    },
    [updateRules],
  );
  const removeRule = useCallback(
    (id: string) => {
      updateRules((prev) => prev.filter((r) => r.id !== id));
    },
    [updateRules],
  );

  const triggeredAlerts: readonly TriggeredAlert[] = useMemo(
    () => evaluateThresholdAlerts(rules, reportsByCityKey),
    [rules, reportsByCityKey],
  );
  return { rules, triggeredAlerts, addRule, toggleRule, removeRule };
}
