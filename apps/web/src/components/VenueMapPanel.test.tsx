import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { AssistantApiResponse } from "../types";
import { VenueMapPanel } from "./VenueMapPanel";

afterEach(() => {
  cleanup();
});

function createResponse(
  overrides: Partial<AssistantApiResponse> = {},
): AssistantApiResponse {
  return {
    message: "Go now to Stall B.",
    recommendation: {
      confidence: "high",
      crowdWarning: null,
      decisionReasons: {
        strengths: ["Short walking distance."],
        tradeoffs: [],
      },
      etaMinutes: 3,
      fallbackOption: null,
      groupPlan: null,
      intent: "food",
      operationalAdvisory: null,
      primaryOption: { id: "stall-b", kind: "food", label: "Stall B" },
      primaryReason: "Best total score.",
      routeSummary: "Section A-12 → Concourse East → Stall B",
      timeSavedMinutes: 2,
      timingDecision: "go_now",
      waitMinutes: 1,
      waitOrGoReason: "Go now for the best outcome.",
    },
    source: "gemini",
    ...overrides,
  };
}

describe("VenueMapPanel", () => {
  it("renders the venue map SVG with accessible role and label", () => {
    render(<VenueMapPanel response={null} />);

    const svg = screen.getByRole("img", {
      name: /Stadium venue map/,
    });
    expect(svg).toBeInTheDocument();
  });

  it('shows "No selection" status when no response is active', () => {
    render(<VenueMapPanel response={null} />);

    expect(screen.getByText("No selection")).toBeVisible();
  });

  it("shows the active node id when a recommendation is present", () => {
    render(<VenueMapPanel response={createResponse()} />);

    expect(screen.getByText("Active: stall-b")).toBeVisible();
  });

  it("renders the route summary when available", () => {
    render(<VenueMapPanel response={createResponse()} />);

    expect(
      screen.getByText("Section A-12 → Concourse East → Stall B"),
    ).toBeVisible();
  });

  it("does not render route summary when response is null", () => {
    render(<VenueMapPanel response={null} />);

    expect(screen.queryByText(/Route:/)).not.toBeInTheDocument();
  });

  it("renders all legend entries", () => {
    render(<VenueMapPanel response={null} />);

    expect(screen.getByText("Recommended")).toBeInTheDocument();
  });
});
