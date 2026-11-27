// ============================================================================
// tests/unit/hooks-air-quality.test.tsx
// Tests useAirQualityData live loading, offline snapshots, 429, and geo states.
// ============================================================================

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useAirQualityData } from "@/hooks/useAirQualityData";
import { getDemoAirQualityReport, getDemoCityLocations } from "@/services/demo-data";

const jsonRes = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );

function stubGeolocation(mode: "granted" | "denied" | "unavailable" | "missing") {
  if (mode === "missing") {
    Object.defineProperty(navigator, "geolocation", { value: undefined, configurable: true });
    return;
  }
  const getCurrentPosition = vi.fn((okCb: PositionCallback, errCb: PositionErrorCallback) => {
    if (mode === "granted") {
      okCb({
        coords: {
          latitude: 51.5074,
          longitude: -0.1278,
          accuracy: 100,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      });
    } else {
      errCb({
        code: mode === "denied" ? 1 : 2,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: mode,
      });
    }
  });
  Object.defineProperty(navigator, "geolocation", {
    value: { getCurrentPosition },
    configurable: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
});

test("useAirQualityData loads live report, falls back to offline snapshot, and handles 429", async () => {
  const delhiReport = getDemoAirQualityReport("delhi");
  const fetchMock = vi.fn(() => jsonRes({ report: { ...delhiReport, source: "open-meteo" } }));
  vi.stubGlobal("fetch", fetchMock);

  const { result } = renderHook(() => useAirQualityData(false));
  await waitFor(() => {
    expect(result.current.loadState).toBe("ready");
  });
  expect(result.current.report?.source).toBe("open-meteo");

  Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
  act(() => {
    result.current.retry();
  });
  await waitFor(() => {
    expect(result.current.loadState).toBe("offline");
  });
  expect(result.current.report?.source).toBe("cached");

  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  fetchMock.mockImplementationOnce(() => jsonRes({ error: { retryAfterSeconds: 25 } }, 429));
  act(() => {
    result.current.retry();
  });
  await waitFor(() => {
    expect(result.current.loadState).toBe("rate_limited");
  });
  expect(result.current.retryAfterSeconds).toBe(25);
});

test("useAirQualityData handles geolocation granted, denied, unavailable, and missing API", async () => {
  const fetchMock = vi.fn(() => jsonRes({ report: getDemoAirQualityReport("delhi") }));
  vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(() => useAirQualityData(false));
  await waitFor(() => {
    expect(result.current.loadState).toBe("ready");
  });

  stubGeolocation("denied");
  act(() => {
    result.current.requestUserLocation();
  });
  expect(result.current.geoStatusMessageKey).toBe("locationDenied");

  stubGeolocation("granted");
  fetchMock.mockImplementationOnce(() => jsonRes({ report: getDemoAirQualityReport("london") }));
  act(() => {
    result.current.requestUserLocation();
  });
  await waitFor(() => {
    expect(result.current.selectedCity?.key).toBe("geo-self-current");
  });

  stubGeolocation("unavailable");
  act(() => {
    result.current.requestUserLocation();
  });
  expect(result.current.geoStatusMessageKey).toBe("locationUnavailable");

  stubGeolocation("missing");
  act(() => {
    result.current.requestUserLocation();
  });
  expect(result.current.geoStatusMessageKey).toBe("locationUnavailable");
});

test("useAirQualityData handles cache mismatch, matching cache error, corrupt offline, and demo mode", async () => {
  const [delhi, mumbai, , london] = getDemoCityLocations();
  const fetchMock = vi.fn((): Promise<Response> => Promise.reject(new Error("offline")));
  vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(() => useAirQualityData(false));
  await waitFor(() => {
    expect(result.current.loadState).toBe("error");
  });

  window.localStorage.setItem(
    "urban-air:last-snapshot:v1",
    JSON.stringify(getDemoAirQualityReport("delhi")),
  );
  fetchMock.mockImplementationOnce(() => jsonRes({ error: { message: "err" } }, 500));
  if (mumbai)
    act(() => {
      result.current.selectCity(mumbai);
    });
  await waitFor(() => {
    expect(result.current.loadState).toBe("error");
  });

  fetchMock.mockImplementationOnce(() => jsonRes({ error: { message: "err" } }, 500));
  if (delhi)
    act(() => {
      result.current.selectCity(delhi);
    });
  await waitFor(() => {
    expect(result.current.loadState).toBe("offline");
  });

  window.localStorage.setItem("urban-air:last-snapshot:v1", "{bad-json");
  Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
  act(() => {
    result.current.retry();
  });
  await waitFor(() => {
    expect(result.current.loadState).toBe("error");
  });

  const { result: demoHook } = renderHook(() => useAirQualityData(true));
  if (london) {
    act(() => {
      demoHook.current.selectCity(london);
    });
    expect(demoHook.current.report?.location.key).toBe("london");
  }
});
