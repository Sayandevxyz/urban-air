import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AirQualityChat } from "@/components/AirQualityChat";
import { CityCompareSection } from "@/components/CityCompareSection";
import { CitySearchBar } from "@/components/CitySearchBar";
import { AppLocaleProvider } from "@/components/LocaleContext";
import { StatusBanner } from "@/components/StatusBanner";
import { ThresholdAlertsSection } from "@/components/ThresholdAlertsSection";
import { UrbanAirWorkbench } from "@/components/UrbanAirWorkbench";
import type { ResidentProfile } from "@/domain/types";
import { getDemoAirQualityReport, getDemoCityLocations } from "@/services/demo-data";

const PROFILE: ResidentProfile = {
  persona: "general",
  commuteMode: "car",
  homeEnergyMode: "gas_biomass",
  filtrationMode: "none",
};

describe("Search, Compare, Alerts, StatusBanner, Chat, and Workbench", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("supports keyboard combobox navigation and displays geolocation denied fallback", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onGeo = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ results: [getDemoCityLocations()[2]] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );

    const { container } = render(
      <AppLocaleProvider>
        <main>
          <CitySearchBar
            demoMode={true}
            selectedCityKey="delhi"
            geoStatusMessageKey="locationDenied"
            onSelectCity={onSelect}
            onUseMyLocation={onGeo}
          />
        </main>
      </AppLocaleProvider>,
    );

    expect(screen.getByText(/Location permission was blocked/i)).toBeInTheDocument();

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("{ArrowDown}{ArrowUp}{Enter}");
    await user.type(combobox, "Mum");
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    await user.keyboard("{ArrowDown}{ArrowUp}{ArrowDown}{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);

    await user.type(combobox, "Mum");
    await waitFor(() => {
      expect(screen.getByRole("option")).toBeInTheDocument();
    });
    fireEvent.mouseDown(screen.getByRole("option"));
    expect(onSelect).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole("button", { name: "Mumbai" }));
    expect(onSelect).toHaveBeenCalledTimes(3);

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: /Use my location/i }));
    expect(onGeo).toHaveBeenCalledTimes(1);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("renders search error, rate-limited, empty, and location-unavailable states", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ results: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );
    render(
      <AppLocaleProvider>
        <main>
          <CitySearchBar
            demoMode={false}
            selectedCityKey={undefined}
            geoStatusMessageKey="locationUnavailable"
            onSelectCity={vi.fn()}
            onUseMyLocation={vi.fn()}
          />
        </main>
      </AppLocaleProvider>,
    );
    expect(screen.getByText(/Could not read device location/i)).toBeInTheDocument();
    await user.type(screen.getByRole("combobox"), "Nowhere");
    await waitFor(() => {
      expect(screen.getByText(/No matching cities found/i)).toBeInTheDocument();
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("{}", { status: 429 }))),
    );
    await user.clear(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "WaitCity");
    await waitFor(() => {
      expect(screen.getByText(/Please wait/i)).toBeInTheDocument();
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("fail"))),
    );
    await user.clear(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "ErrCity");
    await waitFor(() => {
      expect(screen.getByText(/Unable to load live air quality data/i)).toBeInTheDocument();
    });
  });

  it("renders StatusBanner states and invokes retry handler", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <AppLocaleProvider>
        <main>
          <StatusBanner state="loading" retryAfterSeconds={0} onRetry={onRetry} />
          <StatusBanner state="empty" retryAfterSeconds={0} onRetry={onRetry} />
          <StatusBanner
            state="offline"
            updatedAtIso="2026-11-26T08:00:00Z"
            retryAfterSeconds={0}
            onRetry={onRetry}
          />
          <StatusBanner state="rate_limited" retryAfterSeconds={42} onRetry={onRetry} />
          <StatusBanner state="error" retryAfterSeconds={0} onRetry={onRetry} />
        </main>
      </AppLocaleProvider>,
    );

    expect(screen.getByText(/Loading air quality report/i)).toBeInTheDocument();
    expect(screen.getByText(/No city selected yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Offline mode/i)).toBeInTheDocument();
    expect(screen.getByText(/42 seconds/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("compares up to 3 cities and validates/triggers local threshold alerts", async () => {
    const user = userEvent.setup();
    const cities = getDemoCityLocations().slice(0, 3);
    const reports = {
      delhi: getDemoAirQualityReport("delhi"),
      coimbatore: getDemoAirQualityReport("coimbatore"),
      mumbai: getDemoAirQualityReport("mumbai"),
    };
    const onAdd = vi.fn();
    const onRemove = vi.fn();

    const { container } = render(
      <AppLocaleProvider>
        <main>
          <CityCompareSection
            cities={cities}
            reports={reports}
            loading={false}
            onAddCity={onAdd}
            onRemoveCity={onRemove}
          />
          <ThresholdAlertsSection
            currentCity={cities[0] ?? null}
            rules={[
              {
                id: "r1",
                cityKey: "delhi",
                cityName: "Delhi",
                metric: "usAqi",
                threshold: 100,
                enabled: true,
              },
            ]}
            triggeredAlerts={[
              {
                ruleId: "r1",
                cityKey: "delhi",
                cityName: "Delhi",
                metric: "usAqi",
                threshold: 100,
                actualValue: 224,
              },
            ]}
            onAddRule={onAdd}
            onToggleRule={onRemove}
            onRemoveRule={onRemove}
          />
        </main>
      </AppLocaleProvider>,
    );

    expect(screen.getByText(/Comparison limit reached/i)).toBeInTheDocument();
    expect(screen.getByText(/Delhi: US AQI is 224/i)).toBeInTheDocument();

    const thresholdInput = screen.getByLabelText(/Trigger when above/i);
    fireEvent.change(thresholdInput, { target: { value: "5" } });
    await user.click(screen.getByRole("button", { name: /Save alert rule/i }));
    expect(screen.getByText(/Enter a positive number between 10 and 500/i)).toBeInTheDocument();

    fireEvent.change(thresholdInput, { target: { value: "150" } });
    await user.click(screen.getByRole("button", { name: /Save alert rule/i }));
    expect(onAdd).toHaveBeenCalledTimes(1);

    await user.selectOptions(screen.getByLabelText(/Add city to comparison/i), "london");
    await user.click(screen.getByRole("button", { name: /Add city/i }));
    await user.selectOptions(screen.getByLabelText(/Alert metric/i), "pm25");
    await user.click(screen.getByRole("button", { name: /Enabled/i }));
    await user.click(screen.getByRole("button", { name: /Delete alert/i }));
    await user.click(screen.getByRole("button", { name: /Remove Delhi/i }));
    expect(onRemove).toHaveBeenCalled();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("renders empty compare, missing report key, add city, and empty alerts states cleanly", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const delhi = getDemoCityLocations()[0];
    const mumbai = getDemoCityLocations()[2];
    const { rerender } = render(
      <AppLocaleProvider>
        <main>
          <CityCompareSection
            cities={delhi && mumbai ? [delhi, mumbai] : []}
            reports={{
              delhi: { ...getDemoAirQualityReport("delhi"), hourly: [] },
            }}
            loading={false}
            onAddCity={onAdd}
            onRemoveCity={vi.fn()}
          />
          <ThresholdAlertsSection
            currentCity={null}
            rules={[]}
            triggeredAlerts={[]}
            onAddRule={vi.fn()}
            onToggleRule={vi.fn()}
            onRemoveRule={vi.fn()}
          />
        </main>
      </AppLocaleProvider>,
    );
    await user.click(screen.getByRole("button", { name: /Add city/i }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/No alert rules saved yet/i)).toBeInTheDocument();

    rerender(
      <AppLocaleProvider>
        <main>
          <CityCompareSection
            cities={[]}
            reports={{}}
            loading={false}
            onAddCity={onAdd}
            onRemoveCity={vi.fn()}
          />
        </main>
      </AppLocaleProvider>,
    );
    expect(screen.getByText(/Add cities above/i)).toBeInTheDocument();
  });

  it("renders grounded chat replies without dangerouslySetInnerHTML", async () => {
    const user = userEvent.setup();
    const delhi = getDemoAirQualityReport("delhi");

    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              reply: "Delhi US AQI is 224. Keep windows sealed.",
              engine: "fallback",
              refused: false,
              dataSource: "Delhi (demo)",
              updatedAtIso: "2026-11-26T08:00:00Z",
              disclaimer: "Not medical advice",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        ),
      ),
    );

    const { container } = render(
      <AppLocaleProvider>
        <main>
          <AirQualityChat report={delhi} profile={PROFILE} />
        </main>
      </AppLocaleProvider>,
    );

    await user.click(
      screen.getByRole("button", { name: /How should my family handle winter smog/i }),
    );
    await waitFor(() => {
      expect(screen.getByText(/Delhi US AQI is 224/i)).toBeInTheDocument();
    });

    const chatBox = screen.getByLabelText(/Ask about smog/i);
    await user.type(chatBox, "What about N95?{Enter}");
    await waitFor(() => {
      expect(screen.getAllByText(/Delhi US AQI is 224/i).length).toBeGreaterThanOrEqual(2);
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("fail", { status: 500 }))),
    );
    await user.type(chatBox, "Retry check{Enter}");
    await waitFor(() => {
      expect(screen.getByText(/Could not reach the assistant/i)).toBeInTheDocument();
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );
    await user.type(chatBox, "Network err{Enter}");
    await waitFor(() => {
      expect(screen.getByText(/Could not reach the assistant/i)).toBeInTheDocument();
    });

    const customCity = {
      key: "custom-tokyo",
      name: "Tokyo",
      region: "Kanto",
      country: "Japan",
      latitude: 35.68,
      longitude: 139.76,
      timezone: "Asia/Tokyo",
    };
    const addRuleSpy = vi.fn();
    render(
      <AppLocaleProvider>
        <ThresholdAlertsSection
          currentCity={customCity}
          rules={[]}
          triggeredAlerts={[]}
          onAddRule={addRuleSpy}
          onToggleRule={vi.fn()}
          onRemoveRule={vi.fn()}
        />
      </AppLocaleProvider>,
    );
    await user.selectOptions(screen.getByLabelText(/Monitored city/i), "custom-tokyo");
    await user.click(screen.getByRole("button", { name: /Save alert rule/i }));
    expect(addRuleSpy).toHaveBeenCalledTimes(1);

    expect(container.querySelector("script")).toBeNull();
    const axeResults = await axe(container);
    expect(axeResults).toHaveNoViolations();
  });

  it("toggles language and demo mode in Workbench, updates html lang, and passes axe", async () => {
    const user = userEvent.setup();
    cleanup();

    const { container } = render(
      <AppLocaleProvider>
        <UrbanAirWorkbench defaultDemoMode={true} />
      </AppLocaleProvider>,
    );

    await user.selectOptions(screen.getByLabelText("Language"), "hi");
    await waitFor(() => {
      expect(document.documentElement.lang).toBe("hi");
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("शहरी वायु गुणवत्ता सहायक");
    });

    await user.selectOptions(screen.getByLabelText("भाषा"), "ta");
    await waitFor(() => {
      expect(document.documentElement.lang).toBe("ta");
    });

    await user.selectOptions(screen.getByLabelText("மொழி"), "en");
    await waitFor(() => {
      expect(document.documentElement.lang).toBe("en");
    });

    await user.click(screen.getByRole("switch"));
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");

    const axeResults = await axe(container);
    expect(axeResults).toHaveNoViolations();
  });
});
