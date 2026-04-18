import { describe, expect, it, vi } from "vitest";

import {
  getGeminiErrorStatus,
  getGeminiRetryAfterMs,
  isRetryableGeminiTransportError,
  retryGeminiCall,
} from "./gemini-retry.js";

describe("retryGeminiCall", () => {
  it("returns successfully without retry when execution succeeds first try", async () => {
    const execute = vi.fn().mockResolvedValue("ok");

    const result = await retryGeminiCall(execute);

    expect(result).toBe("ok");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("retries transient failures and eventually succeeds", async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("service unavailable"), {
          status: 503,
        }),
      )
      .mockResolvedValueOnce("ok");
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await retryGeminiCall(execute, {
      initialDelayMs: 100,
      jitterRatio: 0,
      maxAttempts: 3,
      sleep,
    });

    expect(result).toBe("ok");
    expect(execute).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(100);
  });

  it("uses retry-after hint when present", async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("quota"), {
          retryAfterMs: 900,
          status: 429,
        }),
      )
      .mockResolvedValueOnce("ok");
    const sleep = vi.fn().mockResolvedValue(undefined);

    await retryGeminiCall(execute, {
      initialDelayMs: 100,
      jitterRatio: 0,
      maxAttempts: 2,
      sleep,
    });

    expect(sleep).toHaveBeenCalledWith(900);
  });

  it("does not retry non-retryable errors", async () => {
    const execute = vi.fn().mockRejectedValue(
      Object.assign(new Error("invalid api key"), {
        status: 401,
      }),
    );
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      retryGeminiCall(execute, {
        maxAttempts: 3,
        sleep,
      }),
    ).rejects.toThrow("invalid api key");

    expect(execute).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("throws after max retry attempts are exhausted", async () => {
    const execute = vi.fn().mockRejectedValue(
      Object.assign(new Error("temporarily unavailable"), {
        status: 503,
      }),
    );
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      retryGeminiCall(execute, {
        initialDelayMs: 10,
        jitterRatio: 0,
        maxAttempts: 3,
        sleep,
      }),
    ).rejects.toThrow("temporarily unavailable");

    expect(execute).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
});

describe("Gemini retry helpers", () => {
  it("extracts status from supported error shapes", () => {
    expect(
      getGeminiErrorStatus(
        Object.assign(new Error("status"), {
          status: 503,
        }),
      ),
    ).toBe(503);

    expect(
      getGeminiErrorStatus(
        Object.assign(new Error("statusCode"), {
          statusCode: 429,
        }),
      ),
    ).toBe(429);
  });

  it("extracts retry-after from headers and retryAfter fields", () => {
    expect(
      getGeminiRetryAfterMs({
        headers: {
          get: (name: string) => (name === "retry-after" ? "2" : null),
        },
      }),
    ).toBe(2_000);

    expect(
      getGeminiRetryAfterMs({
        retryAfter: "1",
      }),
    ).toBe(1_000);
  });

  it("detects retryable network code from nested causes", () => {
    const errorWithNestedCause = Object.assign(new Error("fetch failed"), {
      cause: {
        code: "ECONNRESET",
      },
    });

    expect(isRetryableGeminiTransportError(errorWithNestedCause)).toBe(true);
  });
});
