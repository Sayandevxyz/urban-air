import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { AqiDashboard } from "@/components/AqiDashboard";
import { ForecastSection } from "@/components/ForecastSection";
import { AppLocaleProvider } from "@/components/LocaleContext";
import { getDemoAirQualityReport } from "@/services/demo-data";

describe("AqiDashboard and ForecastSection", () => {
  it("renders severe winter smog banner, dual AQI scales, WHO ratios, and passes axe", async () => {
    const delhi = getDemoAirQualityReport("delhi");
    const { container } = render(
      <AppLocaleProvider>
        <main>
          <AqiDashboard report={delhi} />
        </main>
      </AppLocaleProvider>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/Severe Winter Smog Emergency/i);
    expect(screen.getByText("224")).toBeInTheDocument();
    expect(screen.getByText("108")).toBeInTheDocument();
    expect(screen.getAllByText(/PM2\.5 \(Fine Particles\)/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/10\.5× WHO limit/i)).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("renders clean Coimbatore dashboard without smog alert banner", async () => {
    const coimbatore = getDemoAirQualityReport("coimbatore");
    const { container } = render(
      <AppLocaleProvider>
        <main>
          <AqiDashboard report={coimbatore} />
        </main>
      </AppLocaleProvider>,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("46")).toBeInTheDocument();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("renders moderate, sensitive, unhealthy, and hazardous AQI category visuals without color alone", () => {
    const base = getDemoAirQualityReport("mumbai");
    const samples = [
      { ...base, source: "open-meteo" as const, current: { ...base.current, usAqi: 75 } },
      { ...base, source: "cached" as const, current: { ...base.current, usAqi: 125 } },
      {
        ...base,
        location: { ...base.location, country: "" },
        current: { ...base.current, usAqi: 175 },
      },
      { ...base, current: { ...base.current, usAqi: 350 } },
    ];
    for (const sample of samples) {
      const { unmount } = render(
        <AppLocaleProvider>
          <main>
            <AqiDashboard report={sample} />
          </main>
        </AppLocaleProvider>,
      );
      expect(screen.getByText(String(sample.current.usAqi))).toBeInTheDocument();
      unmount();
    }

    const emptyForecast = { ...base, hourly: [], daily: [] };
    render(
      <AppLocaleProvider>
        <main>
          <ForecastSection report={emptyForecast} />
        </main>
      </AppLocaleProvider>,
    );
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("toggles between accessible 48h/7d SVG charts and semantic HTML data tables", async () => {
    const user = userEvent.setup();
    const delhi = getDemoAirQualityReport("delhi");
    const { container } = render(
      <AppLocaleProvider>
        <main>
          <ForecastSection report={delhi} />
        </main>
      </AppLocaleProvider>,
    );

    expect(screen.getByRole("img", { name: /48-hour US AQI forecast chart/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /7-Day Trend/i }));
    expect(
      screen.getByRole("img", { name: /7-day US AQI daily average chart/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Show data table/i }));
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText(/7-day daily air quality trend/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /48-Hour Forecast/i }));
    expect(screen.getByText(/48-hour hourly air quality forecast/i)).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
