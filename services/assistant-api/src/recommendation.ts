import {
  type AssistantRecommendation,
  assistantRecommendationSchema,
  recommendationRequestSchema,
} from "@smart-crowd-navigator/shared";
import {
  type DestinationState,
  type VenueFixture,
  createVenueEngine,
} from "@smart-crowd-navigator/venue-engine";

const engine = createVenueEngine();
let liveDestinationStates: DestinationState[] =
  engine.fixture.destinationStates.map((state) => ({ ...state }));

function getLiveFixture(): VenueFixture {
  return {
    ...engine.fixture,
    destinationStates: liveDestinationStates.map((state) => ({ ...state })),
  };
}

function describeRoute(nodeIds: string[]) {
  return nodeIds
    .map(
      (nodeId) =>
        engine.fixture.nodes.find((node) => node.id === nodeId)?.label ??
        nodeId,
    )
    .join(" → ");
}

function buildRecommendationPayload(
  requestBody: unknown,
): AssistantRecommendation {
  const input = recommendationRequestSchema.parse(requestBody);
  const engineInput = {
    sectionId: input.section,
    intent: input.intent,
    eventPhase: input.eventPhase,
    mobilityMode: input.mobilityMode,
  };
  const fixture = getLiveFixture();
  const currentBest = engine.rankDestinations(engineInput, fixture)[0];
  const fallback = engine.getFallbackDestination(engineInput, fixture);
  const timingAdvice = engine.getTimingAdvice(engineInput, fixture);
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

function buildDeterministicAssistantResponse(requestBody: unknown) {
  const recommendation = buildRecommendationPayload(requestBody);

  return {
    message: `Use ${recommendation.primaryOption.label}. ${recommendation.waitOrGoReason}`,
    recommendation,
  };
}

function getOperatorState() {
  return liveDestinationStates.map((state) => ({ ...state }));
}

function updateOperatorState(nextState: DestinationState) {
  liveDestinationStates = liveDestinationStates.map((state) =>
    state.nodeId === nextState.nodeId ? { ...nextState } : state,
  );

  return getOperatorState();
}

function resetOperatorState() {
  liveDestinationStates = engine.fixture.destinationStates.map((state) => ({
    ...state,
  }));

  return getOperatorState();
}

export {
  buildDeterministicAssistantResponse,
  buildRecommendationPayload,
  engine,
  getOperatorState,
  resetOperatorState,
  updateOperatorState,
};
