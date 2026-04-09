import { describe, expect, it } from "vitest";

import { createVenueEngine } from "./index";

describe("createVenueEngine", () => {
  it("returns venue-engine metadata", () => {
    const engine = createVenueEngine();

    expect(engine.version).toBe("0.2.0");
    expect(engine.supportedIntents).toContain("exit");
  });

  it("ranks food destinations deterministically for section A-12", () => {
    const engine = createVenueEngine();

    const firstPass = engine.rankDestinations({
      sectionId: "section-a12",
      intent: "food",
      eventPhase: "break",
    });
    const secondPass = engine.rankDestinations({
      sectionId: "section-a12",
      intent: "food",
      eventPhase: "break",
    });

    expect(firstPass[0]?.destinationId).toBe("stall-b");
    expect(firstPass).toEqual(secondPass);
    expect(firstPass[0]?.score.totalScore).toBeLessThan(
      firstPass[1]?.score.totalScore ?? Number.POSITIVE_INFINITY,
    );
  });

  it("prefers the lower total-cost washroom from section C-04", () => {
    const engine = createVenueEngine();
    const rankings = engine.rankDestinations({
      sectionId: "section-c04",
      intent: "washroom",
      eventPhase: "in-play",
    });

    expect(rankings[0]).toMatchObject({
      destinationId: "washroom-west",
      score: {
        queueMinutes: 2,
      },
    });
    expect(rankings[0]?.route[0]).toBe("section-c04");
  });

  it("avoids the inaccessible shortcut for accessible mode", () => {
    const engine = createVenueEngine();
    const accessibleExitRanking = engine.rankDestinations({
      sectionId: "section-a12",
      intent: "exit",
      eventPhase: "post-event",
      mobilityMode: "accessible",
    });

    expect(accessibleExitRanking[0]?.route).not.toContain("exit-north-hall");
    expect(accessibleExitRanking[0]?.destinationId).toBe("exit-south");
    expect(accessibleExitRanking[0]?.score.walkingMinutes).toBeGreaterThan(0);
  });
});
