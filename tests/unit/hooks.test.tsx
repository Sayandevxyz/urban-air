import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAirQualityData } from "@/hooks/useAirQualityData";
import { useCityComparison } from "@/hooks/useCityComparison";
import { useCitySearch } from "@/hooks/useCitySearch";
import { useLocalAlerts } from "@/hooks/useLocalAlerts";
import { getDemoAirQualityReport, getDemoCityLocations } from "@/services/demo-data";

describe("custom client hooks", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });

  it("useAirQualityData handles live fetch, offline cache fallback, 429 rate limits, and geolocation", async () => {
    const delhiReport = getDemoAirQualityReport("delhi");
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ report: { ...delhiReport, source: "open-meteo" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAirQualityData(false));
    await waitFor(() => {
      expect(result.current.loadState).toBe("ready");
    });
    expect(result.current.report?.source).toBe("open-meteo");

    // Simulate offline falling back to cached snapshot
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    act(() => {
      result.current.retry();
    });
    await waitFor(() => {
      expect(result.current.loadState).toBe("offline");
    });
    expect(result.current.report?.source).toBe("cached");

    // Simulate 429 rate limited response
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { retryAfterSeconds: 25 } }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    );
    act(() => {
      result.current.retry();
    });
    await waitFor(() => {
      expect(result.current.loadState).toBe("rate_limited");
    });
    expect(result.current.retryAfterSeconds).toBe(25);

    // Geolocation denied vs granted
    const getCurrentPosition = vi.fn(
      (_success: PositionCallback, errorCb: PositionErrorCallback) => {
        errorCb({
          code: 1,
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
          message: "denied",
        });
      },
    );
    Object.defineProperty(navigator, "geolocation", {
      value: { getCurrentPosition },
      configurable: true,
    });

    act(() => {
      result.current.requestUserLocation();
    });
    expect(result.current.geoStatusMessageKey).toBe("locationDenied");

    getCurrentPosition.mockImplementationOnce((successCb: PositionCallback) => {
      successCb({
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
    });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ report: getDemoAirQualityReport("london") }), { status: 200 }),
    );
    act(() => {
      result.current.requestUserLocation();
    });
    await waitFor(() => {
      expect(result.current.selectedCity?.key).toBe("geo-self-current");
    });

    // Unavailable error code 2 and error fallback without cache
    getCurrentPosition.mockImplementationOnce(
      (_s: PositionCallback, errorCb: PositionErrorCallback) => {
        errorCb({
          code: 2,
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
          message: "unavailable",
        });
      },
    );
    act(() => {
      result.current.requestUserLocation();
    });
    expect(result.current.geoStatusMessageKey).toBe("locationUnavailable");

    window.localStorage.clear();
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    const mumbai = getDemoCityLocations()[2];
    if (mumbai) {
      act(() => {
        result.current.selectCity(mumbai);
      });
      await waitFor(() => {
        expect(result.current.loadState).toBe("error");
      });
    }

    // Missing geolocation API
    Object.defineProperty(navigator, "geolocation", { value: undefined, configurable: true });
    act(() => {
      result.current.requestUserLocation();
    });
    expect(result.current.geoStatusMessageKey).toBe("locationUnavailable");

    // 500 error with mismatched cache key -> error state
    window.localStorage.setItem(
      "urban-air:last-snapshot:v1",
      JSON.stringify(getDemoAirQualityReport("delhi")),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "err" } }), { status: 500 }),
    );
    const coimbatoreCity = getDemoCityLocations()[1];
    if (coimbatoreCity) {
      act(() => {
        result.current.selectCity(coimbatoreCity);
      });
      await waitFor(() => {
        expect(result.current.loadState).toBe("error");
      });
    }

    // 500 error falling back to matching cached snapshot -> offline
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "err" } }), { status: 500 }),
    );
    const delhiCity = getDemoCityLocations()[0];
    if (delhiCity) {
      act(() => {
        result.current.selectCity(delhiCity);
      });
      await waitFor(() => {
        expect(result.current.loadState).toBe("offline");
      });
    }

    // Fetch throw WITH cached snapshot -> offline; offline navigator WITHOUT cache -> error
    fetchMock.mockRejectedValueOnce(new Error("down"));
    act(() => {
      result.current.retry();
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
  });

  it("useCityComparison fetches parallel live cities, handles fallback on !res.ok, and manages max-3", async () => {
    const london = getDemoCityLocations()[3];
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ report: getDemoAirQualityReport("mumbai") }), {
          status: 200,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCityComparison(false));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    fetchMock.mockResolvedValueOnce(new Response("err", { status: 500 }));
    if (london) {
      act(() => {
        result.current.addCity(london);
      });
      await waitFor(() => {
        expect(result.current.cities).toHaveLength(3);
      });
    }

    act(() => {
      result.current.removeCity("delhi");
    });
    expect(result.current.cities.some((c) => c.key === "delhi")).toBe(false);

    // Clear all cities -> hits empty cities branch
    for (const c of [...result.current.cities]) {
      act(() => {
        result.current.removeCity(c.key);
      });
    }
    await waitFor(() => {
      expect(result.current.cities).toHaveLength(0);
    });
  });

  it("useCitySearch handles 429, network error, empty results, and clearResults", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { retryAfterSeconds: 12 } }), { status: 429 }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCitySearch(false));
    act(() => {
      result.current.setQuery("Lon");
    });
    await waitFor(() => {
      expect(result.current.status).toBe("rate_limited");
    });
    expect(result.current.retryAfterSeconds).toBe(12);

    // Query shorter than MIN_CITY_QUERY_LENGTH resets cleanly
    act(() => {
      result.current.setQuery("L");
    });
    expect(result.current.status).toBe("idle");

    fetchMock.mockRejectedValueOnce(new Error("network down"));
    act(() => {
      result.current.setQuery("Ber");
    });
    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    act(() => {
      result.current.clearResults();
    });
    expect(result.current.status).toBe("idle");
  });

  it("useLocalAlerts persists rules, toggles, deletes, and handles corrupt storage", () => {
    window.localStorage.setItem("urban-air:alerts:v1", "{bad-json");
    const delhi = getDemoAirQualityReport("delhi");
    const { result } = renderHook(() => useLocalAlerts({ delhi }));

    window.localStorage.setItem(
      "urban-air:alerts:v1",
      JSON.stringify([
        {
          id: "stored-1",
          cityKey: "delhi",
          cityName: "Delhi",
          metric: "usAqi",
          threshold: 100,
          enabled: true,
        },
        { bad: true },
        null,
      ]),
    );
    const { result: loadedResult } = renderHook(() => useLocalAlerts({ delhi }));
    expect(loadedResult.current.rules).toHaveLength(1);

    expect(result.current.rules.length).toBeGreaterThanOrEqual(1);
    act(() => {
      result.current.addRule({
        cityKey: "delhi",
        cityName: "Delhi",
        metric: "pm25",
        threshold: 90,
      });
    });

    const addedId = result.current.rules[result.current.rules.length - 1]?.id ?? "";
    expect(result.current.triggeredAlerts.some((a) => a.ruleId === addedId)).toBe(true);

    act(() => {
      result.current.toggleRule(addedId);
    });
    expect(result.current.triggeredAlerts.some((a) => a.ruleId === addedId)).toBe(false);

    act(() => {
      result.current.removeRule(addedId);
    });
    expect(result.current.rules.some((r) => r.id === addedId)).toBe(false);
  });
});
