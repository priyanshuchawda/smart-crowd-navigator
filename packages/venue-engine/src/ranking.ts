import { demoVenueFixture } from "./fixture.js";
import type {
  EventPhase,
  MobilityMode,
  RankDestinationsInput,
  RankedDestination,
  ScoreBreakdown,
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
  crowdPenalty: number,
  eventPenalty: number,
): ScoreBreakdown {
  return {
    walkingMinutes,
    queueMinutes,
    crowdPenalty,
    eventPenalty,
    totalScore:
      Math.round(
        (walkingMinutes + queueMinutes + crowdPenalty + eventPenalty) * 10,
      ) / 10,
  };
}

export function rankDestinations(
  input: RankDestinationsInput,
  fixture: VenueFixture = demoVenueFixture,
): RankedDestination[] {
  const mobilityMode = input.mobilityMode ?? "standard";
  const candidates = fixture.nodes.filter((node) => node.kind === input.intent);

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

      const score = createBreakdown(
        route.walkingMinutes,
        destinationState.queueMinutes,
        destinationState.crowdPenalty,
        getEventPenalty(input.intent, input.eventPhase),
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
