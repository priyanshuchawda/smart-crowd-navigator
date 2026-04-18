import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { requestAssistantResponse } from "./api";
import type { AssistantApiResponse } from "./types";

vi.mock("./api", () => ({
  requestAssistantResponse: vi.fn(),
}));

const requestAssistantResponseMock = vi.mocked(requestAssistantResponse);

function getFoodQuickActionButton() {
  const quickActions = screen.getByRole("region", {
    name: "Quick actions",
  });
  const [foodButton] = within(quickActions).getAllByRole("button");

  if (!foodButton) {
    throw new Error("Expected quick actions to include the Food button");
  }

  return foodButton;
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

afterEach(() => {
  requestAssistantResponseMock.mockReset();
  cleanup();
});

describe("App behavior", () => {
  it("requests a quick action recommendation and renders it", async () => {
    requestAssistantResponseMock.mockResolvedValueOnce(
      createAssistantResponse(),
    );

    render(<App />);
    await userEvent.click(getFoodQuickActionButton());

    await waitFor(() => {
      expect(requestAssistantResponseMock).toHaveBeenCalledTimes(1);
    });

    expect(requestAssistantResponseMock.mock.calls[0]?.[0]).toMatchObject({
      eventPhase: "break",
      intent: "food",
      mobilityMode: "standard",
      partySize: 3,
      section: "section-a12",
    });
    expect(
      await screen.findByRole("heading", { name: "Stall B" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Go now for the best route outcome."),
    ).toBeVisible();

    const transcript = screen.getByRole("log", {
      name: "Conversation transcript",
    });
    expect(within(transcript).getByText("Use Stall B now.")).toBeVisible();
  });

  it("shows a request failure banner when recommendation lookup fails", async () => {
    requestAssistantResponseMock.mockRejectedValueOnce(
      new Error("Request failed with status 500"),
    );

    render(<App />);
    await userEvent.click(getFoodQuickActionButton());

    expect(
      await screen.findByText("Request failed with status 500"),
    ).toBeVisible();
  });

  it("reflects loading state while recommendation request is in-flight", async () => {
    let resolveRequest: ((response: AssistantApiResponse) => void) | undefined;
    requestAssistantResponseMock.mockReturnValueOnce(
      new Promise<AssistantApiResponse>((resolve) => {
        resolveRequest = (response) => {
          resolve(response);
        };
      }),
    );

    render(<App />);
    await userEvent.click(getFoodQuickActionButton());

    expect(screen.getByText("Planning…")).toBeVisible();
    expect(getFoodQuickActionButton()).toBeDisabled();

    const resolvePendingRequest = resolveRequest;

    if (!resolvePendingRequest) {
      throw new Error("Expected a pending recommendation request resolver");
    }

    resolvePendingRequest(createAssistantResponse());

    expect(
      await screen.findByRole("heading", { name: "Stall B" }),
    ).toBeVisible();
    expect(screen.getByText("Ready for the next move")).toBeVisible();
  });

  it("submits typed follow-up questions with conversation context", async () => {
    requestAssistantResponseMock
      .mockResolvedValueOnce(
        createAssistantResponse({
          message: "Initial recommendation",
        }),
      )
      .mockResolvedValueOnce(
        createAssistantResponse({
          message: "Follow-up guidance",
        }),
      );

    render(<App />);
    await userEvent.click(getFoodQuickActionButton());
    await screen.findByText("Initial recommendation");

    const followUpQuestion = "Why is this option better right now?";
    await userEvent.type(
      screen.getByLabelText("Ask the assistant"),
      followUpQuestion,
    );

    const submitButton = screen.getByRole("button", { name: "Send question" });
    expect(submitButton).toBeEnabled();
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(requestAssistantResponseMock).toHaveBeenCalledTimes(2);
    });

    const secondPayload = requestAssistantResponseMock.mock.calls[1]?.[0];
    expect(secondPayload).toBeDefined();
    expect(secondPayload).toMatchObject({
      intent: "food",
      question: followUpQuestion,
    });
    expect(secondPayload?.conversationHistory?.at(-1)).toMatchObject({
      role: "user",
      text: followUpQuestion,
    });
    expect(await screen.findByText("Follow-up guidance")).toBeVisible();
  });

  it("starts with accessible transcript semantics and disabled empty submit", () => {
    render(<App />);

    const transcript = screen.getByRole("log", {
      name: "Conversation transcript",
    });
    expect(transcript).toHaveAttribute("aria-live", "polite");
    expect(transcript).toHaveAttribute("aria-relevant", "additions text");
    expect(
      screen.getByRole("button", { name: "Send question" }),
    ).toBeDisabled();
  });
});
