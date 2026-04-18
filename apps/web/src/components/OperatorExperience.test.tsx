import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DestinationState } from "@smart-crowd-navigator/venue-engine";

const {
  getOperatorStateMock,
  resetOperatorStateMock,
  syncOperatorStatesMock,
  updateOperatorStateMock,
} = vi.hoisted(() => ({
  getOperatorStateMock: vi.fn(),
  resetOperatorStateMock: vi.fn(),
  syncOperatorStatesMock: vi.fn(),
  updateOperatorStateMock: vi.fn(),
}));

const {
  getFirebaseLiveVenueStateSnapshotMock,
  getOperatorIdTokenMock,
  setFirebaseLiveVenueStateMock,
  signInOperatorMock,
  signInOperatorWithGoogleMock,
  signOutOperatorMock,
  subscribeToFirebaseLiveVenueStateMock,
  subscribeToOperatorSessionMock,
} = vi.hoisted(() => ({
  getFirebaseLiveVenueStateSnapshotMock: vi.fn(),
  getOperatorIdTokenMock: vi.fn(),
  setFirebaseLiveVenueStateMock: vi.fn(),
  signInOperatorMock: vi.fn(),
  signInOperatorWithGoogleMock: vi.fn(),
  signOutOperatorMock: vi.fn(),
  subscribeToFirebaseLiveVenueStateMock: vi.fn(),
  subscribeToOperatorSessionMock: vi.fn(),
}));

vi.mock("../api", () => ({
  getOperatorState: getOperatorStateMock,
  resetOperatorState: resetOperatorStateMock,
  syncOperatorStates: syncOperatorStatesMock,
  updateOperatorState: updateOperatorStateMock,
}));

vi.mock("../firebase", () => ({
  getFirebaseLiveVenueStateSnapshot: getFirebaseLiveVenueStateSnapshotMock,
  getOperatorIdToken: getOperatorIdTokenMock,
  hasFirebaseConfig: false,
  setFirebaseLiveVenueState: setFirebaseLiveVenueStateMock,
  signInOperator: signInOperatorMock,
  signInOperatorWithGoogle: signInOperatorWithGoogleMock,
  signOutOperator: signOutOperatorMock,
  subscribeToFirebaseLiveVenueState: subscribeToFirebaseLiveVenueStateMock,
  subscribeToOperatorSession: subscribeToOperatorSessionMock,
}));

import { OperatorExperience } from "./OperatorExperience";

const baseState: DestinationState = {
  crowdPenalty: 1,
  nodeId: "stall-b",
  queueMinutes: 8,
  queueTrendAfterFiveMinutes: -1,
  serviceMinutesPerAdditionalPerson: 2,
};

beforeEach(() => {
  getOperatorStateMock.mockReset();
  resetOperatorStateMock.mockReset();
  syncOperatorStatesMock.mockReset();
  updateOperatorStateMock.mockReset();

  getFirebaseLiveVenueStateSnapshotMock.mockReset();
  getOperatorIdTokenMock.mockReset();
  setFirebaseLiveVenueStateMock.mockReset();
  signInOperatorMock.mockReset();
  signInOperatorWithGoogleMock.mockReset();
  signOutOperatorMock.mockReset();
  subscribeToFirebaseLiveVenueStateMock.mockReset();
  subscribeToOperatorSessionMock.mockReset();

  subscribeToOperatorSessionMock.mockImplementation((onChange) => {
    onChange(null);
    return () => {};
  });
  subscribeToFirebaseLiveVenueStateMock.mockImplementation(() => () => {});

  getOperatorStateMock.mockResolvedValue({
    states: [baseState],
  });
  updateOperatorStateMock.mockResolvedValue({
    states: [baseState],
  });
  resetOperatorStateMock.mockResolvedValue({
    states: [baseState],
  });
});

afterEach(() => {
  cleanup();
});

describe("OperatorExperience", () => {
  it("loads local operator state when firebase config is disabled", async () => {
    render(
      <OperatorExperience
        activeIntent={null}
        onRequestRecommendation={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "stall-b" }),
    ).toBeVisible();
    expect(getOperatorStateMock).toHaveBeenCalledTimes(1);
  });

  it("applies local operator updates and requests a recommendation refresh", async () => {
    const onRequestRecommendation = vi.fn().mockResolvedValue(undefined);

    render(
      <OperatorExperience
        activeIntent="food"
        onRequestRecommendation={onRequestRecommendation}
      />,
    );

    await screen.findByRole("heading", { name: "stall-b" });
    await userEvent.click(screen.getByRole("button", { name: "Apply Change" }));

    await waitFor(() => {
      expect(updateOperatorStateMock).toHaveBeenCalledWith(
        expect.objectContaining({ nodeId: "stall-b" }),
      );
    });

    await waitFor(() => {
      expect(onRequestRecommendation).toHaveBeenCalledWith("food", {
        announceUser: false,
        assistantPrefix: "Live update:",
      });
    });
  });

  it("resets local operator state and requests a recommendation refresh", async () => {
    const onRequestRecommendation = vi.fn().mockResolvedValue(undefined);

    render(
      <OperatorExperience
        activeIntent="food"
        onRequestRecommendation={onRequestRecommendation}
      />,
    );

    await screen.findByRole("heading", { name: "stall-b" });
    await userEvent.click(
      screen.getByRole("button", { name: "Reset Live State" }),
    );

    await waitFor(() => {
      expect(resetOperatorStateMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(onRequestRecommendation).toHaveBeenCalledWith("food", {
        announceUser: false,
        assistantPrefix: "Live update:",
      });
    });
  });
});
