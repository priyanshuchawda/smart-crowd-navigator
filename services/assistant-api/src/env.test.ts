import { describe, expect, it } from "vitest";

import { validateRuntimeEnvironment } from "./env.js";

describe("validateRuntimeEnvironment", () => {
  it("allows local development placeholders", () => {
    expect(
      validateRuntimeEnvironment({
        GEMINI_API_KEY: "your_gemini_api_key_here",
        NODE_ENV: "development",
      }),
    ).toMatchObject({
      geminiApiKey: "your_gemini_api_key_here",
      nodeEnv: "development",
    });
  });

  it("rejects production without a real Gemini API key", () => {
    expect(() =>
      validateRuntimeEnvironment({
        GEMINI_API_KEY: "your_gemini_api_key_here",
        NODE_ENV: "production",
      }),
    ).toThrow(
      "Production requires GEMINI_API_KEY to be injected from env or Secret Manager.",
    );
  });

  it("allows production when Gemini is intentionally disabled", () => {
    expect(
      validateRuntimeEnvironment({
        DISABLE_GEMINI_ASSISTANT: "true",
        NODE_ENV: "production",
      }),
    ).toMatchObject({
      geminiDisabled: true,
      nodeEnv: "production",
    });
  });

  it("requires a Firebase project id when production operator auth is enabled", () => {
    expect(() =>
      validateRuntimeEnvironment({
        GEMINI_API_KEY: "real-key",
        NODE_ENV: "production",
        OPERATOR_AUTH_REQUIRED: "true",
      }),
    ).toThrow(
      "Production operator auth requires FIREBASE_PROJECT_ID (or VITE_FIREBASE_PROJECT_ID) to be injected from env.",
    );
  });
});
