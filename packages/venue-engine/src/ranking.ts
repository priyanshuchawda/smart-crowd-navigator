import { demoVenueFixture } from "./fixture.js";
import type {
  DestinationState,
  EventPhase,
  MobilityMode,
  RankDestinationsInput,
  RankedDestination,
  ScoreBreakdown,
  TimingAdvice,
  TimingAdviceInput,
  VenueEdge,
  VenueFixture,
  VenueIntent,
  VenueNode,
} from "./types.js";

function getEventPenalty(intent: VenueIntent, eventPhase: EventPhase) {
  const eventPenaltyMatrix: Record<VenueIntent, Record<EventPhase, number>> = {
    food: {
      "pre-event": 1,
      "in-play": 4,
      break: 2,
      "post-event": 0,
    },
    washroom: {
      "pre-event": 0,
      "in-play": 1,
      break: 2,
      "post-event": 0,
    },
    "entry-gate": {
      "pre-event": 0,
      "in-play": 3,
      break: 3,
      "post-event": 3,
    },
    exit: {
      "pre-event": 2,
      "in-play": 2,
      break: 2,
      "post-event": 0,
    },
  };

  return eventPenaltyMatrix[intent][eventPhase];
}

function buildAdjacency(
  edges: VenueEdge[],
  mobilityMode: MobilityMode,
  groupProfile: RankDestinationsInput["groupProfile"],
) {
  const adjacency = new Map<string, VenueEdge[]>();

  for (const edge of edges) {
    const requiresStepFreeRoute =
      mobilityMode === "accessible" ||
      (mobilityMode === "mixed" &&
        groupProfile?.includesMobilityLimitedGuest &&
        groupProfile.keepGroupTogether !== false);

    if (requiresStepFreeRoute && !edge.accessible) {
      continue;
    }

    const reverseEdge: VenueEdge = {
      ...edge,
      from: edge.to,
      to: edge.from,
    };

    adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge]);
    adjacency.set(edge.to, [...(adjacency.get(edge.to) ?? []), reverseEdge]);
  }

  return adjacency;
}

function calculateShortestRoute(
  nodes: VenueNode[],
  edges: VenueEdge[],
  fromId: string,
  toId: string,
  mobilityMode: MobilityMode,
  groupProfile: RankDestinationsInput["groupProfile"],
) {
  const adjacency = buildAdjacency(edges, mobilityMode, groupProfile);
  const distances = new Map<string, number>();
  const previous = new Map<string, string | null>();
  const unvisited = new Set(nodes.map((node) => node.id));

  for (const node of nodes) {
    distances.set(node.id, Number.POSITIVE_INFINITY);
    previous.set(node.id, null);
  }

  distances.set(fromId, 0);

  while (unvisited.size > 0) {
    const current = [...unvisited].reduce((bestNode, nodeId) => {
      const bestDistance = distances.get(bestNode) ?? Number.POSITIVE_INFINITY;
      const currentDistance = distances.get(nodeId) ?? Number.POSITIVE_INFINITY;

      return currentDistance < bestDistance ? nodeId : bestNode;
    });

    if (current === toId) {
      break;
    }

    unvisited.delete(current);

    for (const edge of adjacency.get(current) ?? []) {
      if (!unvisited.has(edge.to)) {
        continue;
      }

      const candidateDistance =
        (distances.get(current) ?? Number.POSITIVE_INFINITY) +
        edge.minutes +
        edge.congestionPenalty +
        getMixedMobilityEdgePenalty(edge, mobilityMode, groupProfile);

      if (
        candidateDistance < (distances.get(edge.to) ?? Number.POSITIVE_INFINITY)
      ) {
        distances.set(edge.to, candidateDistance);
        previous.set(edge.to, current);
      }
    }
  }

  const path: string[] = [];
  let current: string | null = toId;

  while (current) {
    path.unshift(current);
    current = previous.get(current) ?? null;
  }

  if (path[0] !== fromId) {
    throw new Error(`No route found from ${fromId} to ${toId}`);
  }

  return {
    path,
    walkingMinutes: Math.round((distances.get(toId) ?? 0) * 10) / 10,
  };
}

function createBreakdown(
  walkingMinutes: number,
  queueMinutes: number,
  partyServiceMinutes: number,
  crowdPenalty: number,
  eventPenalty: number,
  telemetryPenalty: number,
): ScoreBreakdown {
  return {
    walkingMinutes,
    queueMinutes,
    partyServiceMinutes,
    crowdPenalty,
    eventPenalty,
    telemetryPenalty,
    totalScore:
      Math.round(
        (walkingMinutes +
          queueMinutes +
          partyServiceMinutes +
          crowdPenalty +
          eventPenalty +
          telemetryPenalty) *
          10,
      ) / 10,
  };
}

function getMixedMobilityEdgePenalty(
  edge: VenueEdge,
  mobilityMode: MobilityMode,
  groupProfile: RankDestinationsInput["groupProfile"],
) {
  if (
    mobilityMode !== "mixed" ||
    !groupProfile?.includesMobilityLimitedGuest ||
    !groupProfile.keepGroupTogether
  ) {
    return 0;
  }

  if (edge.pathType === "stairs") {
    return 6;
  }

  if (edge.pathType === "elevator") {
    return 1;
  }

  if (edge.pathType === "ramp") {
    return 0.5;
  }

  return 0;
}

