import { describe, expect, it, vi } from "vitest";

import {
  ASSISTANT_PROMPT,
  buildAssistantPrompt,
  buildChatHistory,
  buildLatestQuestion,
  normalizeAssistantMessage,
  runGeminiRecommendationAssistant,
} from "./gemini.js";

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
});
