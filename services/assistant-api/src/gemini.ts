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

const ASSISTANT_PROMPT = [
  "You are Smart Crowd Navigator, a stadium movement assistant.",
  "Always call get_recommendation_data before answering.",
  "Do not invent routes, queue times, crowd levels, or timing advice.",
  "Use only the tool result as the source of truth.",
  "Respond in 2 to 4 plain sentences.",
  "Do not use markdown, bullet lists, JSON, or code formatting.",
  "Always state one primary action, include wait/go guidance, and keep the tone calm and practical.",
  "",
  "Example style (wait): Wait 5 minutes, then head to Stall B via the East Concourse. This saves about 3 minutes overall and avoids the current rush near your section.",
  "Example style (go now): Go now to Exit South. It is currently the quickest route out with less crowd pressure than Exit North.",
].join("\n");

function buildAssistantPrompt(requestPayload: unknown) {
  return `${ASSISTANT_PROMPT}\n\nAttendee request:\n${JSON.stringify(requestPayload)}`;
}

function buildFallbackNarration(recommendation: AssistantRecommendation) {
  const action =
    recommendation.timingDecision === "wait"
      ? `Wait ${recommendation.timeSavedMinutes > 0 ? 5 : 0} minutes before heading to`
      : "Go now to";

  return `${action} ${recommendation.primaryOption.label}. ${recommendation.waitOrGoReason}`;
}

function normalizeAssistantMessage(
  message: string | undefined,
  fallback: string,
) {
  if (!message || message.trim().length === 0) {
    return fallback;
  }

  const normalized = message.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();

  return normalized.length > 400
    ? `${normalized.slice(0, 397)}...`
    : normalized;
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
  const prompt = buildAssistantPrompt(requestPayload);

  const response1 = await generateContent({
    model,
    contents: prompt,
    config: {
      tools: [toolConfig],
    },
  });

  const functionCall = response1.functionCalls?.[0];
  const recommendation = buildRecommendationPayload(
    functionCall?.args ?? requestPayload,
  );

  if (!functionCall) {
    const fallback = buildFallbackNarration(recommendation);
    return {
      message: normalizeAssistantMessage(response1.text, fallback),
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
      parts: [{ text: prompt }],
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

  const fallback = buildFallbackNarration(recommendation);

  return {
    message: normalizeAssistantMessage(response2.text, fallback),
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
  ASSISTANT_PROMPT,
  buildAssistantPrompt,
  buildFallbackNarration,
  createGeminiAssistantService,
  normalizeAssistantMessage,
  runGeminiRecommendationAssistant,
};
