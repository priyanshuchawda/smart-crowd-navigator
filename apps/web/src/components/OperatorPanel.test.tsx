import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DestinationState } from "@smart-crowd-navigator/venue-engine";
import { OperatorPanel } from "./OperatorPanel";

afterEach(() => {
  cleanup();
});

const sampleStates: DestinationState[] = [
  {
    nodeId: "stall-b",
    queueMinutes: 5,
    crowdPenalty: 2,
    queueTrendAfterFiveMinutes: -1,
    serviceMinutesPerAdditionalPerson: 0.5,
  },
  {
    nodeId: "stall-d",
    queueMinutes: 8,
    crowdPenalty: 3,
    queueTrendAfterFiveMinutes: 1,
    serviceMinutesPerAdditionalPerson: 0.5,
  },
];

function renderOperatorPanel(
  overrides: Partial<Parameters<typeof OperatorPanel>[0]> = {},
) {
  const defaults = {
    errorMessage: null,
    isUpdating: false,
    onReset: vi.fn(),
    onUpdate: vi.fn(),
    states: sampleStates,
  };

  return {
    props: { ...defaults, ...overrides },
    ...render(<OperatorPanel {...defaults} {...overrides} />),
  };
}

describe("OperatorPanel", () => {
  it("renders operator console with section label", () => {
    renderOperatorPanel();

    expect(
      screen.getByRole("region", { name: "Operator console" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Operator Console")).toBeVisible();
  });

  it("renders a card for each destination state", () => {
    renderOperatorPanel();

    expect(screen.getByText("stall-b")).toBeVisible();
    expect(screen.getByText("stall-d")).toBeVisible();
  });

  it("shows Ready status when not updating", () => {
    renderOperatorPanel();

    expect(screen.getByText("Ready")).toBeVisible();
  });

  it("shows Updating… status when update is in progress", () => {
    renderOperatorPanel({ isUpdating: true });

    expect(screen.getByText("Updating…")).toBeVisible();
  });

  it("disables Apply Change buttons when updating", () => {
    renderOperatorPanel({ isUpdating: true });

    const buttons = screen.getAllByRole("button", { name: "Apply Change" });
    for (const button of buttons) {
      expect(button).toBeDisabled();
    }
  });

  it("calls onReset when Reset Live State is clicked", async () => {
    const { props } = renderOperatorPanel();

    await userEvent.click(
      screen.getByRole("button", { name: "Reset Live State" }),
    );

    expect(props.onReset).toHaveBeenCalledTimes(1);
  });

  it("calls onUpdate when Apply Change is clicked for a node", async () => {
    const { props } = renderOperatorPanel();

    const applyButtons = screen.getAllByRole("button", {
      name: "Apply Change",
    });
    const [firstApplyButton] = applyButtons;

    if (firstApplyButton) {
      await userEvent.click(firstApplyButton);
    }

    expect(props.onUpdate).toHaveBeenCalledTimes(1);
  });

  it("displays error banner when errorMessage is set", () => {
    renderOperatorPanel({ errorMessage: "Update failed" });

    expect(screen.getByText("Update failed")).toBeVisible();
  });

  it("shows the signed-in operator email when provided", () => {
    renderOperatorPanel({
      currentOperatorEmail: "admin@venue.com",
    });

    expect(
      screen.getByText("Signed in as admin@venue.com"),
    ).toBeVisible();
  });

  it("renders Sign Out button when onSignOut is provided", async () => {
    const onSignOut = vi.fn();
    renderOperatorPanel({ onSignOut });

    const signOutButton = screen.getByRole("button", { name: "Sign Out" });
    expect(signOutButton).toBeVisible();

    await userEvent.click(signOutButton);
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
