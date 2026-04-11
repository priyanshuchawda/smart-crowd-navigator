import type {
  AssistantRecommendation,
  CoreIntent,
} from "@smart-crowd-navigator/shared";
import type { DestinationState } from "@smart-crowd-navigator/venue-engine";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface AssistantApiResponse {
  message: string;
  recommendation: AssistantRecommendation;
  source?: "gemini" | "deterministic-fallback";
}

export interface RecommendationRequestInput {
  section: string;
  intent: CoreIntent;
  partySize: number;
  eventPhase: "pre-event" | "in-play" | "break" | "post-event";
  mobilityMode: "standard" | "accessible";
}

export interface OperatorStateResponse {
  states: DestinationState[];
}
