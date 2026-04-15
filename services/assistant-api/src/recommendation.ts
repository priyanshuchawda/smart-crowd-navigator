import {
  type AssistantDecisionReasons,
  type AssistantOperationalAdvisory,
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

type LiveVenueStateMetadata = {
  lastSyncedAt: string | null;
  source: "local-fixture" | "operator-sync" | "snapshot-sync";
  stateCount: number;
  venueId: string;
};

function createLiveVenueStateStore(venueDataSource: VenueDataSource) {
  let liveDestinationStates: DestinationState[] =
    venueDataSource.state.destinationStates.map((state) => ({ ...state }));
  let metadata: LiveVenueStateMetadata = {
    lastSyncedAt: null,
    source:
      venueDataSource.source === "local-fixture"
        ? "local-fixture"
        : "snapshot-sync",
    stateCount: liveDestinationStates.length,
    venueId: venueDataSource.topology.venueId,
  };

  function getSnapshot() {
    return liveDestinationStates.map((state) => ({ ...state }));
  }

  function getMetadata(): LiveVenueStateMetadata {
    return { ...metadata };
  }

  function replaceSnapshot(
    states: DestinationState[],
    source: LiveVenueStateMetadata["source"],
  ) {
    liveDestinationStates = states.map((state) => ({ ...state }));
    metadata = {
      ...metadata,
      lastSyncedAt: new Date().toISOString(),
      source,
      stateCount: liveDestinationStates.length,
    };

    return getSnapshot();
  }

  function updateDestination(nextState: DestinationState) {
    return replaceSnapshot(
      liveDestinationStates.map((state) =>
        state.nodeId === nextState.nodeId ? { ...nextState } : state,
      ),
      "operator-sync",
    );
  }

  function resetToFixture() {
    return replaceSnapshot(
      venueDataSource.state.destinationStates,
      venueDataSource.source === "local-fixture"
        ? "local-fixture"
        : "snapshot-sync",
    );
  }

  return {
    getMetadata,
    getSnapshot,
    replaceSnapshot,
    resetToFixture,
    updateDestination,
  };
}

function createRecommendationService({
  venueDataSource = localDevelopmentVenueDataSource,
}: {
  venueDataSource?: VenueDataSource;
} = {}) {
  const engine = createVenueEngine({
    defaultDataSource: venueDataSource,
  });
  const liveVenueStateStore = createLiveVenueStateStore(venueDataSource);

  function getLiveFixture(): VenueFixture {
    return createVenueFixtureFromDataSource(
      replaceDestinationStates(
        venueDataSource,
        liveVenueStateStore.getSnapshot(),
      ),
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

  function getDestinationState(fixture: VenueFixture, destinationId: string) {
    return fixture.destinationStates.find(
      (state) => state.nodeId === destinationId,
    );
  }

  function buildDecisionReasons({
    fallback,
    selectedDestination,
    selectedState,
  }: {
    fallback: ReturnType<typeof engine.getFallbackDestination>;
    selectedDestination: NonNullable<
      ReturnType<typeof engine.rankDestinations>[number]
    >;
    selectedState: NonNullable<ReturnType<typeof getDestinationState>>;
  }): AssistantDecisionReasons {
    const strengths: string[] = [];
    const tradeoffs: string[] = [];

    if (
      fallback &&
      selectedDestination.score.queueMinutes < fallback.score.queueMinutes
    ) {
      strengths.push(
        `${Math.max(
          1,
          fallback.score.queueMinutes - selectedDestination.score.queueMinutes,
        )} min shorter queue than the main fallback.`,
      );
    }

    if (
      fallback &&
      selectedDestination.score.crowdPenalty < fallback.score.crowdPenalty
    ) {
      strengths.push("Lower congestion pressure than the main fallback route.");
    }

    if (selectedState.status !== "limited") {
      strengths.push("Destination is open and fully available right now.");
    }

    if ((selectedState.telemetryConfidence ?? "observed") === "observed") {
      strengths.push("Backed by high-confidence live telemetry.");
    }

    if (selectedDestination.score.walkingMinutes <= 4) {
      strengths.push("Short walking distance keeps the detour manageable.");
    }

    if (
      fallback &&
      selectedDestination.score.walkingMinutes > fallback.score.walkingMinutes
    ) {
      tradeoffs.push("Slightly longer walk than the fallback option.");
    }

    if (selectedDestination.score.queueMinutes >= 8) {
      tradeoffs.push("Queue is still meaningful even on the best route.");
    }

    if (selectedDestination.score.crowdPenalty >= 3) {
      tradeoffs.push("Crowd pressure remains elevated in part of this path.");
    }

    if (selectedDestination.score.telemetryPenalty >= 1.5) {
      tradeoffs.push("Live telemetry is less stable than the ideal scenario.");
    }

    if (strengths.length < 2) {
      strengths.push(
        "Best overall score across the currently available options.",
      );
    }

    if (strengths.length < 2) {
      strengths.push("Balances walking time, queue pressure, and reliability.");
    }

    return {
      strengths: strengths.slice(0, 4),
      tradeoffs: tradeoffs.slice(0, 3),
    };
  }

  function buildOperationalAdvisory({
    currentBest,
    currentRankings,
    input,
    timeSavedMinutes,
  }: {
    currentBest: NonNullable<
      ReturnType<typeof engine.rankDestinations>[number]
    >;
    currentRankings: ReturnType<typeof engine.rankDestinations>;
    input: ReturnType<typeof parseRecommendationRequest>;
    timeSavedMinutes: number;
  }): AssistantOperationalAdvisory | null {
    if (
      input.intent === "exit" &&
      currentRankings.every(
        (candidate) =>
          candidate.score.queueMinutes >= 6 ||
          candidate.score.crowdPenalty >= 4,
      )
    ) {
      return {
        headline: "All exits are under heavy load.",
        detail:
          "Every exit is currently congested, so the safest move is to hold position briefly and avoid pushing into the crowd peak.",
        recommendedAction:
          "Hold position, regroup near Concourse Center, then retry the exit flow in a few minutes.",
        severity: "warning",
      };
    }

    if (timeSavedMinutes >= 2) {
      return {
        headline: "Conditions improve if you wait.",
        detail:
          "The live queue trend shows a better route outcome after a short delay, so staying put briefly is the smarter move.",
        recommendedAction: "Hold position and recheck before moving.",
        severity: "info",
      };
    }

    if (currentBest.score.totalScore >= 18) {
      return {
        headline: "Venue conditions are degraded.",
        detail:
          "The best available route is still costly, which means this is a crowd-management scenario rather than a clean movement window.",
        recommendedAction:
          "Delay non-essential movement or use the calmer regroup route before committing.",
        severity: "warning",
      };
    }

    return null;
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
    const currentRankings = engine.rankDestinations(engineInput, fixture);
    const currentBest = currentRankings[0];
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

    const selectedState = getDestinationState(
      fixture,
      selectedDestination.destinationId,
    );

    if (!selectedState) {
      throw new Error(
        `Missing destination state for ${selectedDestination.destinationId}`,
      );
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
      decisionReasons: buildDecisionReasons({
        fallback,
        selectedDestination,
        selectedState,
      }),
      groupPlan,
      operationalAdvisory: buildOperationalAdvisory({
        currentBest,
        currentRankings,
        input,
        timeSavedMinutes: timingAdvice.timeSavedMinutes,
      }),
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
    return liveVenueStateStore.getSnapshot();
  }

  function updateOperatorState(nextState: DestinationState) {
    return liveVenueStateStore.updateDestination(nextState);
  }

  function syncLiveVenueState(states: DestinationState[]) {
    return liveVenueStateStore.replaceSnapshot(states, "snapshot-sync");
  }

  function getLiveVenueStateMetadata() {
    return liveVenueStateStore.getMetadata();
  }

  function resetOperatorState() {
    return liveVenueStateStore.resetToFixture();
  }

  return {
    buildDeterministicAssistantResponse,
    buildRecommendationPayload,
    engine,
    getLiveVenueStateMetadata,
    getOperatorState,
    resetOperatorState,
    syncLiveVenueState,
    updateOperatorState,
  };
}

const recommendationService = createRecommendationService();
const {
  buildDeterministicAssistantResponse,
  buildRecommendationPayload,
  engine,
  getLiveVenueStateMetadata,
  getOperatorState,
  resetOperatorState,
  syncLiveVenueState,
  updateOperatorState,
} = recommendationService;

export {
  buildDeterministicAssistantResponse,
  buildRecommendationPayload,
  createLiveVenueStateStore,
  createRecommendationService,
  engine,
  getLiveVenueStateMetadata,
  getOperatorState,
  parseRecommendationRequest,
  resetOperatorState,
  syncLiveVenueState,
  updateOperatorState,
};
