import { describe, expect, it } from "vitest";

import { demoVenueFixture } from "./fixture.js";
import {
  buildGroupCoordinatorPlan,
  getFallbackDestination,
  getTimingAdvice,
  rankDestinations,
} from "./ranking.js";
import type { VenueFixture } from "./types.js";

function createFixture(overrides: Partial<VenueFixture> = {}): VenueFixture {
  return {
    ...demoVenueFixture,
    ...overrides,
    destinationStates:
      overrides.destinationStates ?? demoVenueFixture.destinationStates,
    edges: overrides.edges ?? demoVenueFixture.edges,
    nodes: overrides.nodes ?? demoVenueFixture.nodes,
  };
}

describe("ranking edge cases", () => {
  it("throws when no route exists between section and destination", () => {
    const disconnectedFixture = createFixture({
      destinationStates: [
        {
          nodeId: "stall-b",
          status: "open",
          queueMinutes: 5,
          crowdPenalty: 1,
          queueTrendAfterFiveMinutes: 0,
          serviceMinutesPerAdditionalPerson: 1,
        },
      ],
      edges: [],
      nodes: demoVenueFixture.nodes.filter(
        (node) => node.id === "section-a12" || node.id === "stall-b",
      ),
    });

    expect(() =>
      rankDestinations(
        {
          sectionId: "section-a12",
          intent: "food",
          eventPhase: "break",
        },
        disconnectedFixture,
      ),
    ).toThrow(/No route found/i);
  });

  it("returns null fallback when only one destination is available", () => {
    const singleDestinationFixture = createFixture({
      destinationStates: [
        {
          nodeId: "stall-b",
          status: "open",
          queueMinutes: 5,
          crowdPenalty: 1,
          queueTrendAfterFiveMinutes: 0,
          serviceMinutesPerAdditionalPerson: 1,
        },
      ],
      nodes: demoVenueFixture.nodes.filter(
        (node) =>
          node.id === "section-a12" ||
          node.id === "concourse-east" ||
          node.id === "stall-b",
      ),
      edges: demoVenueFixture.edges.filter(
        (edge) =>
          (edge.from === "section-a12" && edge.to === "concourse-east") ||
          (edge.from === "concourse-east" && edge.to === "stall-b"),
      ),
    });

    const fallback = getFallbackDestination(
      {
        sectionId: "section-a12",
        intent: "food",
        eventPhase: "break",
      },
      singleDestinationFixture,
    );

    expect(fallback).toBeNull();
  });

  it("throws timing advice error when no destination can be ranked", () => {
    const noOpenFoodFixture = createFixture({
      destinationStates: demoVenueFixture.destinationStates.map((state) =>
        state.nodeId.startsWith("stall-")
          ? { ...state, status: "closed" as const }
          : state,
      ),
    });

    expect(() =>
      getTimingAdvice(
        {
          sectionId: "section-a12",
          intent: "food",
          eventPhase: "break",
        },
        noOpenFoodFixture,
      ),
    ).toThrow(/No ranked destinations found for intent food/i);
  });

  it("returns null group plan for small groups that do not stay together", () => {
    const [destination] = rankDestinations({
      sectionId: "section-a12",
      intent: "washroom",
      eventPhase: "break",
      partySize: 3,
    });

    if (!destination) {
      throw new Error("Expected a ranked destination");
    }

    const plan = buildGroupCoordinatorPlan(
      {
        sectionId: "section-a12",
        intent: "washroom",
        eventPhase: "break",
        partySize: 3,
        groupProfile: {
          keepGroupTogether: false,
        },
      },
      destination,
    );

    expect(plan).toBeNull();
  });

  it("resolves meet-up plans for accessible routes", () => {
    const [destination] = rankDestinations({
      sectionId: "section-a12",
      intent: "exit",
      eventPhase: "post-event",
      partySize: 4,
      mobilityMode: "accessible",
    });

    if (!destination) {
      throw new Error("Expected a ranked destination");
    }

    const plan = buildGroupCoordinatorPlan(
      {
        sectionId: "section-a12",
        intent: "exit",
        eventPhase: "post-event",
        partySize: 4,
        mobilityMode: "accessible",
      },
      destination,
    );

    expect(plan?.workflowType).toBe("meet-up");
    expect(plan?.splitRecommended).toBe(false);
  });

  it("resolves return-before-play plans for larger non-food groups", () => {
    const [destination] = rankDestinations({
      sectionId: "section-a12",
      intent: "entry-gate",
      eventPhase: "break",
      partySize: 5,
    });

    if (!destination) {
      throw new Error("Expected a ranked destination");
    }

    const plan = buildGroupCoordinatorPlan(
      {
        sectionId: "section-a12",
        intent: "entry-gate",
        eventPhase: "break",
        partySize: 5,
      },
      destination,
    );

    expect(plan?.workflowType).toBe("return-before-play");
  });

  it("respects explicit non-auto workflow selection", () => {
    const [destination] = rankDestinations({
      sectionId: "section-a12",
      intent: "food",
      eventPhase: "break",
      partySize: 5,
    });

    if (!destination) {
      throw new Error("Expected a ranked destination");
    }

    const plan = buildGroupCoordinatorPlan(
      {
        sectionId: "section-a12",
        intent: "food",
        eventPhase: "break",
        partySize: 5,
        groupWorkflow: "meet-up",
      },
      destination,
    );

    expect(plan?.workflowType).toBe("meet-up");
  });
});
