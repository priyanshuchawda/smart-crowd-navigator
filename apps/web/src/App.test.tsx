import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App } from "./App";
import { ConversationPanel } from "./components/ConversationPanel";
import { RecommendationPanel } from "./components/RecommendationPanel";

describe("App", () => {
  it("renders the quick action shell", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("Smart Crowd Navigator");
    expect(markup).toContain("Skip to main content");
    expect(markup).toContain("Food");
    expect(markup).toContain("Washroom");
    expect(markup).toContain("Entry Gate");
    expect(markup).toContain("Exit");
    expect(markup).toContain("Try the Food Demo");
    expect(markup).toContain("How It Works");
    expect(markup).toContain("Live Assistant");
    expect(markup).toContain("Demo Controls");
    expect(markup).toContain(
      "Expand only if you are operating the live venue demo.",
    );
  });

  it("renders the conversation empty state", () => {
    const markup = renderToStaticMarkup(
      <ConversationPanel errorMessage={null} isLoading={false} messages={[]} />,
    );

    expect(markup).toContain("Tap a quick action");
    expect(markup).toContain("Ready");
    expect(markup).toContain('aria-live="polite"');
  });

  it("renders conversation loading and error states", () => {
    const markup = renderToStaticMarkup(
      <ConversationPanel
        errorMessage="Request failed with status 500"
        isLoading
        messages={[]}
      />,
    );

    expect(markup).toContain("Thinking…");
    expect(markup).toContain("Request failed with status 500");
  });

  it("renders quick action buttons with aria-pressed state", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('aria-pressed="false"');
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
    expect(markup).toContain("Backup option");
    expect(markup).toContain("Stall D");
    expect(markup).toContain("Time Saved");
    expect(markup).toContain("Crowd pressure is elevated");
    expect(markup).toContain('role="alert"');
  });
});
