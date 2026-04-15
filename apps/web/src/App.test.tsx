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
    expect(markup).toContain("Ask the assistant");
    expect(markup).toContain("Group coordination");
    expect(markup).toContain("Venue Layout");
    expect(markup).toContain("Demo Controls");
    expect(markup).toContain(
      "Expand only if you are operating the live venue demo.",
    );
  });

  it("renders the conversation empty state", () => {
    const markup = renderToStaticMarkup(
      <ConversationPanel
        draftQuestion=""
        errorMessage={null}
        isLoading={false}
        messages={[]}
        onDraftQuestionChange={() => {}}
        onSubmitQuestion={() => {}}
      />,
    );

    expect(markup).toContain("Type a question or tap a quick action");
    expect(markup).toContain("Ready");
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("Send question");
  });

  it("renders conversation loading and error states", () => {
    const markup = renderToStaticMarkup(
      <ConversationPanel
        draftQuestion="Why is that better?"
        errorMessage="Request failed with status 500"
        isLoading
        messages={[]}
        onDraftQuestionChange={() => {}}
        onSubmitQuestion={() => {}}
      />,
    );

    expect(markup).toContain("Thinking…");
    expect(markup).toContain("Request failed with status 500");
    expect(markup).toContain("Sending…");
  });

  it("renders quick action buttons with aria-pressed state", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('aria-pressed="false"');
  });

  it("renders recommendation details when a response is available", () => {
    const markup = renderToStaticMarkup(
      <RecommendationPanel
        response={{
          grounding: {
            places: [
              {
                title: "Demo Pickup Zone",
                uri: "https://maps.google.com/?cid=demo",
              },
            ],
            source: "google-maps",
            widgetContextToken: "widget-token",
          },
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
            decisionReasons: {
              strengths: [
                "3 min shorter queue than the main fallback.",
                "Backed by high-confidence live telemetry.",
              ],
              tradeoffs: [
                "Crowd pressure remains elevated in part of this path.",
              ],
            },
            groupPlan: {
              workflowType: "runner-pickup",
              headline:
                "Send one runner while the rest of the group holds position.",
              regroupSpot: "Section A-12",
              regroupEtaMinutes: 3,
              splitRecommended: true,
              steps: [
                "Keep most of the group at Section A-12.",
                "Send one runner to Stall B.",
              ],
            },
            operationalAdvisory: {
              detail:
                "The live queue trend shows a better route outcome after a short delay, so staying put briefly is the smarter move.",
              headline: "Conditions improve if you wait.",
              recommendedAction: "Hold position and recheck before moving.",
              severity: "info",
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
    expect(markup).toContain("Google Maps grounding");
    expect(markup).toContain("Demo Pickup Zone");
    expect(markup).toContain("VITE_GOOGLE_MAPS_API_KEY");
    expect(markup).toContain("Group coordinator plan");
    expect(markup).toContain("Send one runner");
    expect(markup).toContain("Why this recommendation");
    expect(markup).toContain("Conditions improve if you wait.");
  });
});
