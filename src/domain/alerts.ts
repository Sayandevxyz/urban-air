import type { AirQualityReport, ThresholdAlertRule, TriggeredAlert } from "@/domain/types";

/**
 * Evaluates enabled user threshold alert rules against loaded air quality snapshots.
 */
export function evaluateThresholdAlerts(
  rules: readonly ThresholdAlertRule[],
  reports: Readonly<Record<string, AirQualityReport>>,
): readonly TriggeredAlert[] {
  const triggered: TriggeredAlert[] = [];

  for (const rule of rules) {
    if (!rule.enabled) {
      continue;
    }
    const report = reports[rule.cityKey];
    if (!report) {
      continue;
    }
    const actualValue =
      rule.metric === "usAqi" ? report.current.usAqi : report.current.readings.pm25;

    if (actualValue > rule.threshold) {
      triggered.push({
        ruleId: rule.id,
        cityKey: rule.cityKey,
        cityName: rule.cityName,
        metric: rule.metric,
        threshold: rule.threshold,
        actualValue,
      });
    }
  }

  return triggered;
}
