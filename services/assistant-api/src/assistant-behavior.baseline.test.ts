import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import {
  runGeminiAssistantWithFallbacks,
  runGeminiMapsGroundedAssistant,
  runGeminiRecommendationAssistant,
} from "./gemini.js";
import { buildRecommendationPayload } from "./recommendation.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const baselineDir = resolve(currentDir, "behavior-baselines");
const shouldUpdateBaselines =
  process.env.UPDATE_ASSISTANT_BEHAVIOR_BASELINES === "true";

async function expectBehaviorBaseline(name: string, payload: unknown) {
  const baselinePath = resolve(baselineDir, `${name}.json`);
  const normalizedPayload = `${JSON.stringify(payload, null, 2)}\n`;

  if (shouldUpdateBaselines) {
    await mkdir(baselineDir, { recursive: true });
    await writeFile(baselinePath, normalizedPayload, "utf8");
  }

  let expectedPayload: string;

  try {
    expectedPayload = await readFile(baselinePath, "utf8");
  } catch (error) {
    const typedError = error as NodeJS.ErrnoException;

    if (typedError.code === "ENOENT") {
      throw new Error(
        `Missing behavior baseline at ${baselinePath}. Run test:behavior:update-baselines to create it.`,
      );
    }

    throw error;
  }

  expect(normalizedPayload).toBe(expectedPayload);
}

describe("assistant behavior baselines", () => {
  it("captures two-turn function-calling recommendation behavior", async () => {
    const sendMessage = vi.fn().mockResolvedValue({
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
    });
    const createChat = vi.fn().mockReturnValue({ sendMessage });
    const generateContent = vi.fn().mockResolvedValue({
      text: "Wait five minutes, then head to Stall B.",
    });

    const result = await runGeminiRecommendationAssistant({
      createChat,
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

    await expectBehaviorBaseline("two-turn-function-call", {
      message: result.message,
      primaryOptionId: result.recommendation.primaryOption.id,
      routeSummary: result.recommendation.routeSummary,
      source: result.source,
      timingDecision: result.recommendation.timingDecision,
    });
  });

  it("captures maps-grounded assistant behavior envelope", async () => {
    const generateContent = vi.fn().mockResolvedValue({
      candidates: [
        {
          groundingMetadata: {
            googleMapsWidgetContextToken: "widget-token",
            groundingChunks: [
              {
                maps: {
                  placeId: "places/demo-place",
                  title: "Demo Pickup Zone",
                  uri: "https://maps.google.com/?cid=demo",
                },
              },
            ],
          },
        },
      ],
      text: "Use Exit South, then head to Demo Pickup Zone for a smoother pickup.",
    });

    const result = await runGeminiMapsGroundedAssistant({
      generateContent,
      mapsLocationContext: {
        latitude: 37.402,
        longitude: -122.077,
      },
      model: "gemini-3.1-flash-lite-preview",
      requestPayload: {
        section: "section-a12",
        intent: "exit",
        partySize: 3,
        eventPhase: "post-event",
        mobilityMode: "standard",
        question: "Where is the best rideshare pickup outside the venue?",
      },
    });

    await expectBehaviorBaseline("maps-grounding-envelope", {
      grounding: result.grounding,
      message: result.message,
      source: result.source,
    });
  });

  it("captures model fallback retry behavior", async () => {
    const fallbackRecommendation = buildRecommendationPayload({
      section: "section-a12",
      intent: "food",
      partySize: 3,
      eventPhase: "break",
      mobilityMode: "standard",
    });

    const executeModel = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(
          new Error("This model is currently experiencing high demand."),
          {
            status: 503,
          },
        ),
      )
      .mockResolvedValueOnce({
        message: "Recovered on fallback model.",
        recommendation: fallbackRecommendation,
        source: "gemini" as const,
      });

    const result = await runGeminiAssistantWithFallbacks({
      executeModel,
      primaryModel: "gemini-3.1-flash-lite-preview",
    });

    await expectBehaviorBaseline("fallback-chain-retry", {
      attemptedModels: executeModel.mock.calls.map(([model]) => model),
      message: result.message,
      primaryOptionId: result.recommendation.primaryOption.id,
      source: result.source,
    });
  });
});
