import { describe, expect, it, vi } from "vitest";

import { createGeminiModelAvailabilityService } from "./gemini-model-availability.js";
import { createGeminiModelPolicy } from "./gemini-model-policy.js";
import {
  ASSISTANT_PROMPT,
  DEFAULT_GEMINI_MODEL,
  buildAssistantPrompt,
  buildChatHistory,
  buildLatestQuestion,
  buildMapsGroundedPrompt,
  extractMapsGrounding,
  getGeminiModelFallbackChain,
  isRetryableGeminiError,
  normalizeAssistantMessage,
  runGeminiAssistantWithFallbacks,
  runGeminiMapsGroundedAssistant,
  runGeminiRecommendationAssistant,
  shouldUseMapsGrounding,
} from "./gemini.js";

function buildFallbackResponse(message: string) {
  return {
    message,
    recommendation: {
      intent: "food",
      timingDecision: "go_now",
      waitOrGoReason:
        "Leaving now is still the fastest option once wait time is included.",
      primaryOption: {
        id: "stall-b",
        label: "Stall B",
        kind: "food",
      },
      primaryReason: "Best total score: 7 minutes.",
      etaMinutes: 4,
      waitMinutes: 3,
      timeSavedMinutes: 0,
      routeSummary: "Section A-12 -> Concourse East -> Stall B",
      crowdWarning: null,
      fallbackOption: null,
      decisionReasons: {
        strengths: [
          "Best overall score across the currently available options.",
          "Balances walking time, queue pressure, and reliability.",
        ],
        tradeoffs: [],
      },
      operationalAdvisory: null,
      confidence: "high",
    },
    source: "gemini" as const,
  };
}

