import { describe, expect, it, vi } from "vitest";

import { runGeminiRecommendationAssistant } from "./gemini.js";

describe("runGeminiRecommendationAssistant", () => {
  it("supports a two-turn function-calling flow", async () => {
    const generateContent = vi
      .fn()
      .mockResolvedValueOnce({
        functionCalls: [
          {
            name: "get_recommendation_data",
            id: "call-1",
            args: {
              section: "section-a12",
              intent: "food",
              partySize: 3,
              eventPhase: "break",
              mobilityMode: "standard",
            },
          },
        ],
        candidates: [
          {
            content: {
              role: "model",
              parts: [],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        text: "Wait five minutes, then head to Stall B.",
      });

    const result = await runGeminiRecommendationAssistant({
      generateContent,
      model: "gemini-3.1-flash-lite-preview",
      requestPayload: {
        section: "section-a12",
        intent: "food",
        partySize: 3,
        eventPhase: "break",
        mobilityMode: "standard",
      },
    });

    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(result.message).toContain("Stall B");
    expect(result.recommendation.primaryOption.id).toBe("stall-b");
  });

  it("falls back to the first response text when no tool call is emitted", async () => {
    const generateContent = vi.fn().mockResolvedValue({
      text: "Go now to Stall B.",
      functionCalls: [],
    });

    const result = await runGeminiRecommendationAssistant({
      generateContent,
      model: "gemini-3.1-flash-lite-preview",
      requestPayload: {
        section: "section-a12",
        intent: "food",
        partySize: 3,
        eventPhase: "break",
        mobilityMode: "standard",
      },
    });

    expect(result.message).toContain("Stall B");
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
