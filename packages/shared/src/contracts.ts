import { z } from "zod";

import {
  CONFIDENCE_LEVELS,
  CORE_INTENTS,
  EVENT_PHASES,
  MOBILITY_MODES,
  TIMING_DECISIONS,
} from "./constants.js";

/** Canonical schema for allowed recommendation intents. */
export const coreIntentSchema = z.enum(CORE_INTENTS);
/** Allowed event phase values used by engine and API. */
export const eventPhaseSchema = z.enum(EVENT_PHASES);
/** Allowed attendee mobility modes used for routing constraints. */
export const mobilityModeSchema = z.enum(MOBILITY_MODES);
/** Allowed timing decisions emitted by recommendation responses. */
export const timingDecisionSchema = z.enum(TIMING_DECISIONS);
/** Confidence labels attached to generated recommendations. */
export const confidenceLevelSchema = z.enum(CONFIDENCE_LEVELS);

/** Destination option payload used for primary and fallback recommendations. */
export const destinationOptionSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: coreIntentSchema,
  sectionHint: z.string().min(1).optional(),
});

/** Input contract accepted by recommendation and assistant endpoints. */
export const recommendationRequestSchema = z.strictObject({
  section: z.string().min(1),
  intent: coreIntentSchema,
  partySize: z.number().int().positive().max(12),
  seatRow: z.string().min(1).optional(),
  eventPhase: eventPhaseSchema,
  mobilityMode: mobilityModeSchema.default("standard"),
});

/** Full recommendation contract returned to the web client. */
export const assistantRecommendationSchema = z.strictObject({
  intent: coreIntentSchema,
  timingDecision: timingDecisionSchema,
  waitOrGoReason: z.string().min(1),
  primaryOption: destinationOptionSchema,
  primaryReason: z.string().min(1),
  etaMinutes: z.number().int().nonnegative(),
  waitMinutes: z.number().int().nonnegative(),
  timeSavedMinutes: z.number().int().nonnegative(),
  routeSummary: z.string().min(1),
  crowdWarning: z.string().min(1).nullable(),
  fallbackOption: destinationOptionSchema.nullable(),
  confidence: confidenceLevelSchema,
});

/** Core intent type inferred from the shared schema. */
export type CoreIntent = z.infer<typeof coreIntentSchema>;
/** Event phase type inferred from the shared schema. */
export type EventPhase = z.infer<typeof eventPhaseSchema>;
/** Mobility mode type inferred from the shared schema. */
export type MobilityMode = z.infer<typeof mobilityModeSchema>;
/** Timing decision type inferred from the shared schema. */
export type TimingDecision = z.infer<typeof timingDecisionSchema>;
/** Confidence level type inferred from the shared schema. */
export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;
/** Destination option type inferred from the shared schema. */
export type DestinationOption = z.infer<typeof destinationOptionSchema>;
/** Recommendation request type inferred from the shared schema. */
export type RecommendationRequest = z.infer<typeof recommendationRequestSchema>;
/** Assistant recommendation type inferred from the shared schema. */
export type AssistantRecommendation = z.infer<
  typeof assistantRecommendationSchema
>;
