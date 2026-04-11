import { describe, expect, it, vi } from "vitest";

import {
  ASSISTANT_PROMPT,
  buildAssistantPrompt,
  normalizeAssistantMessage,
  runGeminiRecommendationAssistant,
} from "./gemini.js";

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

  it("builds a constrained assistant prompt with style examples", () => {
    const prompt = buildAssistantPrompt({
      section: "section-a12",
      intent: "food",
      partySize: 3,
      eventPhase: "break",
      mobilityMode: "standard",
    });

    expect(ASSISTANT_PROMPT).toContain("Always call get_recommendation_data");
    expect(prompt).toContain("Example style (wait)");
    expect(prompt).toContain('"intent":"food"');
  });

  it("normalizes markdown-heavy or empty model output", () => {
    expect(
      normalizeAssistantMessage(
        "**Go now** to Stall B.\n\nThis is the fastest option.",
        "Fallback message",
      ),
    ).toBe("Go now to Stall B. This is the fastest option.");
    expect(normalizeAssistantMessage("", "Fallback message")).toBe(
      "Fallback message",
    );
  });
});
