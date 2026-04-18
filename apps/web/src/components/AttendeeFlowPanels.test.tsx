import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type RefObject, createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChatMessage } from "../types";
import { AttendeeFlowPanels } from "./AttendeeFlowPanels";

vi.mock("../api", () => ({
  requestAssistantResponse: vi.fn(),
  getGroundedPlaceEnrichment: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

function renderPanels(
  overrides: Partial<Parameters<typeof AttendeeFlowPanels>[0]> = {},
) {
  const defaults = {
    activeIntent: null as Parameters<typeof AttendeeFlowPanels>[0]["activeIntent"],
    draftQuestion: "",
    errorMessage: null,
    eventPhase: "break" as const,
    groupWorkflow: "auto" as const,
    isLoading: false,
    messages: [] as ChatMessage[],
    mobilityMode: "standard" as const,
    onDraftQuestionChange: vi.fn(),
    onEventPhaseChange: vi.fn(),
    onGroupWorkflowChange: vi.fn(),
    onMobilityModeChange: vi.fn(),
    onPartySizeChange: vi.fn(),
    onRequestRecommendation: vi.fn(),
    onSectionChange: vi.fn(),
    onSubmitQuestion: vi.fn(),
    partySize: 3,
    recommendationHeadingRef:
      createRef<HTMLHeadingElement>() as RefObject<HTMLHeadingElement | null>,
    recommendationSectionRef:
      createRef<HTMLDivElement>() as RefObject<HTMLDivElement | null>,
    response: null,
    section: "section-a12",
    summary: "SECTION-A12 · Party of 3 · break · standard",
  };

  return {
    props: { ...defaults, ...overrides },
    ...render(<AttendeeFlowPanels {...defaults} {...overrides} />),
  };
}

describe("AttendeeFlowPanels", () => {
  it("renders the How It Works step cards", () => {
    renderPanels();

    expect(screen.getByText("1. Add your context")).toBeVisible();
    expect(screen.getByText("2. Choose your goal")).toBeVisible();
    expect(screen.getByText("3. Follow the next move")).toBeVisible();
  });

  it("renders all four quick action intent buttons", () => {
    renderPanels();

    const quickActions = screen.getByRole("region", {
      name: "Quick actions",
    });
    const buttons = within(quickActions).getAllByRole("button");
    expect(buttons).toHaveLength(4);
  });

  it("disables quick action buttons when loading", () => {
    renderPanels({ isLoading: true });

    const quickActions = screen.getByRole("region", {
      name: "Quick actions",
    });
    const buttons = within(quickActions).getAllByRole("button");
    for (const button of buttons) {
      expect(button).toBeDisabled();
    }
  });

  it("calls onRequestRecommendation when a quick action is clicked", async () => {
    const onRequestRecommendation = vi.fn();
    renderPanels({ onRequestRecommendation });

    const quickActions = screen.getByRole("region", {
      name: "Quick actions",
    });
    const [foodButton] = within(quickActions).getAllByRole("button");

    if (foodButton) {
      await userEvent.click(foodButton);
    }

    expect(onRequestRecommendation).toHaveBeenCalledWith("food");
  });

  it("renders the attendee context controls with labels", () => {
    renderPanels();

    expect(screen.getByText("Section")).toBeInTheDocument();
    expect(screen.getByText("Party Size")).toBeInTheDocument();
    expect(screen.getByText("Event Phase")).toBeInTheDocument();
    expect(screen.getByText("Mobility")).toBeInTheDocument();
  });

  it("renders the conversation panel and recommendation panel", () => {
    renderPanels();

    expect(
      screen.getByRole("region", { name: "Assistant conversation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Recommendation details" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Venue layout map" }),
    ).toBeInTheDocument();
  });

  it("shows the current summary in the attendee context heading", () => {
    renderPanels({
      summary: "SECTION-C04 · Party of 2 · in-play · accessible",
    });

    expect(
      screen.getByText("SECTION-C04 · Party of 2 · in-play · accessible"),
    ).toBeVisible();
  });
});