describe("runGeminiRecommendationAssistant", () => {
  it("supports a two-turn function-calling flow", async () => {
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
    const createChat = vi.fn().mockReturnValue({
      sendMessage,
    });
    const generateContent = vi.fn().mockResolvedValueOnce({
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

    expect(createChat).toHaveBeenCalledWith({
      config: {
        systemInstruction: ASSISTANT_PROMPT,
        tools: [{ functionDeclarations: expect.any(Array) }],
      },
      history: [],
      model: "gemini-3.1-flash-lite-preview",
    });
    expect(sendMessage).toHaveBeenCalledWith({
      message: "Find the best food option for section section-a12.",
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(result.message).toContain("Stall B");
    expect(result.recommendation.primaryOption.id).toBe("stall-b");
  });

  it("falls back to the typed request payload when function-call args are invalid", async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      functionCalls: [
        {
          name: "get_recommendation_data",
          id: "call-1",
          args: {
            section: "section-a12",
            intent: "food",
            partySize: 3,
            eventPhase: "halftime",
            mobilityMode: "wheelchair",
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
    const createChat = vi.fn().mockReturnValue({
      sendMessage,
    });
    const generateContent = vi.fn().mockResolvedValueOnce({
      text: "Use Stall B in a few minutes for the best overall timing.",
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

    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(result.recommendation.intent).toBe("food");
    expect(result.recommendation.primaryOption.id).toBe("stall-b");
  });

  it("falls back to the first response text when no tool call is emitted", async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      text: "Go now to Stall B.",
      functionCalls: [],
    });
    const createChat = vi.fn().mockReturnValue({
      sendMessage,
    });
    const generateContent = vi.fn().mockResolvedValue({
      text: "Go now to Stall B.",
      functionCalls: [],
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

    expect(result.message).toContain("Stall B");
    expect(generateContent).toHaveBeenCalledTimes(0);
  });

  it("retries sendMessage when Gemini chat returns a transient error", async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("temporarily unavailable"), {
          status: 503,
        }),
      )
      .mockResolvedValueOnce({
        text: "Go now to Stall B.",
        functionCalls: [],
      });
    const createChat = vi.fn().mockReturnValue({ sendMessage });
    const generateContent = vi.fn();

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

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(result.message).toContain("Stall B");
  });

  it("retries final generateContent turn when Gemini returns a transient error", async () => {
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
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("high demand"), {
          status: 503,
        }),
      )
      .mockResolvedValueOnce({
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

    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(result.message).toContain("Stall B");
  });

  it("builds a constrained assistant prompt with style examples", () => {
    const prompt = buildAssistantPrompt({
      section: "section-a12",
      intent: "food",
      partySize: 3,
      eventPhase: "break",
      mobilityMode: "standard",
      question: "Why is that the best food option?",
      conversationHistory: [
        {
          role: "user",
          text: "Which food option is best right now?",
        },
        {
          role: "assistant",
          text: "Use Stall B. Waiting 5 minutes reduces the predicted total trip cost by 3 minutes.",
        },
      ],
    });

    expect(ASSISTANT_PROMPT).toContain("Always call get_recommendation_data");
    expect(prompt).toContain("Example style (wait)");
    expect(prompt).toContain('"intent":"food"');
    expect(prompt).toContain(
      "Latest attendee question: Why is that the best food option?",
    );
    expect(prompt).toContain("Conversation history:");
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

  it("maps shared conversation history into Gemini chat history", () => {
    expect(
      buildChatHistory({
        section: "section-a12",
        intent: "food",
        partySize: 3,
        eventPhase: "break",
        mobilityMode: "standard",
        conversationHistory: [
          {
            role: "user",
            text: "Which food option is best right now?",
          },
          {
            role: "assistant",
            text: "Use Stall B.",
          },
        ],
      }),
    ).toEqual([
      {
        role: "user",
        parts: [{ text: "Which food option is best right now?" }],
      },
      {
        role: "model",
        parts: [{ text: "Use Stall B." }],
      },
    ]);
  });

  it("prefers the typed question over the synthesized fallback message", () => {
    expect(
      buildLatestQuestion({
        section: "section-a12",
        intent: "food",
        partySize: 3,
        eventPhase: "break",
        mobilityMode: "standard",
        question: "Why is Stall B better?",
      }),
    ).toBe("Why is Stall B better?");
  });

  it("keeps 3.1 flash lite as the default and falls back to 3 flash then 2.5 flash", () => {
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-3.1-flash-lite-preview");
    expect(
      getGeminiModelFallbackChain("gemini-3.1-flash-lite-preview"),
    ).toEqual([
      "gemini-3.1-flash-lite-preview",
      "gemini-3-flash-preview",
      "gemini-2.5-flash",
    ]);
  });

  it("retries retryable Gemini availability failures on the next model", async () => {
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
      .mockResolvedValueOnce(
        buildFallbackResponse("Recovered on fallback model."),
      );

    const result = await runGeminiAssistantWithFallbacks({
      executeModel,
      primaryModel: "gemini-3.1-flash-lite-preview",
    });

    expect(executeModel.mock.calls.map(([model]) => model)).toEqual([
      "gemini-3.1-flash-lite-preview",
      "gemini-3-flash-preview",
    ]);
    expect(result.message).toBe("Recovered on fallback model.");
  });

  it("skips models currently in cooldown before making fallback attempts", async () => {
    let nowMs = 1_000;
    const availabilityService = createGeminiModelAvailabilityService({
      cooldownMs: 60_000,
      now: () => nowMs,
    });

    availabilityService.markModelFailure(
      "gemini-3.1-flash-lite-preview",
      Object.assign(new Error("temporarily unavailable"), {
        status: 503,
      }),
    );

    const executeModel = vi
      .fn()
      .mockResolvedValue(buildFallbackResponse("Recovered on second model."));

    const result = await runGeminiAssistantWithFallbacks({
      availabilityService,
      executeModel,
      primaryModel: "gemini-3.1-flash-lite-preview",
    });

    expect(executeModel.mock.calls.map(([model]) => model)).toEqual([
      "gemini-3-flash-preview",
    ]);
    expect(result.message).toBe("Recovered on second model.");

    nowMs += 61_000;

    expect(
      availabilityService.selectFirstAvailableModel([
        "gemini-3.1-flash-lite-preview",
        "gemini-3-flash-preview",
      ]),
    ).toBe("gemini-3.1-flash-lite-preview");
  });

  it("continues to fallback when the current model becomes terminally unavailable", async () => {
    const availabilityService = createGeminiModelAvailabilityService();
    const executeModel = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("Model not found for API version"), {
          status: 404,
        }),
      )
      .mockResolvedValueOnce(
        buildFallbackResponse("Recovered after terminal model failure."),
      );

    const result = await runGeminiAssistantWithFallbacks({
      availabilityService,
      executeModel,
      primaryModel: "gemini-3.1-flash-lite-preview",
    });

    expect(executeModel.mock.calls.map(([model]) => model)).toEqual([
      "gemini-3.1-flash-lite-preview",
      "gemini-3-flash-preview",
    ]);
    expect(
      availabilityService.getModelHealth("gemini-3.1-flash-lite-preview")
        .status,
    ).toBe("terminal");
    expect(result.message).toBe("Recovered after terminal model failure.");
  });

  it("allows one sticky retry per turn and retries again on the next turn", async () => {
    const availabilityService = createGeminiModelAvailabilityService();

    const firstExecution = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("temporarily unavailable"), {
          status: 503,
        }),
      )
      .mockRejectedValueOnce(
        Object.assign(new Error("Model not found for API version"), {
          status: 404,
        }),
      )
      .mockResolvedValueOnce(
        buildFallbackResponse("Recovered on tertiary fallback model."),
      );

    const firstResult = await runGeminiAssistantWithFallbacks({
      availabilityService,
      executeModel: firstExecution,
      primaryModel: "gemini-3.1-flash-lite-preview",
    });

    expect(firstExecution.mock.calls.map(([model]) => model)).toEqual([
      "gemini-3.1-flash-lite-preview",
      "gemini-3-flash-preview",
      "gemini-2.5-flash",
    ]);
    expect(firstResult.message).toBe("Recovered on tertiary fallback model.");
    expect(
      availabilityService.getModelHealth("gemini-3.1-flash-lite-preview")
        .status,
    ).toBe("sticky_retry");
    expect(
      availabilityService.getModelHealth("gemini-3-flash-preview").status,
    ).toBe("terminal");

    const secondExecution = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("temporarily unavailable"), {
          status: 503,
        }),
      )
      .mockResolvedValueOnce(
        buildFallbackResponse("Second turn fell back after sticky attempt."),
      );

    const secondResult = await runGeminiAssistantWithFallbacks({
      availabilityService,
      executeModel: secondExecution,
      primaryModel: "gemini-3.1-flash-lite-preview",
    });

    expect(secondExecution.mock.calls.map(([model]) => model)).toEqual([
      "gemini-3.1-flash-lite-preview",
      "gemini-2.5-flash",
    ]);
    expect(secondResult.message).toBe(
      "Second turn fell back after sticky attempt.",
    );
    expect(
      availabilityService.getModelHealth("gemini-3.1-flash-lite-preview")
        .stickyAttemptConsumed,
    ).toBe(true);

    const thirdExecution = vi
      .fn()
      .mockResolvedValue(buildFallbackResponse("Primary model recovered."));

    const thirdResult = await runGeminiAssistantWithFallbacks({
      availabilityService,
      executeModel: thirdExecution,
      primaryModel: "gemini-3.1-flash-lite-preview",
    });

    expect(thirdExecution.mock.calls.map(([model]) => model)).toEqual([
      "gemini-3.1-flash-lite-preview",
    ]);
    expect(thirdResult.message).toBe("Primary model recovered.");
  });

  it("does not retry non-retryable Gemini errors", async () => {
    const executeModel = vi
      .fn()
      .mockRejectedValue(new Error("Invalid API key"));

    await expect(
      runGeminiAssistantWithFallbacks({
        executeModel,
        primaryModel: "gemini-3.1-flash-lite-preview",
      }),
    ).rejects.toThrow("Invalid API key");

    expect(executeModel).toHaveBeenCalledTimes(1);
  });

  it("uses policy actions and transitions for unknown fallback failures", async () => {
    const availabilityService = createGeminiModelAvailabilityService();
    const executeModel = vi
      .fn()
      .mockRejectedValueOnce(new Error("opaque provider glitch"))
      .mockResolvedValueOnce(
        buildFallbackResponse("Recovered using policy override."),
      );

    const result = await runGeminiAssistantWithFallbacks({
      availabilityService,
      executeModel,
      modelPolicyChain: [
        createGeminiModelPolicy({
          actions: {
            unknown: "silent",
          },
          model: "gemini-3.1-flash-lite-preview",
          stateTransitions: {
            unknown: "terminal",
          },
        }),
        createGeminiModelPolicy({
          model: "gemini-3-flash-preview",
        }),
        createGeminiModelPolicy({
          isLastResort: true,
          model: "gemini-2.5-flash",
        }),
      ],
      primaryModel: "gemini-3.1-flash-lite-preview",
    });

    expect(executeModel.mock.calls.map(([model]) => model)).toEqual([
      "gemini-3.1-flash-lite-preview",
      "gemini-3-flash-preview",
    ]);
    expect(
      availabilityService.getModelHealth("gemini-3.1-flash-lite-preview")
        .status,
    ).toBe("terminal");
    expect(result.message).toBe("Recovered using policy override.");
  });

  it("recognizes retryable provider pressure signals", () => {
    expect(
      isRetryableGeminiError(
        Object.assign(new Error("UNAVAILABLE"), {
          status: 503,
        }),
      ),
    ).toBe(true);
    expect(isRetryableGeminiError(new Error("Invalid API key"))).toBe(false);
  });

  it("detects venue-perimeter questions that should use Google Maps grounding", () => {
    expect(
      shouldUseMapsGrounding({
        section: "section-a12",
        intent: "exit",
        partySize: 3,
        eventPhase: "post-event",
        mobilityMode: "standard",
        question: "Where is the best rideshare pickup near the south exit?",
      }),
    ).toBe(true);
  });

  it("extracts Google Maps grounding metadata from Gemini responses", () => {
    expect(
      extractMapsGrounding({
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
      } as never),
    ).toEqual({
      places: [
        {
          placeId: "places/demo-place",
          title: "Demo Pickup Zone",
          uri: "https://maps.google.com/?cid=demo",
        },
      ],
      source: "google-maps",
      widgetContextToken: "widget-token",
    });
  });

  it("returns a maps-grounded hybrid response for venue-adjacent questions", async () => {
    const generateContent = vi.fn().mockResolvedValue({
      candidates: [
        {
          groundingMetadata: {
            groundingChunks: [
              {
                maps: {
                  title: "Demo Pickup Zone",
                  uri: "https://maps.google.com/?cid=demo",
                },
              },
            ],
          },
        },
      ],
      text: "Use Exit South, then head to the nearby Demo Pickup Zone for the clearest rideshare pickup.",
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
        question: "Where is the best rideshare pickup near the south exit?",
      },
    });

    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          tools: [{ googleMaps: { enableWidget: true } }],
        }),
      }),
    );
    expect(result.grounding?.places[0]?.title).toBe("Demo Pickup Zone");
    expect(result.message).toContain("Demo Pickup Zone");
    expect(result.recommendation.intent).toBe("exit");
  });

  it("builds a hybrid maps-grounding prompt around the deterministic recommendation", () => {
    const prompt = buildMapsGroundedPrompt(
      {
        section: "section-a12",
        intent: "exit",
        partySize: 3,
        eventPhase: "post-event",
        mobilityMode: "standard",
        question: "Where is the best rideshare pickup near the south exit?",
      },
      {
        intent: "exit",
        timingDecision: "go_now",
        waitOrGoReason:
          "Leaving now is still the fastest option once wait time is included.",
        primaryOption: {
          id: "exit-south",
          label: "Exit South",
          kind: "exit",
        },
        primaryReason: "Best total score: 6 minutes.",
        etaMinutes: 3,
        waitMinutes: 3,
        timeSavedMinutes: 0,
        routeSummary: "Section A-12 → South Hall → Exit South",
        crowdWarning: null,
        fallbackOption: null,
        decisionReasons: {
          strengths: [
            "Best overall score across the currently available options.",
            "Balances walking time, queue pressure, and reliability.",
          ],
          tradeoffs: [],
        },
        operationalAdvisory: null,
        confidence: "high",
      },
    );

    expect(prompt).toContain("Google Maps grounding");
    expect(prompt).toContain("Exit South");
    expect(prompt).toContain("rideshare pickup");
  });
});
