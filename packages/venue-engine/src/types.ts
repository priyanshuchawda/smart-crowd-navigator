export const SUPPORTED_INTENTS = [
  "food",
  "washroom",
  "entry-gate",
  "exit",
] as const;

export const SUPPORTED_EVENT_PHASES = [
  "pre-event",
  "in-play",
  "break",
  "post-event",
] as const;

export const SUPPORTED_MOBILITY_MODES = ["standard", "accessible"] as const;

export type VenueIntent = (typeof SUPPORTED_INTENTS)[number];
export type EventPhase = (typeof SUPPORTED_EVENT_PHASES)[number];
export type MobilityMode = (typeof SUPPORTED_MOBILITY_MODES)[number];

export type VenueNodeKind =
  | "section"
  | "junction"
  | "food"
  | "washroom"
  | "entry-gate"
  | "exit";

export interface VenueNode {
  id: string;
  label: string;
  kind: VenueNodeKind;
}

export interface VenueEdge {
  from: string;
  to: string;
  minutes: number;
  accessible: boolean;
  congestionPenalty: number;
}

export interface DestinationState {
  nodeId: string;
  queueMinutes: number;
  crowdPenalty: number;
  queueTrendAfterFiveMinutes: number;
  serviceMinutesPerAdditionalPerson: number;
}

export interface VenueFixture {
  version: string;
  nodes: VenueNode[];
  edges: VenueEdge[];
  destinationStates: DestinationState[];
}

export interface RankDestinationsInput {
  sectionId: string;
  intent: VenueIntent;
  eventPhase: EventPhase;
  mobilityMode?: MobilityMode;
  partySize?: number;
}

export interface ScoreBreakdown {
  walkingMinutes: number;
  queueMinutes: number;
  partyServiceMinutes: number;
  crowdPenalty: number;
  eventPenalty: number;
  totalScore: number;
}

export interface RankedDestination {
  destinationId: string;
  label: string;
  kind: VenueIntent;
  route: string[];
  score: ScoreBreakdown;
}

export interface TimingAdviceInput extends RankDestinationsInput {
  waitWindowMinutes?: number;
}

export interface TimingAdvice {
  decision: "go_now" | "wait";
  recommendedWaitMinutes: number;
  currentBest: RankedDestination;
  projectedBest: RankedDestination;
  timeSavedMinutes: number;
  reason: string;
}
