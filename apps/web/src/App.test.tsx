import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App } from "./App";
import { ConversationPanel } from "./components/ConversationPanel";
import { RecommendationPanel } from "./components/RecommendationPanel";

describe("App", () => {
  it("renders the quick action shell", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("Smart Crowd Navigator");
    expect(markup).toContain("Food");
    expect(markup).toContain("Washroom");
    expect(markup).toContain("Entry Gate");
    expect(markup).toContain("Exit");
    expect(markup).toContain("Live assistant");
    expect(markup).toContain("Operator console");
  });

  it("renders the conversation empty state", () => {
    const markup = renderToStaticMarkup(
      <ConversationPanel errorMessage={null} isLoading={false} messages={[]} />,
    );

    expect(markup).toContain("Tap a quick action");
    expect(markup).toContain("Ready");
  });

  it("renders recommendation details when a response is available", () => {
    const markup = renderToStaticMarkup(
      <RecommendationPanel
        response={{
          message: "Wait five minutes, then head to Stall B.",
          recommendation: {
            intent: "food",
            timingDecision: "wait",
            waitOrGoReason:
              "Waiting 5 minutes reduces the predicted total trip cost by 3 minutes.",
            primaryOption: {
              id: "stall-b",
              label: "Stall B",
              kind: "food",
            },
            primaryReason: "Best total score: 7 minutes.",
            etaMinutes: 4,
            waitMinutes: 0,
            timeSavedMinutes: 3,
            routeSummary: "Section A-12 → Concourse East → Stall B",
            crowdWarning: "Crowd pressure is elevated on part of this route.",
            fallbackOption: {
              id: "stall-d",
              label: "Stall D",
              kind: "food",
            },
            confidence: "high",
          },
        }}
      />,
    );

    expect(markup).toContain("Stall B");
    expect(markup).toContain("Fallback: Stall D");
    expect(markup).toContain("Time saved");
    expect(markup).toContain("Crowd pressure is elevated");
  });
});
