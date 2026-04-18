import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./OperatorExperience", () => ({
  OperatorExperience: ({
    activeIntent,
    onRequestRecommendation,
  }: {
    activeIntent: string | null;
    onRequestRecommendation: (intent: "food") => Promise<void>;
  }) => (
    <section aria-label="Operator console">
      <p>Mock Operator Experience</p>
      <p>Active intent: {activeIntent ?? "none"}</p>
      <button
        type="button"
        onClick={() => {
          void onRequestRecommendation("food");
        }}
      >
        Trigger recommendation refresh
      </button>
    </section>
  ),
}));

import { DeferredOperatorExperience } from "./DeferredOperatorExperience";

afterEach(() => {
  cleanup();
});

describe("DeferredOperatorExperience", () => {
  it("keeps operator module deferred until disclosure opens", () => {
    render(
      <DeferredOperatorExperience
        activeIntent={null}
        onRequestRecommendation={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText("Demo Controls")).toBeVisible();
    expect(screen.queryByText("Mock Operator Experience")).not.toBeInTheDocument();
  });

  it("loads deferred operator module on open and forwards callback", async () => {
    const onRequestRecommendation = vi.fn().mockResolvedValue(undefined);

    render(
      <DeferredOperatorExperience
        activeIntent="exit"
        onRequestRecommendation={onRequestRecommendation}
      />,
    );

    await userEvent.click(screen.getByText("Demo Controls"));

    expect(await screen.findByText("Mock Operator Experience")).toBeVisible();
    expect(screen.getByText("Active intent: exit")).toBeVisible();

    await userEvent.click(
      screen.getByRole("button", {
        name: "Trigger recommendation refresh",
      }),
    );

    await waitFor(() => {
      expect(onRequestRecommendation).toHaveBeenCalledWith("food");
    });
  });
});
