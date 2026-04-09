import { z } from "zod";

import {
  CONFIDENCE_LEVELS,
  CORE_INTENTS,
  EVENT_PHASES,
  MOBILITY_MODES,
  TIMING_DECISIONS,
} from "./constants.js";

export const coreIntentSchema = z.enum(CORE_INTENTS);
export const eventPhaseSchema = z.enum(EVENT_PHASES);
export const mobilityModeSchema = z.enum(MOBILITY_MODES);
export const timingDecisionSchema = z.enum(TIMING_DECISIONS);
export const confidenceLevelSchema = z.enum(CONFIDENCE_LEVELS);

export const destinationOptionSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: coreIntentSchema,
  sectionHint: z.string().min(1).optional(),
});

export const recommendationRequestSchema = z.strictObject({
  section: z.string().min(1),
  intent: coreIntentSchema,
  partySize: z.number().int().positive().max(12),
  seatRow: z.string().min(1).optional(),
  eventPhase: eventPhaseSchema,
  mobilityMode: mobilityModeSchema.default("standard"),
});

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

export type CoreIntent = z.infer<typeof coreIntentSchema>;
export type EventPhase = z.infer<typeof eventPhaseSchema>;
export type MobilityMode = z.infer<typeof mobilityModeSchema>;
export type TimingDecision = z.infer<typeof timingDecisionSchema>;
export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;
export type DestinationOption = z.infer<typeof destinationOptionSchema>;
export type RecommendationRequest = z.infer<typeof recommendationRequestSchema>;
export type AssistantRecommendation = z.infer<
  typeof assistantRecommendationSchema
>;