function getTelemetryPenalty(destinationState: DestinationState) {
  const telemetryConfidence =
    destinationState.telemetryConfidence ?? "observed";
  const waitTimeVariability = destinationState.waitTimeVariability ?? 0;
  const status = destinationState.status ?? "open";
  const confidencePenalty =
    telemetryConfidence === "observed"
      ? 0
      : telemetryConfidence === "estimated"
        ? 0.5
        : 1;
  const statusPenalty =
    status === "open" ? 0 : status === "limited" ? 2 : Number.POSITIVE_INFINITY;

  if (!Number.isFinite(statusPenalty)) {
    return statusPenalty;
  }

  return statusPenalty + waitTimeVariability / 2 + confidencePenalty;
}

function projectQueueMinutes(
  currentQueueMinutes: number,
  queueTrendAfterFiveMinutes: number,
  waitWindowMinutes: number,
) {
  const scaledTrend = (queueTrendAfterFiveMinutes * waitWindowMinutes) / 5;

  return Math.max(0, Math.round(currentQueueMinutes + scaledTrend));
}

function buildRankings(
  input: RankDestinationsInput,
  fixture: VenueFixture,
  queueMinutesResolver: (nodeId: string, baseQueueMinutes: number) => number,
) {
  const mobilityMode = input.mobilityMode ?? "standard";
  const partySize = input.partySize ?? 1;
  const candidates = fixture.nodes.filter((node) => node.kind === input.intent);

  return candidates
    .map((candidate) => {
      const destinationState = fixture.destinationStates.find(
        (state) => state.nodeId === candidate.id,
      );

      if (!destinationState) {
        throw new Error(`Missing destination state for ${candidate.id}`);
      }

      const telemetryPenalty = getTelemetryPenalty(destinationState);

      if (!Number.isFinite(telemetryPenalty)) {
        return null;
      }

      const route = calculateShortestRoute(
        fixture.nodes,
        fixture.edges,
        input.sectionId,
        candidate.id,
        mobilityMode,
        input.groupProfile,
      );

      const partyServiceMinutes =
        Math.max(0, partySize - 1) *
        destinationState.serviceMinutesPerAdditionalPerson;
      const score = createBreakdown(
        route.walkingMinutes,
        queueMinutesResolver(candidate.id, destinationState.queueMinutes),
        partyServiceMinutes,
        destinationState.crowdPenalty,
        getEventPenalty(input.intent, input.eventPhase),
        telemetryPenalty,
      );

      return {
        destinationId: candidate.id,
        label: candidate.label,
        kind: input.intent,
        route: route.path,
        score,
      } satisfies RankedDestination;
    })
    .filter((candidate): candidate is RankedDestination => candidate !== null)
    .sort((left, right) => left.score.totalScore - right.score.totalScore);
}

export function rankDestinations(
  input: RankDestinationsInput,
  fixture: VenueFixture = demoVenueFixture,
): RankedDestination[] {
  return buildRankings(
    input,
    fixture,
    (_nodeId, baseQueueMinutes) => baseQueueMinutes,
  );
}

/**
 * Returns the second-best option from the ranked destination list.
 *
 * @param input - Request context used to produce destination rankings.
 * @param fixture - Optional venue fixture override for tests and simulations.
 * @returns The fallback destination or null if there is no second candidate.
 */
export function getFallbackDestination(
  input: RankDestinationsInput,
  fixture: VenueFixture = demoVenueFixture,
) {
  const rankings = rankDestinations(input, fixture);

  return rankings[1] ?? null;
}

/**
 * Compares going now vs waiting for queue trend changes, then returns timing advice.
 *
 * @param input - Ranking context plus optional wait window in minutes.
 * @param fixture - Optional venue fixture override for tests and simulations.
 * @returns Timing decision details with current/projected best options.
 */
export function getTimingAdvice(
  input: TimingAdviceInput,
  fixture: VenueFixture = demoVenueFixture,
): TimingAdvice {
  const waitWindowMinutes = input.waitWindowMinutes ?? 5;
  const currentRankings = rankDestinations(input, fixture);
  const projectedRankings = buildRankings(
    input,
    fixture,
    (nodeId, baseQueueMinutes) => {
      const destinationState = fixture.destinationStates.find(
        (state) => state.nodeId === nodeId,
      );

      if (!destinationState) {
        return baseQueueMinutes;
      }

      return projectQueueMinutes(
        baseQueueMinutes,
        destinationState.queueTrendAfterFiveMinutes,
        waitWindowMinutes,
      );
    },
  );

  const currentBest = currentRankings[0];
  const projectedBest = projectedRankings[0];

  if (!currentBest || !projectedBest) {
    throw new Error(`No ranked destinations found for intent ${input.intent}`);
  }

  const waitedTotal = projectedBest.score.totalScore + waitWindowMinutes;
  const timeSavedMinutes = Math.max(
    0,
    Math.round((currentBest.score.totalScore - waitedTotal) * 10) / 10,
  );
  const shouldWait = timeSavedMinutes >= 2;

  return {
    decision: shouldWait ? "wait" : "go_now",
    recommendedWaitMinutes: shouldWait ? waitWindowMinutes : 0,
    currentBest,
    projectedBest,
    timeSavedMinutes,
    reason: shouldWait
      ? `Waiting ${waitWindowMinutes} minutes reduces the predicted total trip cost by ${timeSavedMinutes} minutes.`
      : "Leaving now is still the fastest option once wait time is included.",
  };
}
