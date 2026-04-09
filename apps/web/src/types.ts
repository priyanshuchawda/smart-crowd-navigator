import type {
  AssistantRecommendation,
  CoreIntent,
} from "@smart-crowd-navigator/shared";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface AssistantApiResponse {
  message: string;
  recommendation: AssistantRecommendation;
}

export interface RecommendationRequestInput {
  section: string;
  intent: CoreIntent;
  partySize: number;
  eventPhase: "pre-event" | "in-play" | "break" | "post-event";
  mobilityMode: "standard" | "accessible";
}
