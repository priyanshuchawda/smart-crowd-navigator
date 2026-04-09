import { describe, expect, it } from "vitest";

import { APP_NAME, CORE_INTENTS } from "./index";

describe("shared exports", () => {
  it("exposes the app name and supported intents", () => {
    expect(APP_NAME).toBe("Smart Crowd Navigator");
    expect(CORE_INTENTS).toContain("food");
  });
});
