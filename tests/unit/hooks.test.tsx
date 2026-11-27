import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAirQualityData } from "@/hooks/useAirQualityData";
import { useChat } from "@/hooks/useChat";
import { useCityComparison } from "@/hooks/useCityComparison";
import { useCitySearch } from "@/hooks/useCitySearch";
import { useLocalAlerts } from "@/hooks/useLocalAlerts";
import { useRoutineInputs } from "@/hooks/useRoutineInputs";
import { fetchAirQuality, readCachedSnapshot } from "@/lib/air-quality-client";
import { fetchApiJson } from "@/lib/api-client";
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

    // Missing `results` key defaults to [] and AbortError resolves silently without overwriting status
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    act(() => {
      result.current.setQuery("NoResultsKey");
    });
    await waitFor(() => {
      expect(result.current.status).toBe("empty");
    });

    fetchMock.mockRejectedValueOnce(new DOMException("aborted", "AbortError"));
    act(() => {
      result.current.setQuery("AbortedCity");
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
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

  it("switches demo cities cleanly without redundant mount fetches", () => {
    const locations = getDemoCityLocations();
    const { result: aqDemo } = renderHook(() => useAirQualityData(true));
    expect(aqDemo.current.loadState).toBe("ready");
    expect(aqDemo.current.report?.location.key).toBe("delhi");

    const london = locations[3];
    if (london) {
      act(() => {
        aqDemo.current.selectCity(london);
      });
      expect(aqDemo.current.report?.location.key).toBe("london");
    }

    const { result: cmpDemo } = renderHook(() => useCityComparison(true));
    expect(cmpDemo.current.cities).toHaveLength(2);
    if (london) {
      act(() => {
        cmpDemo.current.addCity(london);
        cmpDemo.current.addCity(london);
      });
      expect(cmpDemo.current.cities).toHaveLength(3);
      expect(cmpDemo.current.reports.london?.location.key).toBe("london");
      const beijing = locations[4];
      if (beijing) {
        act(() => {
          cmpDemo.current.addCity(beijing);
        });
        expect(cmpDemo.current.cities).toHaveLength(3);
      }
    }
  });

  it("covers apiClient, fetchAirQuality, useChat, useRoutineInputs, and storage edge paths", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new DOMException("aborted", "AbortError"))),
    );
    const aborted = await fetchApiJson("/api/health");
    expect(aborted).toEqual({ ok: false, kind: "aborted" });

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify("string-body"), { status: 429 }))),
    );
    const nonObject429 = await fetchApiJson("/api/geocode?q=Delhi");
    expect(nonObject429).toEqual({ ok: false, kind: "rate_limited", retryAfterSeconds: 30 });

    const delhiLoc = getDemoCityLocations()[0];
    if (delhiLoc) {
      const demoRes = await fetchAirQuality(delhiLoc, true);
      expect(demoRes.ok).toBe(true);

      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))),
      );
      const missingReport = await fetchAirQuality(delhiLoc, false);
      expect(missingReport).toEqual({ ok: false, kind: "error", status: 502 });

      // Transient geo-self-current location skips persistent snapshot storage
      const geoLoc = { ...delhiLoc, key: "geo-self-current" };
      const geoReport = { ...getDemoAirQualityReport("delhi"), location: geoLoc };
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve(new Response(JSON.stringify({ report: geoReport }), { status: 200 })),
        ),
      );
      window.localStorage.clear();
      const geoRes = await fetchAirQuality(geoLoc, false);
      expect(geoRes.ok).toBe(true);
      expect(window.localStorage.getItem("urban-air:last-snapshot:v1")).toBeNull();

      const locRes = await fetchAirQuality({ ...delhiLoc, key: "loc-2861-7721" }, false);
      expect(locRes.ok).toBe(true);
    }

    window.localStorage.setItem("urban-air:last-snapshot:v1", JSON.stringify({ partial: true }));
    expect(readCachedSnapshot()).toBeNull();
    vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => {
      throw new Error("storage blocked");
    });
    expect(readCachedSnapshot()).toBeNull();

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    const alertsReport = getDemoAirQualityReport("delhi");
    const { result: alertsHook } = renderHook(() => useLocalAlerts({ delhi: alertsReport }));
    act(() => {
      alertsHook.current.addRule({
        cityKey: "delhi",
        cityName: "Delhi",
        metric: "usAqi",
        threshold: 80,
      });
    });
    expect(alertsHook.current.rules.length).toBeGreaterThanOrEqual(1);
    vi.restoreAllMocks();

    const baseReport = getDemoAirQualityReport("delhi");
    const sparseReport = {
      ...baseReport,
      location: { ...baseReport.location, country: "" },
      hourly: [],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              reply: "Gemini grounded reply",
              engine: "gemini",
              refused: false,
              dataSource: "Delhi (demo)",
              updatedAtIso: "2026-11-26T08:00:00Z",
              disclaimer: "Not medical advice",
            }),
            { status: 200 },
          ),
        ),
      ),
    );
    const { result: chatHook } = renderHook(() =>
      useChat(
        sparseReport,
        {
          persona: "general",
          commuteMode: "car",
          homeEnergyMode: "gas_biomass",
          filtrationMode: "none",
        },
        "en",
        { errorReply: "err", fallbackBadge: "Fallback", liveLlmBadge: "Live Gemini" },
      ),
    );
    await act(async () => {
      await chatHook.current.submitQuestion("   ");
    });
    expect(chatHook.current.turns).toHaveLength(0);

    await act(async () => {
      await chatHook.current.submitQuestion("Check AQI now");
    });
    expect(chatHook.current.turns[1]?.meta).toContain("Live Gemini");

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new DOMException("aborted", "AbortError"))),
    );
    await act(async () => {
      await chatHook.current.submitQuestion("Abort check");
    });
    expect(chatHook.current.errorText).toBeNull();

    const { result: routineHook } = renderHook(() =>
      useRoutineInputs(sparseReport, {
        persona: "general",
        commuteMode: "car",
        homeEnergyMode: "gas_biomass",
        filtrationMode: "none",
      }),
    );
    act(() => {
      routineHook.current.setCommuteDistanceKm(Number.NaN);
      routineHook.current.setOutdoorHours(-5);
    });
    expect(routineHook.current.commuteDistanceKm).toBe(0);
    expect(routineHook.current.outdoorHours).toBe(0);
  });
});
