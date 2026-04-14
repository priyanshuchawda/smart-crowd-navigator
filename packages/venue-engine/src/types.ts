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

export const SUPPORTED_MOBILITY_MODES = [
  "standard",
  "accessible",
  "mixed",
] as const;
export const VENUE_SOURCE_KINDS = [
  "local-fixture",
  "production-config",
  "live-operations",
] as const;
export const VENUE_NODE_KINDS = [
  "section",
  "junction",
  "food",
  "washroom",
  "entry-gate",
  "exit",
] as const;
export const VENUE_PATH_TYPES = [
  "concourse",
  "stairs",
  "ramp",
  "elevator",
] as const;
export const DESTINATION_STATUS = ["open", "limited", "closed"] as const;
export const TELEMETRY_CONFIDENCE = [
  "observed",
  "estimated",
  "predicted",
] as const;

export type VenueIntent = (typeof SUPPORTED_INTENTS)[number];
export type EventPhase = (typeof SUPPORTED_EVENT_PHASES)[number];
export type MobilityMode = (typeof SUPPORTED_MOBILITY_MODES)[number];
export type VenueSourceKind = (typeof VENUE_SOURCE_KINDS)[number];
export type VenueNodeKind = (typeof VENUE_NODE_KINDS)[number];
export type VenuePathType = (typeof VENUE_PATH_TYPES)[number];
export type DestinationStatus = (typeof DESTINATION_STATUS)[number];
export type TelemetryConfidence = (typeof TELEMETRY_CONFIDENCE)[number];

export interface VenueNode {
  id: string;
  label: string;
  kind: VenueNodeKind;
  zone?: string;
}

export interface VenueEdge {
  from: string;
  to: string;
  minutes: number;
  accessible: boolean;
  congestionPenalty: number;
  pathType: VenuePathType;
}

export interface DestinationState {
  nodeId: string;
  status?: DestinationStatus;
  queueMinutes: number;
  crowdPenalty: number;
  queueTrendAfterFiveMinutes: number;
  serviceMinutesPerAdditionalPerson: number;
  telemetryConfidence?: TelemetryConfidence;
  waitTimeVariability?: number;
}

export interface VenueTopology {
  version: string;
  venueId: string;
  venueName: string;
  eventPhases: EventPhase[];
  nodes: VenueNode[];
  edges: VenueEdge[];
}

export interface VenueOperationalState {
  version: string;
  destinationStates: DestinationState[];
}

export interface VenueDataSource {
  source: VenueSourceKind;
  topology: VenueTopology;
  state: VenueOperationalState;
}

export interface VenueFixture {
  version: string;
  venueId: string;
  venueName: string;
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
  groupProfile?: {
    includesMobilityLimitedGuest?: boolean;
    keepGroupTogether?: boolean;
  };
}

export interface ScoreBreakdown {
  walkingMinutes: number;
  queueMinutes: number;
  partyServiceMinutes: number;
  crowdPenalty: number;
  eventPenalty: number;
  telemetryPenalty: number;
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
