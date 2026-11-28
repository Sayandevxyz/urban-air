// ============================================================================
// src/components/UrbanAirWorkbench.tsx
// Orchestrates city search, live dashboard, guidance, chat, compare, and alerts.
// ============================================================================

"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AqiDashboard } from "@/components/AqiDashboard";
import { CitySearchBar } from "@/components/CitySearchBar";
import { StatusBanner } from "@/components/StatusBanner";
import { useAirQualityData } from "@/hooks/useAirQualityData";
import { useCityComparison } from "@/hooks/useCityComparison";
import { useLocalAlerts } from "@/hooks/useLocalAlerts";
import type { AirQualityReport } from "@/types/air-quality";
import type { ResidentProfile } from "@/types/guidance";

const GuidanceSection = dynamic(
  () => import("@/components/GuidanceSection").then((m) => m.GuidanceSection),
  { ssr: true },
);
const ActivityPlanner = dynamic(
  () => import("@/components/ActivityPlanner").then((m) => m.ActivityPlanner),
  { ssr: true },
);
const ThresholdAlertsSection = dynamic(
  () => import("@/components/ThresholdAlertsSection").then((m) => m.ThresholdAlertsSection),
  { ssr: true },
);
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

function WorkbenchFooter() {
  const t = useTranslations("app");
  return (
    <footer className="mt-10 border-t border-borderc bg-surface-elevated">
      <div className="mx-auto max-w-6xl space-y-1 px-4 py-6 text-sm text-ink-muted">
        <p className="font-medium text-ink">{t("disclaimerShort")}</p>
        <p>{t("footerNote")}</p>
      </div>
    </footer>
  );
}

function ActiveCitySections({
  report,
  profile,
  onChangeProfile,
}: {
  readonly report: AirQualityReport;
  readonly profile: ResidentProfile;
  readonly onChangeProfile: (next: ResidentProfile) => void;
}) {
  return (
    <>
      <AqiDashboard report={report} />
      <ForecastSection report={report} />
      <GuidanceSection report={report} profile={profile} onChangeProfile={onChangeProfile} />
      <ActivityPlanner report={report} persona={profile.persona} />
      <RoutinesImpactSection report={report} profile={profile} />
      <AirQualityChat report={report} profile={profile} />
    </>
  );
}

function CompareAndAlertsSection({
  aq,
  compare,
  alerts,
}: {
  readonly aq: ReturnType<typeof useAirQualityData>;
  readonly compare: ReturnType<typeof useCityComparison>;
  readonly alerts: ReturnType<typeof useLocalAlerts>;
}) {
  return (
    <>
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
    </>
  );
}

function WorkbenchMainContent({
  aq,
  compare,
  alerts,
  profile,
  onChangeProfile,
}: {
  readonly aq: ReturnType<typeof useAirQualityData>;
  readonly compare: ReturnType<typeof useCityComparison>;
  readonly alerts: ReturnType<typeof useLocalAlerts>;
  readonly profile: ResidentProfile;
  readonly onChangeProfile: (next: ResidentProfile) => void;
}) {
  return (
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
        <ActiveCitySections
          report={aq.report}
          profile={profile}
          onChangeProfile={onChangeProfile}
        />
      )}
      <CompareAndAlertsSection aq={aq} compare={compare} alerts={alerts} />
    </main>
  );
}

function WorkbenchMain({ demoMode }: { readonly demoMode: boolean }) {
  const [profile, setProfile] = useState<ResidentProfile>(DEFAULT_PROFILE);
  const aq = useAirQualityData(demoMode);
  const compare = useCityComparison(aq.demoMode);
  const reportsByKey = useMemo(
    () =>
      aq.report ? { ...compare.reports, [aq.report.location.key]: aq.report } : compare.reports,
    [aq.report, compare.reports],
  );
  const alerts = useLocalAlerts(reportsByKey);

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-ink">
      <AppHeader
        demoMode={aq.demoMode}
        onToggleDemoMode={() => {
          aq.setDemoMode((prev) => !prev);
        }}
      />
      <WorkbenchMainContent
        aq={aq}
        compare={compare}
        alerts={alerts}
        profile={profile}
        onChangeProfile={setProfile}
      />
      <WorkbenchFooter />
    </div>
  );
}

/** Interactive root client workbench orchestrating city lookup, AQI, guidance, and alerts. */
export function UrbanAirWorkbench({ defaultDemoMode }: { readonly defaultDemoMode: boolean }) {
  return <WorkbenchMain demoMode={defaultDemoMode} />;
}
