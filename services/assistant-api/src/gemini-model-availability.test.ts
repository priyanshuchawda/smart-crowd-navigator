import { describe, expect, it } from "vitest";

import {
  createGeminiModelAvailabilityService,
  isTerminalGeminiModelError,
} from "./gemini-model-availability.js";

describe("gemini model availability service", () => {
  it("selects the first currently available model in the chain", () => {
    let nowMs = 1_000;
    const service = createGeminiModelAvailabilityService({
      cooldownMs: 30_000,
      now: () => nowMs,
    });

    service.markModelFailure(
      "gemini-3.1-flash-lite-preview",
      Object.assign(new Error("temporarily unavailable"), {
        status: 503,
      }),
    );

    expect(
      service.selectFirstAvailableModel([
        "gemini-3.1-flash-lite-preview",
        "gemini-3-flash-preview",
        "gemini-2.5-flash",
      ]),
    ).toBe("gemini-3-flash-preview");

    expect(service.getModelHealth("gemini-3.1-flash-lite-preview").status).toBe(
      "cooldown",
    );

    nowMs += 30_001;

    expect(
      service.selectFirstAvailableModel([
        "gemini-3.1-flash-lite-preview",
        "gemini-3-flash-preview",
      ]),
    ).toBe("gemini-3.1-flash-lite-preview");
  });

  it("skips terminally unavailable models", () => {
    const service = createGeminiModelAvailabilityService();

    service.markModelFailure(
      "gemini-3.1-flash-lite-preview",
      Object.assign(new Error("Model not found for API version"), {
        status: 404,
      }),
    );

    expect(service.getModelHealth("gemini-3.1-flash-lite-preview").status).toBe(
      "terminal",
    );
    expect(
      service.selectFirstAvailableModel([
        "gemini-3.1-flash-lite-preview",
        "gemini-3-flash-preview",
      ]),
    ).toBe("gemini-3-flash-preview");
  });

  it("resets all model health state", () => {
    const service = createGeminiModelAvailabilityService();

    service.markModelFailure(
      "gemini-3.1-flash-lite-preview",
      Object.assign(new Error("temporarily unavailable"), {
        status: 503,
      }),
    );
    service.markModelFailure(
      "gemini-3-flash-preview",
      Object.assign(new Error("Model not found for API version"), {
        status: 404,
      }),
    );

    service.reset();

    expect(service.getModelHealth("gemini-3.1-flash-lite-preview").status).toBe(
      "healthy",
    );
    expect(service.getModelHealth("gemini-3-flash-preview").status).toBe(
      "healthy",
    );
    expect(
      service.selectFirstAvailableModel([
        "gemini-3.1-flash-lite-preview",
        "gemini-3-flash-preview",
      ]),
    ).toBe("gemini-3.1-flash-lite-preview");
  });

  it("honors retry-after when applying cooldown windows", () => {
    let nowMs = 0;
    const service = createGeminiModelAvailabilityService({
      cooldownMs: 1_000,
      now: () => nowMs,
    });

    service.markModelFailure(
      "gemini-3.1-flash-lite-preview",
      Object.assign(new Error("rate limited"), {
        retryAfterMs: 5_000,
        status: 429,
      }),
    );

    expect(
      service.getModelHealth("gemini-3.1-flash-lite-preview")
        .cooldownRemainingMs,
    ).toBe(5_000);

    nowMs = 4_000;

    expect(
      service.selectFirstAvailableModel([
        "gemini-3.1-flash-lite-preview",
        "gemini-3-flash-preview",
      ]),
    ).toBe("gemini-3-flash-preview");

    nowMs = 5_001;

    expect(
      service.selectFirstAvailableModel([
        "gemini-3.1-flash-lite-preview",
        "gemini-3-flash-preview",
      ]),
    ).toBe("gemini-3.1-flash-lite-preview");
  });

  it("detects terminal model errors by status and message", () => {
    expect(
      isTerminalGeminiModelError(
        Object.assign(new Error("model not found for API version"), {
          status: 404,
        }),
      ),
    ).toBe(true);
    expect(isTerminalGeminiModelError(new Error("temporarily unavailable"))).toBe(
      false,
    );
  });

  it("allows one sticky retry attempt per turn and resets on next turn", () => {
    const service = createGeminiModelAvailabilityService();

    service.markModelFailure(
      "gemini-3.1-flash-lite-preview",
      new Error("high demand"),
      {
        transition: "sticky_retry",
      },
    );

    expect(
      service.selectFirstAvailableModel([
        "gemini-3.1-flash-lite-preview",
        "gemini-3-flash-preview",
      ]),
    ).toBe("gemini-3.1-flash-lite-preview");

    service.consumeStickyAttempt("gemini-3.1-flash-lite-preview");

    expect(
      service.getModelHealth("gemini-3.1-flash-lite-preview")
        .stickyAttemptConsumed,
    ).toBe(true);
    expect(
      service.selectFirstAvailableModel([
        "gemini-3.1-flash-lite-preview",
        "gemini-3-flash-preview",
      ]),
    ).toBe("gemini-3-flash-preview");

    service.resetTurn();

    expect(
      service.getModelHealth("gemini-3.1-flash-lite-preview")
        .stickyAttemptConsumed,
    ).toBe(false);
    expect(
      service.selectFirstAvailableModel([
        "gemini-3.1-flash-lite-preview",
        "gemini-3-flash-preview",
      ]),
    ).toBe("gemini-3.1-flash-lite-preview");
  });
});
