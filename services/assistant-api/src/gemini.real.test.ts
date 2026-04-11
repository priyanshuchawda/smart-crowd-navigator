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
});
