import {
  type AssistantRecommendation,
  assistantRecommendationSchema,
  recommendationRequestSchema,
} from "@smart-crowd-navigator/shared";
import {
  type DestinationState,
  type VenueDataSource,
  type VenueFixture,
  buildGroupCoordinatorPlan,
  createVenueEngine,
  createVenueFixtureFromDataSource,
  localDevelopmentVenueDataSource,
  replaceDestinationStates,
} from "@smart-crowd-navigator/venue-engine";

function parseRecommendationRequest(requestBody: unknown) {
  return recommendationRequestSchema.parse(requestBody);
}

function createRecommendationService({
  venueDataSource = localDevelopmentVenueDataSource,
}: {
  venueDataSource?: VenueDataSource;
} = {}) {
  const engine = createVenueEngine({
    defaultDataSource: venueDataSource,
  });
  let liveDestinationStates: DestinationState[] =
    venueDataSource.state.destinationStates.map((state) => ({ ...state }));

  function getLiveFixture(): VenueFixture {
    return createVenueFixtureFromDataSource(
      replaceDestinationStates(venueDataSource, liveDestinationStates),
    );
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
    const input = parseRecommendationRequest(requestBody);
    const engineInput = {
      sectionId: input.section,
      intent: input.intent,
      eventPhase: input.eventPhase,
      groupWorkflow: input.groupWorkflow ?? "auto",
      mobilityMode: input.mobilityMode,
      partySize: input.partySize,
    };
    const fixture = getLiveFixture();
    const currentBest = engine.rankDestinations(engineInput, fixture)[0];
    const fallback = engine.getFallbackDestination(engineInput, fixture);
    const timingAdvice = engine.getTimingAdvice(engineInput, fixture);
    const selectedDestination =
      timingAdvice.decision === "wait"
        ? timingAdvice.projectedBest
        : timingAdvice.currentBest;
    const groupPlan = buildGroupCoordinatorPlan(
      engineInput,
      selectedDestination,
      fixture,
    );

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
      groupPlan,
      confidence:
        selectedDestination.score.totalScore <= 10 ? "high" : "medium",
    });
  }

  function buildDeterministicAssistantMessage(
    requestBody: unknown,
    recommendation: AssistantRecommendation,
  ) {
    const input = parseRecommendationRequest(requestBody);
    const normalizedQuestion = input.question?.trim().toLowerCase() ?? "";

    if (
      normalizedQuestion.includes("backup") ||
      normalizedQuestion.includes("fallback")
    ) {
      if (!recommendation.fallbackOption) {
        return `Use ${recommendation.primaryOption.label}. There is no separate fallback option for this request right now. ${recommendation.waitOrGoReason}`;
      }

      return `Primary choice: ${recommendation.primaryOption.label}. Backup option: ${recommendation.fallbackOption.label}. ${recommendation.waitOrGoReason}`;
    }

    if (normalizedQuestion.includes("why")) {
      return `Use ${recommendation.primaryOption.label}. ${recommendation.primaryReason} ${recommendation.waitOrGoReason}`;
    }

    if (normalizedQuestion.includes("group") && recommendation.groupPlan) {
      return `${recommendation.groupPlan.headline} Regroup at ${recommendation.groupPlan.regroupSpot}. ${recommendation.waitOrGoReason}`;
    }

    if (
      normalizedQuestion.includes("wait") ||
      normalizedQuestion.includes("now")
    ) {
      return `Timing guidance: ${recommendation.waitOrGoReason}`;
    }

    if (recommendation.groupPlan) {
      return `Use ${recommendation.primaryOption.label}. ${recommendation.waitOrGoReason} Group plan: ${recommendation.groupPlan.headline}`;
    }

    return `Use ${recommendation.primaryOption.label}. ${recommendation.waitOrGoReason}`;
  }

  function buildDeterministicAssistantResponse(requestBody: unknown) {
    const recommendation = buildRecommendationPayload(requestBody);

    return {
      message: buildDeterministicAssistantMessage(requestBody, recommendation),
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
    liveDestinationStates = venueDataSource.state.destinationStates.map(
      (state) => ({
        ...state,
      }),
    );

    return getOperatorState();
  }

  return {
    buildDeterministicAssistantResponse,
    buildRecommendationPayload,
    engine,
    getOperatorState,
    resetOperatorState,
    updateOperatorState,
  };
}

const recommendationService = createRecommendationService();
const {
  buildDeterministicAssistantResponse,
  buildRecommendationPayload,
  engine,
  getOperatorState,
  resetOperatorState,
  updateOperatorState,
} = recommendationService;

export {
  buildDeterministicAssistantResponse,
  buildRecommendationPayload,
  createRecommendationService,
  engine,
  getOperatorState,
  parseRecommendationRequest,
  resetOperatorState,
  updateOperatorState,
};
