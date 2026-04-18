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
  hasFirebaseConfig: true,
  setFirebaseLiveVenueState: setFirebaseLiveVenueStateMock,
  signInOperator: signInOperatorMock,
  signInOperatorWithGoogle: signInOperatorWithGoogleMock,
  signOutOperator: signOutOperatorMock,
  subscribeToFirebaseLiveVenueState: subscribeToFirebaseLiveVenueStateMock,
  subscribeToOperatorSession: subscribeToOperatorSessionMock,
}));

import { OperatorExperience } from "./OperatorExperience";

const OPERATOR_EXPERIENCE_TIMEOUT_MS = 20_000;

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

  getFirebaseLiveVenueStateSnapshotMock.mockResolvedValue({
    source: "firebase-live",
    states: [baseState],
    updatedAt: "now",
    updatedBy: "operator-1",
    venueId: "demoVenue",
  });
  getOperatorIdTokenMock.mockResolvedValue("id-token");
  getOperatorStateMock.mockResolvedValue({
    states: [baseState],
  });
  updateOperatorStateMock.mockResolvedValue({
    states: [baseState],
  });
  resetOperatorStateMock.mockResolvedValue({
    states: [baseState],
  });
  syncOperatorStatesMock.mockResolvedValue(undefined);
  setFirebaseLiveVenueStateMock.mockResolvedValue(undefined);
  signInOperatorMock.mockResolvedValue(undefined);
  signInOperatorWithGoogleMock.mockResolvedValue(undefined);
  signOutOperatorMock.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe("OperatorExperience with Firebase configured", () => {
  it(
    "shows operator access and surfaces sign-in errors",
    async () => {
      signInOperatorMock.mockRejectedValueOnce(new Error("Auth failed"));
      signInOperatorWithGoogleMock.mockRejectedValueOnce(
        new Error("Google failed"),
      );

      render(
        <OperatorExperience
          activeIntent={null}
          onRequestRecommendation={vi.fn().mockResolvedValue(undefined)}
        />,
      );

      await screen.findByRole("region", { name: /Operator access/i });

      await userEvent.type(
        screen.getByLabelText("Email"),
        " operator@example.com ",
      );
      await userEvent.type(screen.getByLabelText("Password"), "secret");
      await userEvent.click(
        screen.getByRole("button", { name: "Sign In as Operator" }),
      );

      await waitFor(() => {
        expect(signInOperatorMock).toHaveBeenCalledWith(
          "operator@example.com",
          "secret",
        );
      });
      expect(await screen.findByText("Auth failed")).toBeVisible();

      await userEvent.click(
        screen.getByRole("button", { name: "Sign in with Google" }),
      );
      await waitFor(() => {
        expect(signInOperatorWithGoogleMock).toHaveBeenCalledTimes(1);
      });
      expect(await screen.findByText("Google failed")).toBeVisible();
    },
    OPERATOR_EXPERIENCE_TIMEOUT_MS,
  );

  it(
    "syncs and applies firebase-backed operator updates",
    async () => {
      subscribeToOperatorSessionMock.mockImplementation((onChange) => {
        onChange({
          email: "operator@example.com",
          uid: "operator-1",
        });
        return () => {};
      });

      render(
        <OperatorExperience
          activeIntent={null}
          onRequestRecommendation={vi.fn().mockResolvedValue(undefined)}
        />,
      );

      await screen.findByRole("heading", { name: "stall-b" });

      await waitFor(() => {
        expect(syncOperatorStatesMock).toHaveBeenCalledWith(
          [baseState],
          "id-token",
        );
      });

      await userEvent.click(
        screen.getByRole("button", { name: "Apply Change" }),
      );

      await waitFor(() => {
        expect(setFirebaseLiveVenueStateMock).toHaveBeenCalledWith(
          [baseState],
          {
            updatedBy: "operator-1",
          },
        );
      });

      await userEvent.click(screen.getByRole("button", { name: "Sign Out" }));
      await waitFor(() => {
        expect(signOutOperatorMock).toHaveBeenCalledTimes(1);
      });
    },
    OPERATOR_EXPERIENCE_TIMEOUT_MS,
  );

  it(
    "shows an explicit reset error when operator token is unavailable",
    async () => {
      subscribeToOperatorSessionMock.mockImplementation((onChange) => {
        onChange({
          email: "operator@example.com",
          uid: "operator-1",
        });
        return () => {};
      });
      getOperatorIdTokenMock.mockResolvedValue(null);

      render(
        <OperatorExperience
          activeIntent={null}
          onRequestRecommendation={vi.fn().mockResolvedValue(undefined)}
        />,
      );

      await screen.findByRole("heading", { name: "stall-b" });
      await userEvent.click(
        screen.getByRole("button", { name: "Reset Live State" }),
      );

      expect(
        await screen.findByText(
          "Sign in as an operator before resetting live state.",
        ),
      ).toBeVisible();
    },
    OPERATOR_EXPERIENCE_TIMEOUT_MS,
  );
});
