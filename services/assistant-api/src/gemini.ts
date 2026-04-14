import {
  type GenerateContentParameters,
  type GenerateContentResponse,
  GoogleGenAI,
  Type,
} from "@google/genai";

import type {
  AssistantRecommendation,
  RecommendationRequest,
} from "@smart-crowd-navigator/shared";

import { buildRecommendationPayload } from "./recommendation.js";

type GenerateContent = (
  params: GenerateContentParameters,
) => Promise<GenerateContentResponse>;
type ChatHistoryEntry = {
  role: "user" | "model";
  parts: Array<{
    text: string;
  }>;
};
type CreateChat = (params: {
  config: GenerateContentParameters["config"];
  history: ChatHistoryEntry[];
  model: string;
}) => {
  sendMessage: (params: {
    message: string;
  }) => Promise<GenerateContentResponse>;
};
type MapsLocationContext = {
  latitude: number;
  longitude: number;
};
type MapsGroundingPlace = {
  placeId?: string;
  title: string;
  uri: string;
};
type MapsGroundingMetadata = {
  places: MapsGroundingPlace[];
  source: "google-maps";
  widgetContextToken?: string;
};
type AssistantResponsePayload = {
  grounding?: MapsGroundingMetadata;
  message: string;
  recommendation: AssistantRecommendation;
  source: "gemini";
};

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
  const typedPayload = requestPayload as RecommendationRequest;
  const conversationHistory = typedPayload.conversationHistory
    ?.map(
      (message) =>
        `${message.role === "assistant" ? "Assistant" : "User"}: ${message.text}`,
    )
    .join("\n");
  const question = typedPayload.question?.trim();
  const structuredContext = {
    section: typedPayload.section,
    intent: typedPayload.intent,
    partySize: typedPayload.partySize,
    eventPhase: typedPayload.eventPhase,
    mobilityMode: typedPayload.mobilityMode,
  };

  return [
    ASSISTANT_PROMPT,
    "",
    "Structured attendee context:",
    JSON.stringify(structuredContext),
    question ? "" : undefined,
    question ? `Latest attendee question: ${question}` : undefined,
    conversationHistory ? "" : undefined,
    conversationHistory ? "Conversation history:" : undefined,
    conversationHistory,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildChatHistory(
  requestPayload: RecommendationRequest,
): ChatHistoryEntry[] {
  return (requestPayload.conversationHistory ?? []).map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [
      {
        text: message.text,
      },
    ],
  }));
}

