"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ActivityPlanner } from "@/components/ActivityPlanner";
import { AppFooter } from "@/components/AppFooter";
import { AppHeader } from "@/components/AppHeader";
import { AqiDashboard } from "@/components/AqiDashboard";
import { CitySearchBar } from "@/components/CitySearchBar";
import { GuidanceSection } from "@/components/GuidanceSection";
import { StatusBanner } from "@/components/StatusBanner";
import { ThresholdAlertsSection } from "@/components/ThresholdAlertsSection";
import type { AirQualityReport, ResidentProfile } from "@/domain/types";
import { useAirQualityData } from "@/hooks/useAirQualityData";
import { useCityComparison } from "@/hooks/useCityComparison";
import { useLocalAlerts } from "@/hooks/useLocalAlerts";

const ForecastSection = dynamic(
  () => import("@/components/ForecastSection").then((m) => m.ForecastSection),
  { ssr: true },
);

const RoutinesImpactSection = dynamic(
  () => import("@/components/RoutinesImpactSection").then((m) => m.RoutinesImpactSection),
  { ssr: true },
);

const CityCompareSection = dynamic(
  () => import("@/components/CityCompareSection").then((m) => m.CityCompareSection),
  { ssr: true },
);

const AirQualityChat = dynamic(
  () => import("@/components/AirQualityChat").then((m) => m.AirQualityChat),
  { ssr: true },
);

const DEFAULT_PROFILE: ResidentProfile = {
  persona: "general",
  commuteMode: "car",
  homeEnergyMode: "gas_biomass",
  filtrationMode: "none",
};

/**
 * Interactive root client workbench orchestrating city lookup, live AQI, guidance, routines, and alerts.
 */
export function UrbanAirWorkbench({ defaultDemoMode }: { readonly defaultDemoMode: boolean }) {
  const [profile, setProfile] = useState<ResidentProfile>(DEFAULT_PROFILE);
  const aq = useAirQualityData(defaultDemoMode);
  const compare = useCityComparison(aq.demoMode);

  const reportsByCityKey = useMemo(() => {
    const combined: Record<string, AirQualityReport> = { ...compare.reports };
    if (aq.report) {
      combined[aq.report.location.key] = aq.report;
    }
    return combined;
  }, [aq.report, compare.reports]);

  const alerts = useLocalAlerts(reportsByCityKey);

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-ink">
      <AppHeader
        demoMode={aq.demoMode}
        onToggleDemoMode={() => {
          aq.setDemoMode((prev) => !prev);
        }}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6">
        <CitySearchBar
          demoMode={aq.demoMode}
          selectedCityKey={aq.selectedCity?.key}
          geoStatusMessageKey={aq.geoStatusMessageKey}
          onSelectCity={aq.selectCity}
          onUseMyLocation={aq.requestUserLocation}
        />

        <StatusBanner
          state={aq.loadState}
          updatedAtIso={aq.report?.updatedAtIso}
          retryAfterSeconds={aq.retryAfterSeconds}
          onRetry={aq.retry}
        />

        {aq.report && (
          <>
            <AqiDashboard report={aq.report} />
            <ForecastSection report={aq.report} />
            <GuidanceSection report={aq.report} profile={profile} onChangeProfile={setProfile} />
            <ActivityPlanner report={aq.report} persona={profile.persona} />
            <RoutinesImpactSection report={aq.report} profile={profile} />
            <AirQualityChat report={aq.report} profile={profile} />
          </>
        )}

        <CityCompareSection
          cities={compare.cities}
          reports={compare.reports}
          loading={compare.loading}
          onAddCity={compare.addCity}
          onRemoveCity={compare.removeCity}
        />

        <ThresholdAlertsSection
          currentCity={aq.selectedCity}
          rules={alerts.rules}
          triggeredAlerts={alerts.triggeredAlerts}
          onAddRule={alerts.addRule}
          onToggleRule={alerts.toggleRule}
          onRemoveRule={alerts.removeRule}
        />
      </main>

      <AppFooter />
    </div>
  );
}
