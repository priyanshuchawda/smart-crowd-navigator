import { describe, expect, it } from "vitest";

import {
  buildGeminiModelPolicyChain,
  classifyGeminiFailureKind,
  createGeminiModelPolicy,
  resolveGeminiFailureAction,
  resolveGeminiFailureTransition,
  resolveGeminiModelPolicy,
} from "./gemini-model-policy.js";

describe("gemini model policy", () => {
  it("classifies transient failures from status and pressure signals", () => {
    expect(
      classifyGeminiFailureKind(
        Object.assign(new Error("high demand"), {
          status: 503,
        }),
      ),
    ).toBe("transient");
    expect(classifyGeminiFailureKind(new Error("resource exhausted"))).toBe(
      "transient",
    );
  });

  it("classifies not-found and terminal model failures", () => {
    expect(
      classifyGeminiFailureKind(
        Object.assign(new Error("Model not found for API version"), {
          status: 404,
        }),
      ),
    ).toBe("not_found");
    expect(
      classifyGeminiFailureKind(
        Object.assign(new Error("permission denied for model"), {
          status: 403,
        }),
      ),
    ).toBe("terminal");
  });

  it("falls back to unknown classification for opaque errors", () => {
    expect(
      classifyGeminiFailureKind(new Error("socket exploded unexpectedly")),
    ).toBe("unknown");
  });

  it("builds a policy chain with the last model marked as last-resort", () => {
    const chain = buildGeminiModelPolicyChain([
      "gemini-3.1-flash-lite-preview",
      "gemini-3-flash-preview",
      "gemini-2.5-flash",
    ]);

    expect(chain).toHaveLength(3);
    expect(chain[0]?.isLastResort).toBeFalsy();
    expect(chain[2]?.isLastResort).toBe(true);
  });

  it("resolves default actions and transitions from a policy", () => {
    const policy = createGeminiModelPolicy({
      model: "gemini-3.1-flash-lite-preview",
    });

    expect(resolveGeminiFailureAction(policy, "transient")).toBe("silent");
    expect(resolveGeminiFailureAction(policy, "unknown")).toBe("stop");
    expect(resolveGeminiFailureTransition(policy, "transient")).toBe(
      "sticky_retry",
    );
    expect(resolveGeminiFailureTransition(policy, "not_found")).toBe(
      "terminal",
    );
  });

  it("supports custom action and transition overrides", () => {
    const policy = createGeminiModelPolicy({
      actions: {
        unknown: "silent",
      },
      model: "gemini-3.1-flash-lite-preview",
      stateTransitions: {
        unknown: "terminal",
      },
    });

    expect(resolveGeminiFailureAction(policy, "unknown")).toBe("silent");
    expect(resolveGeminiFailureTransition(policy, "unknown")).toBe("terminal");
  });

  it("returns default policy when model is missing from chain", () => {
    const chain = buildGeminiModelPolicyChain(["gemini-3-flash-preview"]);
    const policy = resolveGeminiModelPolicy(chain, "gemini-missing-model");

    expect(policy.model).toBe("gemini-missing-model");
    expect(resolveGeminiFailureAction(policy, "unknown")).toBe("stop");
  });
});
