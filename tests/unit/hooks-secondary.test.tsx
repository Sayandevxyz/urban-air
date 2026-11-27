// ============================================================================
// tests/unit/hooks-secondary.test.tsx
// Tests compare, city search, local alerts, chat, routine inputs, and client.
// ============================================================================

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useChat } from "@/hooks/useChat";
import { useCityComparison } from "@/hooks/useCityComparison";
import { useCitySearch } from "@/hooks/useCitySearch";
import { useLocalAlerts } from "@/hooks/useLocalAlerts";
import { useRoutineInputs } from "@/hooks/useRoutineInputs";
import { getDemoAirQualityReport, getDemoCityLocations } from "@/services/demo-data";
import type { CityLocation } from "@/types/air-quality";
import type { ResidentProfile } from "@/types/guidance";

const PROFILE: ResidentProfile = {
  persona: "general",
  commuteMode: "car",
  homeEnergyMode: "gas_biomass",
  filtrationMode: "none",
};
const BASE_RULE = { cityKey: "delhi", cityName: "Delhi", metric: "usAqi" as const, threshold: 80 };
const SAVED_RULE = { ...BASE_RULE, id: "s1", threshold: 100, enabled: true };
const GEMINI_REPLY = {
  reply: "Gemini",
  engine: "gemini",
  refused: false,
  dataSource: "Delhi",
  updatedAtIso: "2026-11-26T08:00:00Z",
  disclaimer: "Info",
};

const jsonRes = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
const setQuery = (h: { current: ReturnType<typeof useCitySearch> }, q: string) => {
  act(() => {
    h.current.setQuery(q);
  });
};
const waitStatus = async (h: { current: { status: string } }, expected: string) => {
  await waitFor(() => {
    expect(h.current.status).toBe(expected);
  });
};
const addCmpCity = (
  h: { current: ReturnType<typeof useCityComparison> },
  city: CityLocation | undefined,
) => {
  if (city) {
    act(() => {
      h.current.addCity(city);
    });
  }
};
const askChat = async (h: { current: ReturnType<typeof useChat> }, q: string) => {
  await act(async () => {
    await h.current.submitQuestion(q);
  });
};

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

test("useCityComparison fetches parallel reports, enforces max 3, and clears cities", async () => {
  const locs = getDemoCityLocations();
  const fetchMock = vi.fn(() => jsonRes({ report: getDemoAirQualityReport("mumbai") }));
  vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(() => useCityComparison(false));
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  fetchMock.mockImplementationOnce(() => Promise.resolve(new Response("err", { status: 500 })));
  addCmpCity(result, locs[3]);
  await waitFor(() => {
    expect(result.current.cities).toHaveLength(3);
  });
  for (const c of [...result.current.cities]) {
    act(() => {
      result.current.removeCity(c.key);
    });
  }
  await waitFor(() => {
    expect(result.current.cities).toHaveLength(0);
  });

  const { result: demo } = renderHook(() => useCityComparison(true));
  addCmpCity(demo, locs[3]);
  addCmpCity(demo, locs[4]);
  expect(demo.current.cities).toHaveLength(3);
});

test("useCitySearch handles 429, min query length, errors, clearResults, empty, and aborts", async () => {
  const fetchMock = vi.fn(() => jsonRes({ error: { retryAfterSeconds: 12 } }, 429));
  vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(() => useCitySearch(false));

  setQuery(result, "Lon");
  await waitStatus(result, "rate_limited");
  expect(result.current.retryAfterSeconds).toBe(12);
  setQuery(result, "L");
  expect(result.current.status).toBe("idle");

  fetchMock.mockImplementationOnce(() => Promise.reject(new Error("down")));
  setQuery(result, "Ber");
  await waitStatus(result, "error");
  act(() => {
    result.current.clearResults();
  });
  expect(result.current.status).toBe("idle");

  fetchMock.mockImplementationOnce(() => jsonRes({}));
  setQuery(result, "None");
  await waitStatus(result, "empty");

  fetchMock.mockImplementationOnce(() => Promise.reject(new DOMException("aborted", "AbortError")));
  setQuery(result, "Aborted");
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalled();
  });
});

test("useLocalAlerts persists valid rules, ignores corrupt storage, and handles quota errors", () => {
  window.localStorage.setItem("urban-air:alerts:v1", "{bad-json");
  const delhi = getDemoAirQualityReport("delhi");
  const { result } = renderHook(() => useLocalAlerts({ delhi }));

  window.localStorage.setItem(
    "urban-air:alerts:v1",
    JSON.stringify([SAVED_RULE, { bad: true }, null]),
  );
  expect(renderHook(() => useLocalAlerts({ delhi })).result.current.rules).toHaveLength(1);

  act(() => {
    result.current.addRule({ cityKey: "delhi", cityName: "Delhi", metric: "pm25", threshold: 90 });
  });
  const id = result.current.rules[result.current.rules.length - 1]?.id ?? "";
  expect(result.current.triggeredAlerts.some((a) => a.ruleId === id)).toBe(true);
  act(() => {
    result.current.toggleRule(id);
  });
  expect(result.current.triggeredAlerts.some((a) => a.ruleId === id)).toBe(false);
  act(() => {
    result.current.removeRule(id);
  });
  expect(result.current.rules.some((r) => r.id === id)).toBe(false);

  const quotaHook = renderHook(() => useLocalAlerts({ delhi }));
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  expect(() => {
    act(() => {
      quotaHook.result.current.addRule(BASE_RULE);
    });
  }).not.toThrow();
});

test("useChat handles live Gemini badges, blank questions, and aborts", async () => {
  const report = getDemoAirQualityReport("delhi");
  const sparse = { ...report, hourly: [], location: { ...report.location, country: "" } };
  vi.stubGlobal(
    "fetch",
    vi.fn(() => jsonRes(GEMINI_REPLY)),
  );
  const opts = { errorReply: "err", fallbackBadge: "Fallback", liveLlmBadge: "Live Gemini" };
  const { result: chat } = renderHook(() => useChat(sparse, PROFILE, "en", opts));

  await askChat(chat, "   ");
  expect(chat.current.turns).toHaveLength(0);
  await askChat(chat, "Check AQI now");
  expect(chat.current.turns[1]?.meta).toContain("Live Gemini");
  const rejectAbort = () => Promise.reject(new DOMException("aborted", "AbortError"));
  vi.stubGlobal("fetch", vi.fn(rejectAbort));
  await askChat(chat, "Abort check");
  expect(chat.current.errorText).toBeNull();
});

test("useRoutineInputs clamps NaN and negative hour bounds to zero", () => {
  const { result } = renderHook(() => useRoutineInputs(getDemoAirQualityReport("delhi"), PROFILE));
  act(() => {
    result.current.setCommuteDistanceKm(Number.NaN);
    result.current.setOutdoorHours(-5);
  });
  expect([result.current.commuteDistanceKm, result.current.outdoorHours]).toEqual([0, 0]);
});
