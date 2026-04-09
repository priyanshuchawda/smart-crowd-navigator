import { describe, expect, it } from "vitest";

import { createVenueEngine } from "./index";

describe("createVenueEngine", () => {
  it("returns scaffold metadata", () => {
    const engine = createVenueEngine();

    expect(engine.version).toBe("0.1.0");
    expect(engine.supportedIntents).toContain("exit");
  });
});