function buildLatestQuestion(requestPayload: RecommendationRequest) {
  return (
    requestPayload.question?.trim() ??
    `Find the best ${requestPayload.intent} option for section ${requestPayload.section}.`
  );
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

function shouldUseMapsGrounding(requestPayload: RecommendationRequest) {
  const normalizedQuestion =
    requestPayload.question?.trim().toLowerCase() ?? "";

  if (!normalizedQuestion) {
    return false;
  }

  return [
    "parking",
    "park",
    "rideshare",
    "pickup",
    "pick-up",
    "drop off",
    "drop-off",
    "nearby",
    "near me",
    "outside",
    "around the venue",
    "landmark",
  ].some((keyword) => normalizedQuestion.includes(keyword));
}

function extractMapsGrounding(
  response: GenerateContentResponse,
): MapsGroundingMetadata | undefined {
  const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
  const groundingChunks = groundingMetadata?.groundingChunks ?? [];
  const places = groundingChunks.flatMap((chunk) => {
    if (!chunk.maps?.title || !chunk.maps.uri) {
      return [];
    }

    return [
      {
        placeId: chunk.maps.placeId,
        title: chunk.maps.title,
        uri: chunk.maps.uri,
      },
    ];
  });

  if (
    places.length === 0 &&
    !groundingMetadata?.googleMapsWidgetContextToken?.length
  ) {
    return undefined;
  }

  return {
    places,
    source: "google-maps",
    widgetContextToken: groundingMetadata?.googleMapsWidgetContextToken,
  };
}

function buildMapsGroundedPrompt(
  requestPayload: RecommendationRequest,
  recommendation: AssistantRecommendation,
) {
  return [
    "You are Smart Crowd Navigator, answering venue-perimeter questions with Google Maps grounding.",
    "Use Google Maps grounding for nearby place or perimeter claims.",
    "Do not change the deterministic indoor recommendation details provided below.",
    "Keep the response to 2 to 4 plain sentences with calm, practical wording.",
    "",
    "Deterministic indoor recommendation:",
    JSON.stringify({
      fallbackOption: recommendation.fallbackOption?.label ?? null,
      intent: recommendation.intent,
      primaryOption: recommendation.primaryOption.label,
      routeSummary: recommendation.routeSummary,
      timingDecision: recommendation.timingDecision,
      waitOrGoReason: recommendation.waitOrGoReason,
    }),
    "",
    `Attendee question: ${buildLatestQuestion(requestPayload)}`,
  ].join("\n");
}

async function runGeminiRecommendationAssistant({
  createChat,
  generateContent,
  model,
  requestPayload,
}: {
  createChat: CreateChat;
  generateContent: GenerateContent;
  model: string;
  requestPayload: unknown;
}) {
  const typedRequestPayload = requestPayload as RecommendationRequest;
  const toolConfig = { functionDeclarations: [recommendationTool] };
  const latestQuestion = buildLatestQuestion(typedRequestPayload);
  const chatHistory = buildChatHistory(typedRequestPayload);
  const chat = createChat({
    config: {
      systemInstruction: ASSISTANT_PROMPT,
      tools: [toolConfig],
    },
    history: chatHistory,
    model,
  });

  const response1 = await chat.sendMessage({
    message: latestQuestion,
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
    ...chatHistory,
    {
      role: "user" as const,
      parts: [{ text: latestQuestion }],
    },
    response1.candidates?.[0]?.content ?? { role: "model", parts: [] },
    {
      role: "user" as const,
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

async function runGeminiMapsGroundedAssistant({
  generateContent,
  mapsLocationContext,
  model,
  requestPayload,
}: {
  generateContent: GenerateContent;
  mapsLocationContext?: MapsLocationContext;
  model: string;
  requestPayload: RecommendationRequest;
}): Promise<AssistantResponsePayload> {
  const recommendation = buildRecommendationPayload(requestPayload);
  const response = await generateContent({
    model,
    contents: buildMapsGroundedPrompt(requestPayload, recommendation),
    config: {
      toolConfig: mapsLocationContext
        ? {
            retrievalConfig: {
              latLng: mapsLocationContext,
            },
          }
        : undefined,
      tools: [{ googleMaps: {} }],
    },
  });
  const fallback = buildFallbackNarration(recommendation);

  return {
    grounding: extractMapsGrounding(response),
    message: normalizeAssistantMessage(response.text, fallback),
    recommendation,
    source: "gemini",
  };
}

function createGeminiAssistantService({
  apiKey = process.env.GEMINI_API_KEY,
  mapsLocationContext = process.env.VENUE_CONTEXT_LATITUDE &&
  process.env.VENUE_CONTEXT_LONGITUDE
    ? {
        latitude: Number(process.env.VENUE_CONTEXT_LATITUDE),
        longitude: Number(process.env.VENUE_CONTEXT_LONGITUDE),
      }
    : undefined,
  model = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite-preview",
}: {
  apiKey?: string;
  mapsLocationContext?: MapsLocationContext;
  model?: string;
} = {}) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const ai = new GoogleGenAI({ apiKey });

  return {
    async generateAssistantResponse(requestPayload: unknown) {
      const typedRequestPayload = requestPayload as RecommendationRequest;

      if (shouldUseMapsGrounding(typedRequestPayload)) {
        return runGeminiMapsGroundedAssistant({
          generateContent: (params) => ai.models.generateContent(params),
          mapsLocationContext,
          model,
          requestPayload: typedRequestPayload,
        });
      }

      return runGeminiRecommendationAssistant({
        createChat: ({ config, history, model: chatModel }) =>
          ai.chats.create({
            config,
            history,
            model: chatModel,
          }),
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
  buildChatHistory,
  buildFallbackNarration,
  buildLatestQuestion,
  buildMapsGroundedPrompt,
  createGeminiAssistantService,
  extractMapsGrounding,
  normalizeAssistantMessage,
  runGeminiMapsGroundedAssistant,
  runGeminiRecommendationAssistant,
  shouldUseMapsGrounding,
};
