import { describe, expect, it } from "vitest";

import {
  localDevelopmentVenueDataSource,
  replaceDestinationStates,
} from "@smart-crowd-navigator/venue-engine";

import {
  createLiveVenueStateStore,
  createRecommendationService,
} from "./recommendation.js";

describe("recommendation service venue data source boundary", () => {
  it("can be constructed with an explicit venue data source", () => {
    const recommendationService = createRecommendationService({
      venueDataSource: replaceDestinationStates(
        localDevelopmentVenueDataSource,
        [
          {
            nodeId: "stall-b",
            queueMinutes: 25,
            crowdPenalty: 3,
            queueTrendAfterFiveMinutes: 0,
            serviceMinutesPerAdditionalPerson: 2,
          },
          {
            nodeId: "stall-d",
            queueMinutes: 1,
            crowdPenalty: 0,
            queueTrendAfterFiveMinutes: 0,
            serviceMinutesPerAdditionalPerson: 0.5,
          },
          ...localDevelopmentVenueDataSource.state.destinationStates.filter(
            (state) => state.nodeId !== "stall-b" && state.nodeId !== "stall-d",
          ),
        ],
      ),
    });

    const payload = recommendationService.buildRecommendationPayload({
      section: "section-a12",
      intent: "food",
      partySize: 1,
      eventPhase: "break",
      mobilityMode: "standard",
    });

    expect(payload.primaryOption.id).toBe("stall-d");
  });

  it("returns a conversational deterministic follow-up for why-questions", () => {
    const recommendationService = createRecommendationService();
    const response = recommendationService.buildDeterministicAssistantResponse({
      section: "section-a12",
      intent: "food",
      partySize: 1,
      eventPhase: "break",
      mobilityMode: "standard",
      question: "Why is that the best food option?",
      conversationHistory: [
        {
          role: "user",
          text: "Which food option is best right now?",
        },
        {
          role: "assistant",
          text: "Use Stall B. Waiting 5 minutes reduces the predicted total trip cost by 3 minutes.",
        },
      ],
    });

    expect(response.message).toContain("Best total score");
    expect(response.message).toContain("Stall B");
  });

  it("adds a group coordinator plan for larger food groups", () => {
    const recommendationService = createRecommendationService();
    const payload = recommendationService.buildRecommendationPayload({
      section: "section-a12",
      intent: "food",
      partySize: 5,
      eventPhase: "break",
      mobilityMode: "standard",
      groupWorkflow: "runner-pickup",
    });

    expect(payload.groupPlan?.workflowType).toBe("runner-pickup");
    expect(payload.groupPlan?.headline).toContain("runner");
  });

  it("tracks live venue state metadata across snapshot sync and reset", () => {
    const store = createLiveVenueStateStore(localDevelopmentVenueDataSource);

    expect(store.getMetadata().source).toBe("local-fixture");

    store.replaceSnapshot(
      localDevelopmentVenueDataSource.state.destinationStates.map((state) => ({
        ...state,
        queueMinutes: state.queueMinutes + 1,
      })),
      "snapshot-sync",
    );

    expect(store.getMetadata().source).toBe("snapshot-sync");
    expect(store.getMetadata().stateCount).toBeGreaterThan(0);

    store.resetToFixture();

    expect(store.getMetadata().source).toBe("local-fixture");
  });

  it("keeps fixture data isolated from synced live snapshots", () => {
    const store = createLiveVenueStateStore(localDevelopmentVenueDataSource);
    const originalQueueMinutes =
      localDevelopmentVenueDataSource.state.destinationStates[0]?.queueMinutes;

    store.replaceSnapshot(
      localDevelopmentVenueDataSource.state.destinationStates.map((state) => ({
        ...state,
        queueMinutes: state.queueMinutes + 20,
      })),
      "snapshot-sync",
    );

    expect(store.getSnapshot()[0]?.queueMinutes).toBe(
      (originalQueueMinutes ?? 0) + 20,
    );
    expect(
      localDevelopmentVenueDataSource.state.destinationStates[0]?.queueMinutes,
    ).toBe(originalQueueMinutes);
  });
});
