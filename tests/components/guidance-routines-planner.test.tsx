import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ActivityPlanner } from "@/components/ActivityPlanner";
import { GuidanceSection } from "@/components/GuidanceSection";
import { AppLocaleProvider } from "@/components/LocaleContext";
import { RoutinesImpactSection } from "@/components/RoutinesImpactSection";
import { getDemoAirQualityReport } from "@/services/demo-data";
import type { ResidentProfile } from "@/types/guidance";

function GuidanceHarness() {
  const [profile, setProfile] = useState<ResidentProfile>({
    persona: "general",
    commuteMode: "car",
    homeEnergyMode: "gas_biomass",
    filtrationMode: "none",
  });
  const mumbai = getDemoAirQualityReport("mumbai");
  return <GuidanceSection report={mumbai} profile={profile} onChangeProfile={setProfile} />;
}

describe("GuidanceSection, ActivityPlanner, and RoutinesImpactSection", () => {
  it("updates persona guidance and indoor hacks dynamically and passes axe", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AppLocaleProvider>
        <main>
          <GuidanceHarness />
        </main>
      </AppLocaleProvider>,
    );

    expect(screen.getByText(/No mask needed today/i)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/Household member/i), "asthma");
    expect(screen.getByText(/Optional well-fitted mask/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Indoor air cleaner/i), "hepa");
    expect(screen.getByText(/Create a Clean-Air Bedroom Zone with HEPA/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Typical commute/i), "transit");
    await user.selectOptions(screen.getByLabelText(/Cooking & heating/i), "electric_induction");
    fireEvent.change(screen.getByLabelText(/Household member/i), { target: { value: "unknown" } });
    expect(screen.getByLabelText(/Typical commute/i)).toHaveValue("transit");

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("computes best and worst daily activity windows transparently", async () => {
    const user = userEvent.setup();
    const delhi = getDemoAirQualityReport("delhi");
    const { container } = render(
      <AppLocaleProvider>
        <main>
          <ActivityPlanner report={delhi} persona="athlete" />
        </main>
      </AppLocaleProvider>,
    );

    expect(screen.getByText(/Best time today/i)).toBeInTheDocument();
    expect(screen.getByText(/How this score is computed/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open Windows" }));
    expect(screen.getByRole("button", { name: "Open Windows" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("simulates direct personal PM2.5 and community CO2/NOx impact from daily swaps", async () => {
    const user = userEvent.setup();
    const delhi = getDemoAirQualityReport("delhi");
    const profile: ResidentProfile = {
      persona: "general",
      commuteMode: "car",
      homeEnergyMode: "gas_biomass",
      filtrationMode: "none",
    };

    const { container } = render(
      <AppLocaleProvider>
        <main>
          <RoutinesImpactSection report={delhi} profile={profile} />
        </main>
      </AppLocaleProvider>,
    );

    expect(screen.getByText("1300 g CO2e")).toBeInTheDocument();

    const commuteToggle = screen.getByLabelText(/Switch car\/two-wheeler trip to metro/i);
    await user.click(commuteToggle);
    expect(screen.getByText("0 g CO2e")).toBeInTheDocument();

    await user.click(screen.getByLabelText(/Move outdoor time to today/i));
    await user.click(screen.getByLabelText(/Wear a fitted N95\/FFP2 mask/i));
    await user.click(screen.getByLabelText(/Use electric induction/i));
    await user.click(screen.getByLabelText(/Run HEPA or DIY/i));

    const distInput = screen.getByLabelText(/Daily commute distance/i);
    await user.clear(distInput);
    fireEvent.change(distInput, { target: { value: "200" } });
    expect(distInput).toHaveValue(150);
    fireEvent.change(distInput, { target: { value: "" } });
    expect(distInput).toHaveValue(0);

    const hoursInput = screen.getByLabelText(/Outdoor active hours/i);
    await user.clear(hoursInput);
    fireEvent.change(hoursInput, { target: { value: "2" } });
    expect(hoursInput).toHaveValue(2);
    fireEvent.change(hoursInput, { target: { value: "" } });
    expect(hoursInput).toHaveValue(0);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("renders everyday clean-air routines and empty planner gracefully", () => {
    const clean = { ...getDemoAirQualityReport("coimbatore"), hourly: [] };
    render(
      <AppLocaleProvider>
        <main>
          <ActivityPlanner report={clean} persona="general" />
          <RoutinesImpactSection
            report={clean}
            profile={{
              ...{
                persona: "general",
                commuteMode: "walk_cycle",
                homeEnergyMode: "electric_induction",
                filtrationMode: "hepa",
              },
            }}
          />
        </main>
      </AppLocaleProvider>,
    );
    expect(screen.getAllByText(/Everyday habit/i).length).toBeGreaterThanOrEqual(1);
  });
});
