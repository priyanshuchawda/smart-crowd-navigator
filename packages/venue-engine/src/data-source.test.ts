import { describe, expect, it } from "vitest";

import {
  cloneVenueDataSource,
  createVenueFixtureFromDataSource,
  localDevelopmentVenueDataSource,
  parseVenueDataSource,
  replaceDestinationStates,
} from "./index.js";

describe("venue data source contract", () => {
  it("parses a valid venue data source payload", () => {
    const parsed = parseVenueDataSource(localDevelopmentVenueDataSource);

    expect(parsed.source).toBe("local-fixture");
    expect(parsed.topology.venueId).toBe("smart-crowd-demo-venue");
    expect(parsed.topology.eventPhases).toContain("break");
    expect(parsed.state.destinationStates.length).toBeGreaterThan(0);
  });

  it("rejects unsupported source kinds", () => {
    expect(() =>
      parseVenueDataSource({
        ...localDevelopmentVenueDataSource,
        source: "demo-only",
      }),
    ).toThrow(/supported venue data source kind/i);
  });

  it("rejects invalid event phases", () => {
    expect(() =>
      parseVenueDataSource({
        ...localDevelopmentVenueDataSource,
        topology: {
          ...localDevelopmentVenueDataSource.topology,
          eventPhases: ["traffic-peak"],
        },
      }),
    ).toThrow(/supported event phase/i);
  });

  it("creates a venue fixture from the contract without leaking references", () => {
    const fixture = createVenueFixtureFromDataSource(
      localDevelopmentVenueDataSource,
    );
    const firstDestination = fixture.destinationStates[0];
    const originalFirstDestination =
      localDevelopmentVenueDataSource.state.destinationStates[0];

    expect(firstDestination).toBeDefined();
    expect(originalFirstDestination).toBeDefined();

    if (!firstDestination || !originalFirstDestination) {
      throw new Error("Expected destination state fixtures to exist");
    }

    firstDestination.queueMinutes = 999;

    expect(originalFirstDestination.queueMinutes).toBe(8);
  });

  it("replaces destination states without mutating the original data source", () => {
    const firstDestination =
      localDevelopmentVenueDataSource.state.destinationStates[0];

    expect(firstDestination).toBeDefined();

    if (!firstDestination) {
      throw new Error("Expected destination state fixtures to exist");
    }

    const updated = replaceDestinationStates(localDevelopmentVenueDataSource, [
      {
        ...firstDestination,
        queueMinutes: 1,
      },
    ]);

    expect(updated.state.destinationStates[0]?.queueMinutes).toBe(1);
    expect(firstDestination.queueMinutes).toBe(8);
  });

  it("clones nested venue data source structures", () => {
    const clone = cloneVenueDataSource(localDevelopmentVenueDataSource);
    const firstNode = clone.topology.nodes[0];
    const firstDestination = clone.state.destinationStates[0];
    const originalFirstNode = localDevelopmentVenueDataSource.topology.nodes[0];
    const originalFirstDestination =
      localDevelopmentVenueDataSource.state.destinationStates[0];

    expect(firstNode).toBeDefined();
    expect(firstDestination).toBeDefined();
    expect(originalFirstNode).toBeDefined();
    expect(originalFirstDestination).toBeDefined();

    if (
      !firstNode ||
      !firstDestination ||
      !originalFirstNode ||
      !originalFirstDestination
    ) {
      throw new Error("Expected venue fixture records to exist");
    }

    firstNode.label = "Changed";
    firstDestination.queueMinutes = 77;

    expect(originalFirstNode.label).toBe("Section A-12");
    expect(originalFirstDestination.queueMinutes).toBe(8);
  });
});
