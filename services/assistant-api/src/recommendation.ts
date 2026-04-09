import {
  assistantRecommendationSchema,
  recommendationRequestSchema,
} from "@smart-crowd-navigator/shared";
import { createVenueEngine } from "@smart-crowd-navigator/venue-engine";

const engine = createVenueEngine();

function describeRoute(nodeIds: string[]) {
  return nodeIds
    .map(
      (nodeId) =>
        engine.fixture.nodes.find((node) => node.id === nodeId)?.label ??
        nodeId,
    )
    .join(" → ");
}

function buildRecommendationPayload(requestBody: unknown) {
  const input = recommendationRequestSchema.parse(requestBody);
  const engineInput = {
    sectionId: input.section,
    intent: input.intent,
    eventPhase: input.eventPhase,
    mobilityMode: input.mobilityMode,
  };
  const currentBest = engine.rankDestinations(engineInput)[0];
  const fallback = engine.getFallbackDestination(engineInput);
  const timingAdvice = engine.getTimingAdvice(engineInput);
  const selectedDestination =
    timingAdvice.decision === "wait"
      ? timingAdvice.projectedBest
      : timingAdvice.currentBest;

  if (!currentBest) {
    throw new Error("No recommendation candidates available");
  }

  return assistantRecommendationSchema.parse({
    intent: input.intent,
    timingDecision: timingAdvice.decision,
    waitOrGoReason: timingAdvice.reason,
    primaryOption: {
      id: selectedDestination.destinationId,
      label: selectedDestination.label,
      kind: selectedDestination.kind,
    },
    primaryReason: `Best total score: ${selectedDestination.score.totalScore} minutes.`,
    etaMinutes: Math.round(selectedDestination.score.walkingMinutes),
    waitMinutes: selectedDestination.score.queueMinutes,
    timeSavedMinutes: timingAdvice.timeSavedMinutes,
    routeSummary: describeRoute(selectedDestination.route),
    crowdWarning:
      selectedDestination.score.crowdPenalty > 0
        ? "Crowd pressure is elevated on part of this route."
        : null,
    fallbackOption: fallback
      ? {
          id: fallback.destinationId,
          label: fallback.label,
          kind: fallback.kind,
        }
      : null,
    confidence: selectedDestination.score.totalScore <= 10 ? "high" : "medium",
  });
}

export { buildRecommendationPayload, engine };
