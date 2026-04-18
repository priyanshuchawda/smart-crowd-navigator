import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";

import { assistantRecommendationSchema } from "@smart-crowd-navigator/shared";

import { createGeminiAssistantService } from "./gemini.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(currentDir, "../../../.env") });

const maybeDescribe = process.env.GEMINI_API_KEY ? describe : describe.skip;

maybeDescribe("real Gemini boundary smoke", () => {
  it("returns a real recommendation for multiple realistic scenarios", async () => {
    const service = createGeminiAssistantService();
    const scenarios = [
      {
        section: "section-a12",
        intent: "food",
        partySize: 4,
        eventPhase: "break",
        mobilityMode: "standard",
      },
      {
        section: "section-c04",
        intent: "washroom",
        partySize: 1,
        eventPhase: "in-play",
        mobilityMode: "standard",
      },
      {
        section: "section-a12",
        intent: "exit",
        partySize: 2,
        eventPhase: "post-event",
        mobilityMode: "accessible",
      },
    ] as const;

    for (const scenario of scenarios) {
      const result = await service.generateAssistantResponse(scenario);

      expect(result.source).toBe("gemini");
      expect(result.message.length).toBeGreaterThan(20);
      expect(
        assistantRecommendationSchema.safeParse(result.recommendation).success,
      ).toBe(true);
      expect(result.recommendation.intent).toBe(scenario.intent);
    }
  }, 300_000);

  it("supports multi-turn follow-up requests with conversation history", async () => {
    const service = createGeminiAssistantService();
    const firstQuestion = "Should we go now for food from section A-12?";
    const firstTurn = await service.generateAssistantResponse({
      section: "section-a12",
      intent: "food",
      partySize: 3,
      eventPhase: "break",
      mobilityMode: "standard",
      question: firstQuestion,
    });

    expect(firstTurn.source).toBe("gemini");
    expect(firstTurn.message.length).toBeGreaterThan(20);

    const secondTurn = await service.generateAssistantResponse({
      section: "section-a12",
      intent: "food",
      partySize: 3,
      eventPhase: "break",
      mobilityMode: "standard",
      question: "What is the backup option if that area suddenly crowds up?",
      conversationHistory: [
        {
          role: "user",
          text: firstQuestion,
        },
        {
          role: "assistant",
          text: firstTurn.message,
        },
      ],
    });

    expect(secondTurn.source).toBe("gemini");
    expect(secondTurn.message.length).toBeGreaterThan(20);
    expect(
      assistantRecommendationSchema.safeParse(secondTurn.recommendation)
        .success,
    ).toBe(true);
    expect(secondTurn.recommendation.intent).toBe("food");
  }, 300_000);

  it("handles a maps-grounded venue-perimeter question", async () => {
    const service = createGeminiAssistantService();
    const result = await service.generateAssistantResponse({
      section: "section-a12",
      intent: "exit",
      partySize: 2,
      eventPhase: "post-event",
      mobilityMode: "standard",
      question:
        "Where is the best rideshare pickup outside the venue near the south exit?",
    });

    expect(result.source).toBe("gemini");
    expect(result.message.length).toBeGreaterThan(20);
    expect(result.recommendation.intent).toBe("exit");

    if (result.grounding) {
      expect(result.grounding.source).toBe("google-maps");
      expect(Array.isArray(result.grounding.places)).toBe(true);
    }
  }, 300_000);
});
