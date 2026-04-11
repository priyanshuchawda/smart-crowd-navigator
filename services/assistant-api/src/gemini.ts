import {
  type GenerateContentParameters,
  type GenerateContentResponse,
  GoogleGenAI,
  Type,
} from "@google/genai";

import type { AssistantRecommendation } from "@smart-crowd-navigator/shared";

import { buildRecommendationPayload } from "./recommendation.js";

type GenerateContent = (
  params: GenerateContentParameters,
) => Promise<GenerateContentResponse>;

function buildFallbackNarration(recommendation: AssistantRecommendation) {
  const action =
    recommendation.timingDecision === "wait"
      ? `Wait ${recommendation.timeSavedMinutes > 0 ? 5 : 0} minutes before heading to`
      : "Go now to";

  return `${action} ${recommendation.primaryOption.label}. ${recommendation.waitOrGoReason}`;
}

const recommendationTool = {
  name: "get_recommendation_data",
  description:
    "Returns the latest deterministic recommendation payload for a stadium attendee request.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      section: { type: Type.STRING },
      intent: { type: Type.STRING },
      partySize: { type: Type.NUMBER },
      eventPhase: { type: Type.STRING },
      mobilityMode: { type: Type.STRING },
    },
    required: ["section", "intent", "partySize", "eventPhase", "mobilityMode"],
  },
};

async function runGeminiRecommendationAssistant({
  generateContent,
  model,
  requestPayload,
}: {
  generateContent: GenerateContent;
  model: string;
  requestPayload: unknown;
}) {
  const toolConfig = { functionDeclarations: [recommendationTool] };
  const prompt =
    "You are Smart Crowd Navigator. Always call get_recommendation_data before answering. Then respond with a concise, helpful stadium assistant message.";

  const response1 = await generateContent({
    model,
    contents: `${prompt}\n\nRequest: ${JSON.stringify(requestPayload)}`,
    config: {
      tools: [toolConfig],
    },
  });

  const functionCall = response1.functionCalls?.[0];
  const recommendation = buildRecommendationPayload(
    functionCall?.args ?? requestPayload,
  );

  if (!functionCall) {
    return {
      message: response1.text ?? buildFallbackNarration(recommendation),
      recommendation,
      source: "gemini" as const,
    };
  }

  if (!functionCall.name) {
    throw new Error("Gemini returned a function call without a name");
  }

  const history = [
    {
      role: "user",
      parts: [
        { text: `${prompt}\n\nRequest: ${JSON.stringify(requestPayload)}` },
      ],
    },
    response1.candidates?.[0]?.content ?? { role: "model", parts: [] },
    {
      role: "tool",
      parts: [
        {
          functionResponse: {
            name: functionCall.name,
            id: functionCall.id,
            response: recommendation,
          },
        },
      ],
    },
  ];

  const response2 = await generateContent({
    model,
    contents: history,
    config: {
      tools: [toolConfig],
    },
  });

  return {
    message: response2.text ?? buildFallbackNarration(recommendation),
    recommendation,
    source: "gemini" as const,
  };
}

function createGeminiAssistantService({
  apiKey = process.env.GEMINI_API_KEY,
  model = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite-preview",
}: {
  apiKey?: string;
  model?: string;
} = {}) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const ai = new GoogleGenAI({ apiKey });

  return {
    async generateAssistantResponse(requestPayload: unknown) {
      return runGeminiRecommendationAssistant({
        generateContent: (params) => ai.models.generateContent(params),
        model,
        requestPayload,
      });
    },
  };
}

export {
  buildFallbackNarration,
  createGeminiAssistantService,
  runGeminiRecommendationAssistant,
};
