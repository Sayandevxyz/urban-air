"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { evaluateThresholdAlerts } from "@/domain/alerts";
import type { AirQualityReport, ThresholdAlertRule, TriggeredAlert } from "@/domain/types";

const ALERTS_STORAGE_KEY = "urban-air:alerts:v1";

const DEFAULT_RULES: readonly ThresholdAlertRule[] = [
  {
    id: "default-us-aqi-100",
    cityKey: "delhi",
    cityName: "Delhi",
    metric: "usAqi",
    threshold: 100,
    enabled: true,
  },
];

function isThresholdAlertRule(item: unknown): item is ThresholdAlertRule {
  if (typeof item !== "object" || item === null) {
    return false;
  }
  const candidate = item as Partial<ThresholdAlertRule>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.cityKey === "string" &&
    typeof candidate.cityName === "string" &&
    (candidate.metric === "usAqi" || candidate.metric === "pm25") &&
    typeof candidate.threshold === "number" &&
    typeof candidate.enabled === "boolean"
  );
}

/**
 * Manages local browser threshold alert rules and evaluates active warnings against fetched reports.
 */
export function useLocalAlerts(reportsByCityKey: Readonly<Record<string, AirQualityReport>>) {
  const [rules, setRules] = useState<readonly ThresholdAlertRule[]>(DEFAULT_RULES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ALERTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setRules(parsed.filter(isThresholdAlertRule));
        }
      }
    } catch {
      // Keep defaults when storage is unavailable.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    try {
      window.localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(rules));
    } catch {
      // Ignore storage quota errors.
    }
  }, [rules, hydrated]);

  const addRule = useCallback(
    (input: { cityKey: string; cityName: string; metric: "usAqi" | "pm25"; threshold: number }) => {
      const id = `rule-${Date.now()}-${Math.round(Math.random() * 1000)}`;
      setRules((prev) => [
        ...prev,
        {
          id,
          cityKey: input.cityKey,
          cityName: input.cityName,
          metric: input.metric,
          threshold: input.threshold,
          enabled: true,
        },
      ]);
    },
    [],
  );

  const toggleRule = useCallback((ruleId: string) => {
    setRules((prev) =>
      prev.map((rule) => (rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule)),
    );
  }, []);

  const removeRule = useCallback((ruleId: string) => {
    setRules((prev) => prev.filter((rule) => rule.id !== ruleId));
  }, []);

  const triggeredAlerts: readonly TriggeredAlert[] = useMemo(
    () => evaluateThresholdAlerts(rules, reportsByCityKey),
    [rules, reportsByCityKey],
  );

  return { rules, triggeredAlerts, addRule, toggleRule, removeRule };
}
