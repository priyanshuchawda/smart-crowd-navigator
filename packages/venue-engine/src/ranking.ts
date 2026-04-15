import { demoVenueFixture } from "./fixture.js";
import type {
  EventPhase,
  GroupCoordinatorPlan,
  GroupWorkflow,
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

function buildAdjacency(edges: VenueEdge[], mobilityMode: MobilityMode) {
  const adjacency = new Map<string, VenueEdge[]>();

  for (const edge of edges) {
    if (mobilityMode === "accessible" && !edge.accessible) {
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
) {
  const adjacency = buildAdjacency(edges, mobilityMode);
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
        edge.congestionPenalty;

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

function getTelemetryPenalty(
  telemetryConfidence?: "observed" | "estimated" | "predicted",
  waitTimeVariability?: number,
) {
  const confidencePenalty =
    telemetryConfidence === "predicted"
      ? 1.5
      : telemetryConfidence === "estimated"
        ? 0.5
        : 0;
  const variabilityPenalty = Math.min((waitTimeVariability ?? 0) * 0.25, 2);

  return Math.round((confidencePenalty + variabilityPenalty) * 10) / 10;
}

function getAvailabilityPenalty(status?: "open" | "limited" | "closed") {
  if (status === "limited") {
    return 4;
  }

  if (status === "closed") {
    return Number.POSITIVE_INFINITY;
  }

  return 0;
}

function getAmenityPenalty(
  candidate: VenueNode,
  input: RankDestinationsInput,
): number {
  if (
    candidate.id === "family-washroom" &&
    input.intent === "washroom" &&
    input.mobilityMode !== "accessible" &&
    !input.groupProfile?.includesMobilityLimitedGuest
  ) {
    return 2;
  }

  return 0;
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
  const candidates = fixture.nodes.filter((node) => {
    if (node.kind !== input.intent) {
      return false;
    }

    const destinationState = fixture.destinationStates.find(
      (state) => state.nodeId === node.id,
    );

    return destinationState?.status !== "closed";
  });

  return candidates
    .map((candidate) => {
      const route = calculateShortestRoute(
        fixture.nodes,
        fixture.edges,
        input.sectionId,
        candidate.id,
        mobilityMode,
      );
      const destinationState = fixture.destinationStates.find(
        (state) => state.nodeId === candidate.id,
      );

      if (!destinationState) {
        throw new Error(`Missing destination state for ${candidate.id}`);
      }

      const partyServiceMinutes =
        Math.max(0, partySize - 1) *
        destinationState.serviceMinutesPerAdditionalPerson;
      const score = createBreakdown(
        route.walkingMinutes,
        queueMinutesResolver(candidate.id, destinationState.queueMinutes),
        partyServiceMinutes,
        destinationState.crowdPenalty +
          getAvailabilityPenalty(destinationState.status) +
          getAmenityPenalty(candidate, input),
        getEventPenalty(input.intent, input.eventPhase),
        getTelemetryPenalty(
          destinationState.telemetryConfidence,
          destinationState.waitTimeVariability,
        ),
      );

      return {
        destinationId: candidate.id,
        label: candidate.label,
        kind: input.intent,
        route: route.path,
        score,
      } satisfies RankedDestination;
    })
    .sort((left, right) => left.score.totalScore - right.score.totalScore);
}

/**
 * Ranks all candidate destinations for a given intent, sorted by ascending
 * total cost (walking + queue + party service + crowd penalty + event penalty).
 *
 * Uses Dijkstra's shortest-path from the attendee's section to each candidate.
 * Deterministic: identical inputs always produce identical rankings.
 *
 * @param input - Attendee context: section, intent, event phase, party size, mobility mode.
 * @param fixture - Venue graph definition (defaults to the demo venue).
 * @returns Ranked destinations sorted from lowest to highest total cost.
 */
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
 * Returns the second-best destination as a fallback option.
 * Returns null if only one candidate exists.
 *
 * @param input - Attendee context for ranking.
 * @param fixture - Venue graph definition.
 */
export function getFallbackDestination(
  input: RankDestinationsInput,
  fixture: VenueFixture = demoVenueFixture,
) {
  const rankings = rankDestinations(input, fixture);

  return rankings[1] ?? null;
}

/**
 * Determines whether the attendee should leave now or wait, by projecting
 * queue changes over a wait window and comparing total trip cost.
 *
 * Decision rule: if waiting saves ≥ 2 minutes of total trip time, recommend "wait".
 *
 * @param input - Attendee context plus waitWindowMinutes (default 5).
 * @param fixture - Venue graph definition.
 * @returns Timing advice with decision, projected best, and time saved.
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

function getNodeLabel(fixture: VenueFixture, nodeId: string) {
  return fixture.nodes.find((node) => node.id === nodeId)?.label ?? nodeId;
}

function resolveGroupWorkflow(
  input: RankDestinationsInput,
  destination: RankedDestination,
): Exclude<GroupWorkflow, "auto"> | null {
  if (input.groupWorkflow && input.groupWorkflow !== "auto") {
    return input.groupWorkflow;
  }

  const partySize = input.partySize ?? 1;

  if (partySize < 4 && !input.groupProfile?.keepGroupTogether) {
    return null;
  }

  if (input.intent === "food") {
    return "runner-pickup";
  }

  if (
    input.mobilityMode === "accessible" ||
    input.groupProfile?.includesMobilityLimitedGuest ||
    destination.kind === "exit"
  ) {
    return "meet-up";
  }

  return "return-before-play";
}

export function buildGroupCoordinatorPlan(
  input: RankDestinationsInput,
  destination: RankedDestination,
  fixture: VenueFixture = demoVenueFixture,
): GroupCoordinatorPlan | null {
  const workflow = resolveGroupWorkflow(input, destination);

  if (!workflow) {
    return null;
  }

  const sectionLabel = getNodeLabel(fixture, input.sectionId);
  const destinationLabel = getNodeLabel(fixture, destination.destinationId);
  const regroupEtaMinutes = Math.max(
    2,
    Math.round(destination.score.walkingMinutes + 1),
  );

  if (workflow === "runner-pickup") {
    return {
      workflowType: workflow,
      headline: "Send one runner while the rest of the group holds position.",
      regroupSpot: sectionLabel,
      regroupEtaMinutes,
      splitRecommended: true,
      steps: [
        `Keep most of the group at ${sectionLabel}.`,
        `Send one runner to ${destinationLabel}.`,
        `Regroup at ${sectionLabel} before moving again.`,
      ],
    };
  }

  if (workflow === "meet-up") {
    return {
      workflowType: workflow,
      headline: "Regroup first, then move together on the calmer route.",
      regroupSpot: "Concourse Center",
      regroupEtaMinutes,
      splitRecommended: false,
      steps: [
        "Bring everyone together at Concourse Center.",
        `Move together to ${destinationLabel} once the group is assembled.`,
      ],
    };
  }

  return {
    workflowType: workflow,
    headline: "Move as a group now, then return before play resumes.",
    regroupSpot: sectionLabel,
    regroupEtaMinutes,
    splitRecommended: false,
    steps: [
      `Head together to ${destinationLabel}.`,
      `Return to ${sectionLabel} before the next live sequence starts.`,
    ],
  };
}
