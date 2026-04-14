import type {
  AssistantRecommendation,
  ConversationMessage,
  CoreIntent,
} from "@smart-crowd-navigator/shared";
import type { DestinationState } from "@smart-crowd-navigator/venue-engine";

export type ChatMessage = ConversationMessage;

export interface AssistantGroundingPlace {
  placeId?: string;
  title: string;
  uri: string;
}

export interface AssistantGroundingMetadata {
  places: AssistantGroundingPlace[];
  source: "google-maps";
  widgetContextToken?: string;
}

export interface AssistantApiResponse {
  grounding?: AssistantGroundingMetadata;
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
  question?: string;
  conversationHistory?: ChatMessage[];
}

export interface OperatorStateResponse {
  states: DestinationState[];
}
