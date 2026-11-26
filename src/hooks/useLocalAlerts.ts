"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { evaluateThresholdAlerts } from "@/domain/alerts";
import type { AirQualityReport, ThresholdAlertRule, TriggeredAlert } from "@/domain/types";
import { ALERT_DEFAULT_THRESHOLD } from "@/lib/constants";
import { safeJsonParse } from "@/lib/json";

const ALERTS_STORAGE_KEY = "urban-air:alerts:v1";

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

function isThresholdAlertRule(item: unknown): item is ThresholdAlertRule {
  if (typeof item !== "object" || item === null) return false;
  const c = item as Partial<ThresholdAlertRule>;
  return (
    typeof c.id === "string" &&
    typeof c.cityKey === "string" &&
    typeof c.cityName === "string" &&
    (c.metric === "usAqi" || c.metric === "pm25") &&
    typeof c.threshold === "number" &&
    typeof c.enabled === "boolean"
  );
}

function loadStoredRules(): readonly ThresholdAlertRule[] | null {
  try {
    const raw = window.localStorage.getItem(ALERTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = safeJsonParse(raw);
    return parsed.ok && Array.isArray(parsed.value)
      ? parsed.value.filter(isThresholdAlertRule)
      : null;
  } catch {
    return null;
  }
}

/**
 * Manages local browser threshold alert rules and evaluates active warnings against fetched reports.
 */
export function useLocalAlerts(reportsByCityKey: Readonly<Record<string, AirQualityReport>>) {
  const [rules, setRules] = useState<readonly ThresholdAlertRule[]>(DEFAULT_RULES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = loadStoredRules();
    if (stored) setRules(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(rules));
    } catch {
      // Ignore storage quota errors.
    }
  }, [rules, hydrated]);

  const addRule = useCallback(
    (input: { cityKey: string; cityName: string; metric: "usAqi" | "pm25"; threshold: number }) => {
      const id = `rule-${Date.now()}-${Math.round(Math.random() * 1000)}`;
      setRules((prev) => [...prev, { ...input, id, enabled: true }]);
    },
    [],
  );

  const toggleRule = useCallback((ruleId: string) => {
    setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)));
  }, []);

  const removeRule = useCallback((ruleId: string) => {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
  }, []);

  const triggeredAlerts: readonly TriggeredAlert[] = useMemo(
    () => evaluateThresholdAlerts(rules, reportsByCityKey),
    [rules, reportsByCityKey],
  );

  return { rules, triggeredAlerts, addRule, toggleRule, removeRule };
}
