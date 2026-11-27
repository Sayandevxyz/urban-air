// ============================================================================
// tests/components/compare-chat-workbench.test.tsx
// Tests CityCompareSection, AirQualityChat, LocaleContext, and root Workbench.
// ============================================================================

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { AirQualityChat } from "@/components/AirQualityChat";
import { CityCompareSection } from "@/components/CityCompareSection";
import { AppLocaleProvider, useAppLocale } from "@/components/LocaleContext";
import { UrbanAirWorkbench } from "@/components/UrbanAirWorkbench";
import { getDemoAirQualityReport, getDemoCityLocations } from "@/services/demo-data";
import type { ResidentProfile } from "@/types/guidance";

const PROFILE: ResidentProfile = {
  persona: "general",
  commuteMode: "car",
  homeEnergyMode: "gas_biomass",
  filtrationMode: "none",
};
const CHAT_REPLY = {
  reply: "Delhi US AQI is 224. Keep windows sealed.",
  engine: "fallback",
  refused: false,
  dataSource: "Delhi (demo)",
  updatedAtIso: "2026-11-26T08:00:00Z",
  disclaimer: "Not medical advice",
};

const wrapMain = (ui: ReactNode) => (
  <AppLocaleProvider>
    <main>{ui}</main>
  </AppLocaleProvider>
);
const renderInMain = (ui: ReactNode) => render(wrapMain(ui));

const stubFetch = (body: unknown, status = 200) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status }))),
  );
};

function OutsideProviderControl() {
  const ctx = useAppLocale();
  return (
    <button
      type="button"
      onClick={() => {
        ctx.setLocale("en");
      }}
    >
      outside-noop
    </button>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

test("CityCompareSection enforces 3-city limit, removes cities, and passes axe", async () => {
  const user = userEvent.setup();
  const cities = getDemoCityLocations().slice(0, 3);
  const reports = {
    delhi: getDemoAirQualityReport("delhi"),
    coimbatore: getDemoAirQualityReport("coimbatore"),
    mumbai: getDemoAirQualityReport("mumbai"),
  };
  const onRemove = vi.fn();
  const { container } = renderInMain(
    <CityCompareSection
      cities={cities}
      reports={reports}
      loading={false}
      onAddCity={vi.fn()}
      onRemoveCity={onRemove}
    />,
  );
  expect(screen.getByText(/Comparison limit reached/i)).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText(/Add city to comparison/i), "london");
  await user.click(screen.getByRole("button", { name: /Remove Delhi/i }));
  expect(onRemove).toHaveBeenCalledTimes(1);
  expect(await axe(container)).toHaveNoViolations();
});

test("CityCompareSection supports adding cities on sparse reports and empty state", async () => {
  const user = userEvent.setup();
  const cities = getDemoCityLocations().slice(0, 2);
  const delhi = getDemoAirQualityReport("delhi");
  const onAdd = vi.fn();
  const { rerender } = renderInMain(
    <CityCompareSection
      cities={cities}
      reports={{ delhi: { ...delhi, hourly: [] } }}
      loading={false}
      onAddCity={onAdd}
      onRemoveCity={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: /Add city/i }));
  expect(onAdd).toHaveBeenCalledTimes(1);
  rerender(
    wrapMain(
      <CityCompareSection
        cities={[]}
        reports={{}}
        loading={false}
        onAddCity={onAdd}
        onRemoveCity={vi.fn()}
      />,
    ),
  );
  expect(screen.getByText(/Add cities above/i)).toBeInTheDocument();
});

test("AirQualityChat renders grounded replies, follow-ups, zero scripts, and axe", async () => {
  const user = userEvent.setup();
  stubFetch(CHAT_REPLY);
  const { container } = renderInMain(
    <AirQualityChat report={getDemoAirQualityReport("delhi")} profile={PROFILE} />,
  );
  await user.click(
    screen.getByRole("button", { name: /How should my family handle winter smog/i }),
  );
  await waitFor(() => expect(screen.getByText(/Delhi US AQI is 224/i)).toBeInTheDocument());

  await user.type(screen.getByLabelText(/Ask about smog/i), "What about N95?");
  await user.click(screen.getByRole("button", { name: /Ask assistant/i }));
  await waitFor(() => {
    expect(screen.getAllByText(/Delhi US AQI is 224/i).length).toBeGreaterThanOrEqual(2);
  });
  expect(container.querySelector("script")).toBeNull();
  expect(await axe(container)).toHaveNoViolations();
});

test("AirQualityChat shows assistant error feedback on 500 and network failure", async () => {
  const user = userEvent.setup();
  const waitErr = () =>
    waitFor(() => {
      expect(screen.getByText(/Could not reach the assistant/i)).toBeInTheDocument();
    });
  stubFetch({ error: "fail" }, 500);
  renderInMain(<AirQualityChat report={getDemoAirQualityReport("delhi")} profile={PROFILE} />);
  const chatBox = screen.getByLabelText(/Ask about smog/i);
  await user.type(chatBox, "Retry check{Enter}");
  await waitErr();

  vi.stubGlobal(
    "fetch",
    vi.fn((): Promise<Response> => Promise.reject(new Error("offline"))),
  );
  await user.type(chatBox, "Network err{Enter}");
  await waitErr();
});

const renderWb = (demo: boolean) =>
  render(
    <AppLocaleProvider>
      <UrbanAirWorkbench defaultDemoMode={demo} />
    </AppLocaleProvider>,
  );

test("UrbanAirWorkbench restores persisted locale, switches hi/ta/en, and toggles demo", async () => {
  const user = userEvent.setup();
  stubFetch({ report: getDemoAirQualityReport("delhi") });
  render(<OutsideProviderControl />);
  await user.click(screen.getByRole("button", { name: "outside-noop" }));
  cleanup();

  window.localStorage.setItem("urban-air:locale:v1", "hi");
  const waitLang = (lang: string, label: string) =>
    waitFor(
      () => {
        expect(document.documentElement.lang).toBe(lang);
        expect(screen.getByLabelText(label)).toBeInTheDocument();
      },
      { timeout: 8000 },
    );
  const { container } = renderWb(true);
  await waitLang("hi", "भाषा");
  await user.selectOptions(screen.getByLabelText("भाषा"), "ta");
  await waitLang("ta", "மொழி");
  await user.selectOptions(screen.getByLabelText("மொழி"), "en");
  await waitLang("en", "Language");
  await user.click(screen.getByRole("switch"));
  await waitFor(() => expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false"));
  expect(await axe(container)).toHaveNoViolations();
});

test("UrbanAirWorkbench mounts cleanly when demo mode starts disabled", async () => {
  stubFetch({ report: getDemoAirQualityReport("delhi") });
  renderWb(false);
  await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument());
});
