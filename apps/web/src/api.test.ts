import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DestinationState } from "@smart-crowd-navigator/venue-engine";

const { getAppCheckTokenMock } = vi.hoisted(() => ({
  getAppCheckTokenMock: vi.fn(),
}));

vi.mock("./firebase", () => ({
  getAppCheckToken: getAppCheckTokenMock,
}));

import {
  getGroundedPlaceEnrichment,
  getOperatorState,
  requestAssistantResponse,
  resetOperatorState,
  syncOperatorStates,
  updateOperatorState,
} from "./api";

const fetchMock = vi.fn<typeof fetch>();

const baseRecommendation = {
  confidence: "high",
  crowdWarning: null,
  decisionReasons: {
    strengths: ["Fastest total route right now."],
    tradeoffs: [],
  },
  etaMinutes: 4,
  fallbackOption: {
    id: "stall-d",
    kind: "food",
    label: "Stall D",
  },
  groupPlan: null,
  intent: "food",
  operationalAdvisory: null,
  primaryOption: {
    id: "stall-b",
    kind: "food",
    label: "Stall B",
  },
  primaryReason: "Best total score: 7 minutes.",
  routeSummary: "Section A-12 -> Concourse East -> Stall B",
  timeSavedMinutes: 3,
  timingDecision: "go_now",
  waitMinutes: 1,
  waitOrGoReason: "Go now for the best route outcome.",
} as const;

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json",
    },
    status,
  });
}

function readHeaderValue(init: RequestInit | undefined, name: string) {
  const headers = init?.headers;

  if (headers instanceof Headers) {
    return headers.get(name);
  }

  if (Array.isArray(headers)) {
    return headers.find(([headerName]) => headerName === name)?.[1] ?? null;
  }

  if (!headers) {
    return null;
  }

  return (headers as Record<string, string>)[name] ?? null;
}

beforeEach(() => {
  fetchMock.mockReset();
  getAppCheckTokenMock.mockReset();
  getAppCheckTokenMock.mockResolvedValue("app-check-token");
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api module", () => {
  it("requests assistant responses using app check headers", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        message: "Use Stall B now.",
        recommendation: baseRecommendation,
        source: "gemini",
      }),
    );

    const payload = await requestAssistantResponse({
      eventPhase: "break",
      intent: "food",
      mobilityMode: "standard",
      partySize: 3,
      section: "section-a12",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/assistant-response");
    expect(init.method).toBe("POST");
    expect(readHeaderValue(init, "x-firebase-appcheck")).toBe(
      "app-check-token",
    );
    expect(payload.message).toBe("Use Stall B now.");
  });

  it("falls back to deterministic recommendation endpoint", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "failed" }, 500))
      .mockResolvedValueOnce(jsonResponse(baseRecommendation));

    const payload = await requestAssistantResponse({
      eventPhase: "break",
      intent: "food",
      mobilityMode: "standard",
      partySize: 3,
      section: "section-a12",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [assistantUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [fallbackUrl] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(assistantUrl).toContain("/assistant-response");
    expect(fallbackUrl).toContain("/recommendation");
    expect(payload.message).toContain("Use Stall B");
    expect(payload.recommendation.primaryOption.id).toBe("stall-b");
  });

  it("throws on failed operator reads", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "failed" }, 500));

    await expect(getOperatorState()).rejects.toThrow(
      "Operator fetch failed with status 500",
    );
  });

  it("posts operator updates with auth and app check headers", async () => {
    const state: DestinationState = {
      crowdPenalty: 1,
      nodeId: "stall-b",
      queueMinutes: 8,
      queueTrendAfterFiveMinutes: -1,
      serviceMinutesPerAdditionalPerson: 2,
    };

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        states: [state],
      }),
    );

    await updateOperatorState(state, "operator-token");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/operator/state");
    expect(init.method).toBe("POST");
    expect(readHeaderValue(init, "authorization")).toBe(
      "Bearer operator-token",
    );
    expect(readHeaderValue(init, "x-firebase-appcheck")).toBe(
      "app-check-token",
    );
  });

  it("throws on failed operator updates", async () => {
    const state: DestinationState = {
      crowdPenalty: 1,
      nodeId: "stall-b",
      queueMinutes: 8,
      queueTrendAfterFiveMinutes: -1,
      serviceMinutesPerAdditionalPerson: 2,
    };

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "failed" }, 401));

    await expect(updateOperatorState(state)).rejects.toThrow(
      "Operator update failed with status 401",
    );
  });

  it("posts bulk operator sync updates", async () => {
    const state: DestinationState = {
      crowdPenalty: 1,
      nodeId: "stall-b",
      queueMinutes: 8,
      queueTrendAfterFiveMinutes: -1,
      serviceMinutesPerAdditionalPerson: 2,
    };

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        states: [state],
      }),
    );

    await syncOperatorStates([state], "operator-token");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/operator/state/bulk");
    expect(init.method).toBe("POST");
    expect(readHeaderValue(init, "authorization")).toBe(
      "Bearer operator-token",
    );
  });

  it("throws on failed bulk operator sync updates", async () => {
    const state: DestinationState = {
      crowdPenalty: 1,
      nodeId: "stall-b",
      queueMinutes: 8,
      queueTrendAfterFiveMinutes: -1,
      serviceMinutesPerAdditionalPerson: 2,
    };

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "failed" }, 403));

    await expect(syncOperatorStates([state])).rejects.toThrow(
      "Operator sync failed with status 403",
    );
  });

  it("resets operator state without content-type header", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        states: [],
      }),
    );

    await resetOperatorState("operator-token");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/operator/reset");
    expect(init.method).toBe("POST");
    expect(readHeaderValue(init, "content-type")).toBeNull();
  });

  it("throws on failed operator state reset", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "failed" }, 500));

    await expect(resetOperatorState()).rejects.toThrow(
      "Operator reset failed with status 500",
    );
  });

  it("loads grounded place enrichment from the backend route", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        displayName: "Demo Pickup Zone",
        openNow: true,
        rating: 4.6,
        reviewCount: 128,
      }),
    );

    const payload = await getGroundedPlaceEnrichment("demo/place-id");

    expect(payload).toEqual({
      displayName: "Demo Pickup Zone",
      openNow: true,
      rating: 4.6,
      reviewCount: 128,
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/maps/place-enrichment/demo%2Fplace-id");
    expect(init.method).toBe("GET");
    expect(readHeaderValue(init, "content-type")).toBeNull();
  });

  it("throws when grounded place enrichment fails", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "failed" }, 502));

    await expect(getGroundedPlaceEnrichment("demo-place-id")).rejects.toThrow(
      "Place enrichment failed with status 502",
    );
  });
});
