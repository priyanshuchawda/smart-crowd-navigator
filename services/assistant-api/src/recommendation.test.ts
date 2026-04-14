import { describe, expect, it } from "vitest";

import {
  localDevelopmentVenueDataSource,
  replaceDestinationStates,
} from "@smart-crowd-navigator/venue-engine";

import { createRecommendationService } from "./recommendation.js";

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
});
