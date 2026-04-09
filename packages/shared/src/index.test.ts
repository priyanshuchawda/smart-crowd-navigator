import { describe, expect, it } from "vitest";

import {
  APP_NAME,
  CORE_INTENTS,
  assistantRecommendationSchema,
  recommendationRequestSchema,
} from "./index";

describe("shared exports", () => {
  it("exposes the app name and supported intents", () => {
    expect(APP_NAME).toBe("Smart Crowd Navigator");
    expect(CORE_INTENTS).toContain("food");
  });

  it("validates a recommendation request payload", () => {
    const result = recommendationRequestSchema.safeParse({
      section: "A-12",
      intent: "food",
      partySize: 3,
      eventPhase: "break",
      mobilityMode: "standard",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid recommendation payload", () => {
    const result = assistantRecommendationSchema.safeParse({
      intent: "parking",
      timingDecision: "go_now",
      waitOrGoReason: "Leave now",
      primaryOption: {
        id: "stall-b",
        label: "Stall B",
        kind: "food",
      },
      primaryReason: "Shortest total trip",
      etaMinutes: 4,
      waitMinutes: 2,
      timeSavedMinutes: 6,
      routeSummary: "Head left on the concourse",
      crowdWarning: null,
      fallbackOption: null,
      confidence: "high",
    });

    expect(result.success).toBe(false);
  });
});
