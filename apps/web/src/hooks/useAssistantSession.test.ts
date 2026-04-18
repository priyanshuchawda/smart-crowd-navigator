import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { requestAssistantResponse } from "../api";
import type { AssistantApiResponse } from "../types";
import {
  inferIntentFromQuestion,
  useAssistantSession,
} from "./useAssistantSession";

vi.mock("../api", () => ({
  requestAssistantResponse: vi.fn(),
}));

const requestAssistantResponseMock = vi.mocked(requestAssistantResponse);

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolveFn: ((value: T) => void) | undefined;
  let rejectFn: ((error: unknown) => void) | undefined;

  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  if (!resolveFn || !rejectFn) {
    throw new Error("Expected deferred promise handlers");
  }

  return {
    promise,
    resolve: resolveFn,
    reject: rejectFn,
  };
}

function createAssistantResponse(
  overrides: Partial<AssistantApiResponse> = {},
): AssistantApiResponse {
  return {
    message: "Use Stall B now.",
    recommendation: {
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
    },
    source: "gemini",
    ...overrides,
  };
}

function renderAssistantSessionHook(options?: {
  onRecommendationReady?: () => void;
}) {
  return renderHook(() =>
    useAssistantSession({
      eventPhase: "break",
      groupWorkflow: "auto",
      mobilityMode: "standard",
      onRecommendationReady: options?.onRecommendationReady,
      partySize: 3,
      section: "section-a12",
      summary: "SECTION-A12 · Party of 3 · break · standard",
    }),
  );
}

afterEach(() => {
  requestAssistantResponseMock.mockReset();
  cleanup();
});

describe("inferIntentFromQuestion", () => {
  it("infers keyword-based intents and falls back to active intent", () => {
    expect(inferIntentFromQuestion("nearest washroom?", null)).toBe("washroom");
    expect(inferIntentFromQuestion("best entry gate", null)).toBe("entry-gate");
    expect(inferIntentFromQuestion("quickest exit route", null)).toBe("exit");
    expect(inferIntentFromQuestion("food stall nearby", null)).toBe("food");
    expect(inferIntentFromQuestion("what do you suggest", "exit")).toBe("exit");
  });
});

describe("useAssistantSession", () => {
  it("requests recommendation and appends user and assistant messages", async () => {
    requestAssistantResponseMock.mockResolvedValueOnce(
      createAssistantResponse(),
    );

    const onRecommendationReady = vi.fn();
    const { result } = renderAssistantSessionHook({ onRecommendationReady });

    await act(async () => {
      await result.current.requestRecommendation("food");
    });

    expect(requestAssistantResponseMock).toHaveBeenCalledTimes(1);
    expect(requestAssistantResponseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventPhase: "break",
        groupWorkflow: undefined,
        intent: "food",
        mobilityMode: "standard",
        partySize: 3,
        question:
          "Find the best food option for SECTION-A12 · Party of 3 · break · standard.",
        section: "section-a12",
      }),
    );

    expect(result.current.activeIntent).toBe("food");
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.response?.message).toBe("Use Stall B now.");
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({ role: "user" });
    expect(result.current.messages[1]).toMatchObject({
      role: "assistant",
      text: "Use Stall B now.",
    });
    expect(onRecommendationReady).toHaveBeenCalledTimes(1);
  });

  it("submits typed question with inferred intent and trims question", async () => {
    requestAssistantResponseMock.mockResolvedValueOnce(
      createAssistantResponse(),
    );

    const { result } = renderAssistantSessionHook();

    act(() => {
      result.current.setDraftQuestion("  nearest restroom please  ");
    });

    act(() => {
      result.current.submitQuestion();
    });

    await waitFor(() => {
      expect(requestAssistantResponseMock).toHaveBeenCalledTimes(1);
    });

    expect(requestAssistantResponseMock.mock.calls[0]?.[0]).toMatchObject({
      intent: "washroom",
      question: "nearest restroom please",
    });
    expect(result.current.activeIntent).toBe("washroom");

    await waitFor(() => {
      expect(result.current.draftQuestion).toBe("");
    });
  });

  it("ignores stale responses when a newer request completes first", async () => {
    const first = createDeferred<AssistantApiResponse>();
    const second = createDeferred<AssistantApiResponse>();

    requestAssistantResponseMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const onRecommendationReady = vi.fn();
    const { result } = renderAssistantSessionHook({ onRecommendationReady });

    act(() => {
      void result.current.requestRecommendation("food");
      void result.current.requestRecommendation("exit");
    });

    await act(async () => {
      second.resolve(
        createAssistantResponse({
          message: "Use North Exit.",
          recommendation: {
            ...createAssistantResponse().recommendation,
            intent: "exit",
            primaryOption: {
              id: "north-exit",
              kind: "exit",
              label: "North Exit",
            },
          },
        }),
      );
      await second.promise;
    });

    await act(async () => {
      first.resolve(
        createAssistantResponse({
          message: "Old stale response",
        }),
      );
      await first.promise;
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.response?.message).toBe("Use North Exit.");
    expect(
      result.current.messages[result.current.messages.length - 1],
    ).toMatchObject({
      role: "assistant",
      text: "Use North Exit.",
    });
    expect(result.current.activeIntent).toBe("exit");
    expect(onRecommendationReady).toHaveBeenCalledTimes(1);
  });

  it("surfaces request errors and clears loading state", async () => {
    requestAssistantResponseMock.mockRejectedValueOnce(
      new Error("Request failed with status 500"),
    );

    const { result } = renderAssistantSessionHook();

    act(() => {
      void result.current.requestRecommendation("food");
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.errorMessage).toBe("Request failed with status 500");
    expect(result.current.response).toBeNull();
  });
});
