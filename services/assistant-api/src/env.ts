import { z } from "zod";

const runtimeEnvironmentSchema = z.object({
  APP_CHECK_REQUIRED: z.string().optional(),
  DISABLE_GEMINI_ASSISTANT: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_PROJECT_NUMBER: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  OPERATOR_AUTH_REQUIRED: z.string().optional(),
  VITE_FIREBASE_APPCHECK_SITE_KEY: z.string().optional(),
  VITE_FIREBASE_PROJECT_ID: z.string().optional(),
});

const placeholderGeminiKeys = new Set(["your_gemini_api_key_here"]);

function normalizeOptionalValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function isFlagEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

function validateRuntimeEnvironment(env: NodeJS.ProcessEnv) {
  const runtimeEnvironment = runtimeEnvironmentSchema.parse(env);
  const nodeEnv = runtimeEnvironment.NODE_ENV ?? "development";
  const geminiApiKey = normalizeOptionalValue(
    runtimeEnvironment.GEMINI_API_KEY,
  );
  const firebaseProjectId =
    normalizeOptionalValue(runtimeEnvironment.FIREBASE_PROJECT_ID) ??
    normalizeOptionalValue(runtimeEnvironment.VITE_FIREBASE_PROJECT_ID);
  const firebaseProjectNumber = normalizeOptionalValue(
    runtimeEnvironment.FIREBASE_PROJECT_NUMBER,
  );
  const appCheckRequired = isFlagEnabled(runtimeEnvironment.APP_CHECK_REQUIRED);
  const appCheckSiteKey = normalizeOptionalValue(
    runtimeEnvironment.VITE_FIREBASE_APPCHECK_SITE_KEY,
  );
  const operatorAuthRequired = isFlagEnabled(
    runtimeEnvironment.OPERATOR_AUTH_REQUIRED,
  );
  const geminiDisabled = isFlagEnabled(
    runtimeEnvironment.DISABLE_GEMINI_ASSISTANT,
  );

  if (
    nodeEnv === "production" &&
    !geminiDisabled &&
    (!geminiApiKey || placeholderGeminiKeys.has(geminiApiKey))
  ) {
    throw new Error(
      "Production requires GEMINI_API_KEY to be injected from env or Secret Manager.",
    );
  }

  if (nodeEnv === "production" && operatorAuthRequired && !firebaseProjectId) {
    throw new Error(
      "Production operator auth requires FIREBASE_PROJECT_ID (or VITE_FIREBASE_PROJECT_ID) to be injected from env.",
    );
  }

  if (nodeEnv === "production" && appCheckRequired && !firebaseProjectNumber) {
    throw new Error(
      "Production App Check requires FIREBASE_PROJECT_NUMBER to be injected from env.",
    );
  }

  if (nodeEnv === "production" && appCheckRequired && !appCheckSiteKey) {
    throw new Error(
      "Production App Check requires VITE_FIREBASE_APPCHECK_SITE_KEY for the web client.",
    );
  }

  return {
    appCheckRequired,
    appCheckSiteKey,
    firebaseProjectId,
    firebaseProjectNumber,
    geminiApiKey,
    geminiDisabled,
    nodeEnv,
    operatorAuthRequired,
  };
}

export { validateRuntimeEnvironment };
