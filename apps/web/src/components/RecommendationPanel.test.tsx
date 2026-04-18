import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AssistantApiResponse } from "../types";

const { getGroundedPlaceEnrichmentMock } = vi.hoisted(() => ({
  getGroundedPlaceEnrichmentMock: vi.fn(),
}));

vi.mock("../api", () => ({
  getGroundedPlaceEnrichment: getGroundedPlaceEnrichmentMock,
}));

import { RecommendationPanel } from "./RecommendationPanel";

function createAssistantResponse(
  overrides: Partial<AssistantApiResponse> = {},
): AssistantApiResponse {
  return {
    grounding: {
      places: [
        {
          placeId: "demo-place-id",
          title: "Demo Pickup Zone",
          uri: "https://maps.google.com/?cid=demo",
        },
      ],
      source: "google-maps",
      widgetContextToken: "widget-token",
    },
    message: "Use Exit South, then head to the nearby Demo Pickup Zone.",
    recommendation: {
      confidence: "high",
      crowdWarning: null,
      decisionReasons: {
        strengths: ["Lower congestion pressure than the main fallback route."],
        tradeoffs: ["Queue is still meaningful even on the best route."],
      },
      etaMinutes: 3,
      fallbackOption: null,
      groupPlan: null,
      intent: "exit",
      operationalAdvisory: null,
      primaryOption: {
        id: "exit-south",
        kind: "exit",
        label: "Exit South",
      },
      primaryReason: "Best total score: 6 minutes.",
      routeSummary: "Section A-12 -> South Hall -> Exit South",
      timeSavedMinutes: 0,
      timingDecision: "go_now",
      waitMinutes: 3,
      waitOrGoReason:
        "Leaving now is still the fastest option once wait time is included.",
    },
    source: "gemini",
    ...overrides,
  };
}

afterEach(() => {
  getGroundedPlaceEnrichmentMock.mockReset();
  cleanup();
});

describe("RecommendationPanel", () => {
  it("renders loading state", () => {
    render(<RecommendationPanel isLoading response={null} />);

    expect(screen.getByLabelText("Loading recommendation")).toBeVisible();
    expect(screen.getByText("Calculating…")).toBeVisible();
  });

  it("renders empty state when no recommendation is available", () => {
    render(<RecommendationPanel response={null} />);

    expect(screen.getByText("No recommendation yet")).toBeVisible();
    expect(screen.getByText("Waiting for input")).toBeVisible();
  });

  it("loads backend place enrichment for grounded citations", async () => {
    getGroundedPlaceEnrichmentMock.mockResolvedValueOnce({
      displayName: "Demo Pickup Zone",
      openNow: true,
      rating: 4.6,
      reviewCount: 128,
    });

    render(<RecommendationPanel response={createAssistantResponse()} />);

    await waitFor(() => {
      expect(getGroundedPlaceEnrichmentMock).toHaveBeenCalledWith(
        "demo-place-id",
        expect.any(AbortSignal),
      );
    });

    expect(await screen.findByText("4.6 / 5 rating")).toBeVisible();
    expect(screen.getByText("128 reviews")).toBeVisible();
    expect(screen.getByText("Open now")).toBeVisible();
    expect(screen.getByTitle("Map preview for Demo Pickup Zone")).toBeVisible();
  });

  it("shows a degraded-mode message when backend enrichment fails", async () => {
    getGroundedPlaceEnrichmentMock.mockRejectedValueOnce(
      new Error("Place enrichment failed"),
    );

    render(<RecommendationPanel response={createAssistantResponse()} />);

    expect(
      await screen.findByText(
        "Places details unavailable. Showing map preview only.",
      ),
    ).toBeVisible();
    expect(screen.getByTitle("Map preview for Demo Pickup Zone")).toBeVisible();
  });

  it("does not request place enrichment when a grounding placeId is missing", async () => {
    render(
      <RecommendationPanel
        response={createAssistantResponse({
          grounding: {
            places: [
              {
                title: "Demo Pickup Zone",
                uri: "https://maps.google.com/?cid=demo",
              },
            ],
            source: "google-maps",
          },
        })}
      />,
    );

    await waitFor(() => {
      expect(getGroundedPlaceEnrichmentMock).not.toHaveBeenCalled();
    });
  });
});
