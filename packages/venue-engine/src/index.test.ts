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
      partySize: 1,
    });
    const secondPass = engine.rankDestinations({
      sectionId: "section-a12",
      intent: "food",
      eventPhase: "break",
      partySize: 1,
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
        partyServiceMinutes: 0,
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
      partySize: 2,
    });

    expect(accessibleExitRanking[0]?.route).not.toContain("exit-north-hall");
    expect(accessibleExitRanking[0]?.destinationId).toBe("exit-south");
    expect(accessibleExitRanking[0]?.score.walkingMinutes).toBeGreaterThan(0);
  });

  it("returns the second-best destination as a fallback", () => {
    const engine = createVenueEngine();
    const fallback = engine.getFallbackDestination({
      sectionId: "section-a12",
      intent: "food",
      eventPhase: "break",
      partySize: 1,
    });

    expect(fallback?.destinationId).toBe("stall-d");
  });

  it("recommends waiting when a short-term queue drop creates a better outcome", () => {
    const engine = createVenueEngine();
    const advice = engine.getTimingAdvice({
      sectionId: "section-a12",
      intent: "food",
      eventPhase: "break",
      waitWindowMinutes: 5,
      partySize: 3,
    });

    expect(advice.decision).toBe("wait");
    expect(advice.projectedBest.destinationId).toBe("stall-b");
    expect(advice.timeSavedMinutes).toBeGreaterThanOrEqual(2);
  });

  it("recommends going now when waiting would not improve the total trip", () => {
    const engine = createVenueEngine();
    const advice = engine.getTimingAdvice({
      sectionId: "section-c04",
      intent: "washroom",
      eventPhase: "in-play",
      waitWindowMinutes: 5,
      partySize: 1,
    });

    expect(advice.decision).toBe("go_now");
    expect(advice.currentBest.destinationId).toBe("washroom-west");
    expect(advice.recommendedWaitMinutes).toBe(0);
  });

  it("can change the food ranking for larger parties", () => {
    const engine = createVenueEngine();
    const solo = engine.rankDestinations({
      sectionId: "section-a12",
      intent: "food",
      eventPhase: "break",
      partySize: 1,
    });
    const group = engine.rankDestinations({
      sectionId: "section-a12",
      intent: "food",
      eventPhase: "break",
      partySize: 5,
    });

    expect(solo[0]?.destinationId).toBe("stall-b");
    expect(group[0]?.destinationId).toBe("stall-d");
    expect(group[0]?.score.partyServiceMinutes).toBeLessThan(
      group[1]?.score.partyServiceMinutes ?? Number.POSITIVE_INFINITY,
    );
  });

  it("returns rankings for all four supported intents", () => {
    const engine = createVenueEngine();

    for (const intent of engine.supportedIntents) {
      const rankings = engine.rankDestinations({
        sectionId: "section-a12",
        intent,
        eventPhase: "in-play",
        partySize: 1,
      });

      expect(rankings.length).toBeGreaterThan(0);
      expect(rankings[0]?.score.totalScore).toBeGreaterThan(0);
    }
  });

  it("produces a deterministic ranking when all queues are equal", () => {
    const engine = createVenueEngine();
    const first = engine.rankDestinations({
      sectionId: "section-a12",
      intent: "washroom",
      eventPhase: "pre-event",
      partySize: 1,
    });
    const second = engine.rankDestinations({
      sectionId: "section-a12",
      intent: "washroom",
      eventPhase: "pre-event",
      partySize: 1,
    });

    expect(first.map((r) => r.destinationId)).toEqual(
      second.map((r) => r.destinationId),
    );
  });

  it("returns go_now when queue trend is zero", () => {
    const engine = createVenueEngine();
    const advice = engine.getTimingAdvice({
      sectionId: "section-a12",
      intent: "exit",
      eventPhase: "post-event",
      waitWindowMinutes: 5,
      partySize: 1,
    });

    expect(advice.decision).toBe("go_now");
    expect(advice.timeSavedMinutes).toBe(0);
  });

  it("adjusts party service penalty proportionally to party size", () => {
    const engine = createVenueEngine();
    const party2 = engine.rankDestinations({
      sectionId: "section-a12",
      intent: "food",
      eventPhase: "break",
      partySize: 2,
    });
    const party8 = engine.rankDestinations({
      sectionId: "section-a12",
      intent: "food",
      eventPhase: "break",
      partySize: 8,
    });

    const party2Service = party2[0]?.score.partyServiceMinutes ?? 0;
    const party8Service = party8[0]?.score.partyServiceMinutes ?? 0;

    expect(party8Service).toBeGreaterThan(party2Service);
  });

  it("ranks exit destinations from section C-04", () => {
    const engine = createVenueEngine();
    const exitRanking = engine.rankDestinations({
      sectionId: "section-c04",
      intent: "exit",
      eventPhase: "post-event",
      partySize: 2,
    });

    expect(exitRanking.length).toBeGreaterThan(0);
    expect(exitRanking[0]?.score.walkingMinutes).toBeGreaterThan(0);
    expect(exitRanking[0]?.route[0]).toBe("section-c04");
  });
});

