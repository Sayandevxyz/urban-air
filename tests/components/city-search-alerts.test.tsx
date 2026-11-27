// ============================================================================
// tests/components/city-search-alerts.test.tsx
// Tests CitySearchBar combobox, StatusBanner states, and ThresholdAlerts UI.
// ============================================================================

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { CitySearchBar } from "@/components/CitySearchBar";
import { AppLocaleProvider } from "@/components/LocaleContext";
import { StatusBanner } from "@/components/StatusBanner";
import { ThresholdAlertsSection } from "@/components/ThresholdAlertsSection";
import { getDemoCityLocations } from "@/services/demo-data";
import type { ThresholdAlertRule, TriggeredAlert } from "@/types/guidance";

const DELHI = getDemoCityLocations()[0] ?? null;
const MUMBAI = getDemoCityLocations()[2];
const RULE: ThresholdAlertRule = {
  id: "r1",
  cityKey: "delhi",
  cityName: "Delhi",
  metric: "usAqi",
  threshold: 100,
  enabled: true,
};
const ALERT: TriggeredAlert = {
  ruleId: "r1",
  cityKey: "delhi",
  cityName: "Delhi",
  metric: "usAqi",
  threshold: 100,
  actualValue: 224,
};

const renderInMain = (ui: ReactNode) =>
  render(
    <AppLocaleProvider>
      <main>{ui}</main>
    </AppLocaleProvider>,
  );

const stubJsonFetch = (body: unknown, status = 200) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status }))),
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("CitySearchBar supports ARIA keyboard navigation, mouseDown selection, and axe checks", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  const onGeo = vi.fn();
  stubJsonFetch({ results: [MUMBAI] });

  const { container } = renderInMain(
    <CitySearchBar
      demoMode={true}
      selectedCityKey="delhi"
      geoStatusMessageKey="locationDenied"
      onSelectCity={onSelect}
      onUseMyLocation={onGeo}
    />,
  );
  expect(screen.getByText(/Location permission was blocked/i)).toBeInTheDocument();

  const combobox = screen.getByRole("combobox");
  await user.click(combobox);
  await user.keyboard("{ArrowDown}{ArrowUp}{Enter}");
  await user.type(combobox, "Mum");
  await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());
  await user.keyboard("{ArrowDown}{ArrowUp}{ArrowDown}{Enter}");
  expect(onSelect).toHaveBeenCalledTimes(1);

  await user.type(combobox, "Mum");
  await waitFor(() => expect(screen.getByRole("option")).toBeInTheDocument());
  fireEvent.mouseDown(screen.getByRole("option"));
  await user.click(screen.getByRole("button", { name: "Mumbai" }));
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: /Use my location/i }));
  expect(onSelect).toHaveBeenCalledTimes(3);
  expect(onGeo).toHaveBeenCalledTimes(1);
  expect(await axe(container)).toHaveNoViolations();
});

test("CitySearchBar renders empty, 429 rate-limited, and error responses", async () => {
  const user = userEvent.setup();
  stubJsonFetch({ results: [] });
  renderInMain(
    <CitySearchBar
      demoMode={false}
      selectedCityKey={undefined}
      geoStatusMessageKey="locationUnavailable"
      onSelectCity={vi.fn()}
      onUseMyLocation={vi.fn()}
    />,
  );
  expect(screen.getByText(/Could not read device location/i)).toBeInTheDocument();

  await user.type(screen.getByRole("combobox"), "Nowhere");
  await waitFor(() => expect(screen.getByText(/No matching cities found/i)).toBeInTheDocument());

  stubJsonFetch({}, 429);
  await user.clear(screen.getByRole("combobox"));
  await user.type(screen.getByRole("combobox"), "WaitCity");
  await waitFor(() => expect(screen.getByText(/Please wait/i)).toBeInTheDocument());

  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("fail"))),
  );
  await user.clear(screen.getByRole("combobox"));
  await user.type(screen.getByRole("combobox"), "ErrCity");
  await waitFor(() => expect(screen.getByText(/Unable to load/i)).toBeInTheDocument());
});

test("StatusBanner renders all feedback states and invokes retry handler", async () => {
  const user = userEvent.setup();
  const onRetry = vi.fn();
  renderInMain(
    <>
      <StatusBanner state="loading" retryAfterSeconds={0} onRetry={onRetry} />
      <StatusBanner state="empty" retryAfterSeconds={0} onRetry={onRetry} />
      <StatusBanner state="offline" retryAfterSeconds={0} onRetry={onRetry} />
      <StatusBanner state="rate_limited" retryAfterSeconds={42} onRetry={onRetry} />
      <StatusBanner state="error" retryAfterSeconds={0} onRetry={onRetry} />
    </>,
  );
  await user.click(screen.getByRole("button", { name: /Try again/i }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

test("ThresholdAlertsSection validates bounds, toggles, deletes, and passes axe", async () => {
  const user = userEvent.setup();
  const onAdd = vi.fn();
  const onAction = vi.fn();
  const { container } = renderInMain(
    <ThresholdAlertsSection
      currentCity={DELHI}
      rules={[RULE, { ...RULE, id: "r2", metric: "pm25", enabled: false }]}
      triggeredAlerts={[ALERT, { ...ALERT, ruleId: "r2", metric: "pm25" }]}
      onAddRule={onAdd}
      onToggleRule={onAction}
      onRemoveRule={onAction}
    />,
  );
  expect(screen.getByText(/Delhi: US AQI is 224/i)).toBeInTheDocument();

  const input = screen.getByLabelText(/Trigger when above/i);
  fireEvent.change(input, { target: { value: "5" } });
  await user.click(screen.getByRole("button", { name: /Save alert rule/i }));
  expect(screen.getByText(/between 10 and 500/i)).toBeInTheDocument();

  fireEvent.change(input, { target: { value: "150" } });
  await user.selectOptions(screen.getByLabelText(/Alert metric/i), "pm25");
  await user.click(screen.getByRole("button", { name: /Save alert rule/i }));
  await user.click(screen.getByRole("button", { name: /Enabled/i }));
  const deleteBtns = screen.getAllByRole("button", { name: /Delete alert/i });
  if (deleteBtns[0]) await user.click(deleteBtns[0]);
  expect([onAdd.mock.calls.length, onAction.mock.calls.length]).toEqual([1, 2]);
  expect(await axe(container)).toHaveNoViolations();
});

test("ThresholdAlertsSection supports custom cities and empty alert lists", () => {
  const customCity = {
    key: "custom-tokyo",
    name: "Tokyo",
    region: "Kanto",
    country: "Japan",
    latitude: 35.68,
    longitude: 139.76,
    timezone: "Asia/Tokyo",
  };
  renderInMain(
    <ThresholdAlertsSection
      currentCity={customCity}
      rules={[]}
      triggeredAlerts={[]}
      onAddRule={vi.fn()}
      onToggleRule={vi.fn()}
      onRemoveRule={vi.fn()}
    />,
  );
  expect(screen.getByText(/No alert rules saved yet/i)).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Tokyo" })).toBeInTheDocument();
});
