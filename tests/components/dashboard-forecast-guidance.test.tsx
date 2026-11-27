// ============================================================================
// tests/components/dashboard-forecast-guidance.test.tsx
// Tests dashboard, forecast views, guidance, planner, routines, & axe a11y.
// ============================================================================

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { useState, type ReactNode } from "react";
import { expect, test } from "vitest";
import { ActivityPlanner } from "@/components/ActivityPlanner";
import { AqiDashboard } from "@/components/AqiDashboard";
import { ForecastSection } from "@/components/ForecastSection";
import { GuidanceSection } from "@/components/GuidanceSection";
import { AppLocaleProvider } from "@/components/LocaleContext";
import { RoutinesImpactSection } from "@/components/RoutinesImpactSection";
import { getDemoAirQualityReport } from "@/services/demo-data";
import type { ResidentProfile } from "@/types/guidance";

const renderInMain = (ui: ReactNode) =>
  render(
    <AppLocaleProvider>
      <main>{ui}</main>
    </AppLocaleProvider>,
  );

function GuidanceHarness() {
  const [profile, setProfile] = useState<ResidentProfile>({
    persona: "general",
    commuteMode: "car",
    homeEnergyMode: "gas_biomass",
    filtrationMode: "none",
  });
  return (
    <GuidanceSection
      report={getDemoAirQualityReport("mumbai")}
      profile={profile}
      onChangeProfile={setProfile}
    />
  );
}

test("AqiDashboard renders smog alerts, dual scales, all severity icons, and passes axe", async () => {
  const delhi = getDemoAirQualityReport("delhi");
  const { container, unmount } = renderInMain(<AqiDashboard report={delhi} />);
  expect(screen.getByRole("alert")).toHaveTextContent(/Severe Winter Smog Emergency/i);
  expect(screen.getByText("224")).toBeInTheDocument();
  expect(screen.getByText(/10\.5× WHO limit/i)).toBeInTheDocument();
  expect(await axe(container)).toHaveNoViolations();
  unmount();

  const clean = renderInMain(<AqiDashboard report={getDemoAirQualityReport("coimbatore")} />);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(await axe(clean.container)).toHaveNoViolations();
  clean.unmount();

  const base = getDemoAirQualityReport("mumbai");
  for (const aqi of [75, 125, 175, 350]) {
    const view = renderInMain(
      <AqiDashboard
        report={{
          ...base,
          source: aqi === 75 ? "open-meteo" : "cached",
          location: { ...base.location, country: aqi === 175 ? "" : "India" },
          current: { ...base.current, usAqi: aqi },
        }}
      />,
    );
    expect(screen.getByText(String(aqi))).toBeInTheDocument();
    view.unmount();
  }
});

test("ForecastSection toggles between accessible 48h/7d charts, tables, and empty series", async () => {
  const user = userEvent.setup();
  const base = getDemoAirQualityReport("delhi");
  const { container } = renderInMain(<ForecastSection report={base} />);
  expect(screen.getByRole("img", { name: /48-hour US AQI forecast chart/i })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /7-Day Trend/i }));
  expect(
    screen.getByRole("img", { name: /7-day US AQI daily average chart/i }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /Show data table/i }));
  expect(screen.getByRole("table")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /48-Hour Forecast/i }));
  expect(screen.getByText(/48-hour hourly air quality forecast/i)).toBeInTheDocument();
  expect(await axe(container)).toHaveNoViolations();
  cleanup();

  renderInMain(<ForecastSection report={{ ...base, hourly: [], daily: [] }} />);
  expect(screen.getAllByRole("img").length).toBeGreaterThanOrEqual(1);
});

test("GuidanceSection and ActivityPlanner update interactively and pass axe", async () => {
  const user = userEvent.setup();
  const { container } = renderInMain(<GuidanceHarness />);
  await user.selectOptions(screen.getByLabelText(/Household member/i), "asthma");
  expect(screen.getByText(/Optional well-fitted mask/i)).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText(/Indoor air cleaner/i), "hepa");
  expect(screen.getByText(/Clean-Air Bedroom Zone/i)).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText(/Typical commute/i), "transit");
  await user.selectOptions(screen.getByLabelText(/Cooking & heating/i), "electric_induction");
  fireEvent.change(screen.getByLabelText(/Household member/i), { target: { value: "unknown" } });
  expect(await axe(container)).toHaveNoViolations();
  cleanup();

  const planner = renderInMain(
    <ActivityPlanner report={getDemoAirQualityReport("delhi")} persona="athlete" />,
  );
  await user.click(screen.getByRole("button", { name: "Open Windows" }));
  expect(screen.getByRole("button", { name: "Open Windows" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await axe(planner.container)).toHaveNoViolations();
});

test("RoutinesImpactSection calculates toggles, clamps inputs, and passes axe", async () => {
  const user = userEvent.setup();
  const delhi = getDemoAirQualityReport("delhi");
  const { container } = renderInMain(
    <RoutinesImpactSection
      report={delhi}
      profile={{
        persona: "general",
        commuteMode: "car",
        homeEnergyMode: "gas_biomass",
        filtrationMode: "none",
      }}
    />,
  );
  expect(screen.getByText("1300 g CO2e")).toBeInTheDocument();
  await user.click(screen.getByLabelText(/Switch car\/two-wheeler trip to metro/i));
  expect(screen.getByText("0 g CO2e")).toBeInTheDocument();
  for (const pat of [
    /Move outdoor time/,
    /Wear a fitted N95/,
    /Use electric induction/,
    /Run HEPA or DIY/,
  ]) {
    await user.click(screen.getByLabelText(pat));
  }
  const distInput = screen.getByLabelText(/Daily commute distance/i);
  fireEvent.change(distInput, { target: { value: "200" } });
  expect(distInput).toHaveValue(150);
  fireEvent.change(distInput, { target: { value: "" } });
  expect(distInput).toHaveValue(0);

  const hoursInput = screen.getByLabelText(/Outdoor active hours/i);
  fireEvent.change(hoursInput, { target: { value: "2" } });
  expect(hoursInput).toHaveValue(2);
  fireEvent.change(hoursInput, { target: { value: "" } });
  expect(hoursInput).toHaveValue(0);
  expect(await axe(container)).toHaveNoViolations();
});

test("ActivityPlanner and RoutinesImpactSection render everyday routines and empty hours safely", () => {
  const clean = { ...getDemoAirQualityReport("coimbatore"), hourly: [] };
  renderInMain(
    <>
      <ActivityPlanner report={clean} persona="general" />
      <RoutinesImpactSection
        report={clean}
        profile={{
          persona: "general",
          commuteMode: "walk_cycle",
          homeEnergyMode: "electric_induction",
          filtrationMode: "hepa",
        }}
      />
    </>,
  );
  expect(screen.getAllByText(/Everyday habit/i).length).toBeGreaterThanOrEqual(1);
});
