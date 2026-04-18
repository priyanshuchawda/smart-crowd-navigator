import {
  getGeminiErrorStatus,
  getGeminiRetryAfterMs,
  isRetryableGeminiTransportError,
} from "./gemini-retry.js";
import type { GeminiModelHealthTransition } from "./gemini-model-policy.js";

const DEFAULT_MODEL_COOLDOWN_MS = 45_000;

const TERMINAL_MODEL_MESSAGE_PATTERNS = [
  /model.+not found/i,
  /not found for api version/i,
  /unsupported model/i,
  /model.+not supported/i,
  /invalid model/i,
  /permission denied.+model/i,
  /model.+does not exist/i,
];

type GeminiModelHealthStatus = "healthy" | "cooldown" | "terminal";

type GeminiModelHealth = {
  cooldownRemainingMs?: number;
  reason?: string;
  status: GeminiModelHealthStatus;
  updatedAtMs: number;
};

type SelectFirstAvailableModelOptions = {
  attemptedModels?: ReadonlySet<string>;
};

type MarkModelFailureOptions = {
  transition?: GeminiModelHealthTransition;
};

type GeminiModelAvailabilityService = {
  getModelHealth: (model: string) => GeminiModelHealth;
  markModelFailure: (
    model: string,
    error: unknown,
    options?: MarkModelFailureOptions,
  ) => void;
  markModelSuccess: (model: string) => void;
  reset: () => void;
  selectFirstAvailableModel: (
    modelChain: readonly string[],
    options?: SelectFirstAvailableModelOptions,
  ) => string | undefined;
};

type CreateGeminiModelAvailabilityServiceOptions = {
  cooldownMs?: number;
  isTerminalModelError?: (error: unknown) => boolean;
  isTransientModelError?: (error: unknown) => boolean;
  now?: () => number;
};

type ModelState =
  | {
      availableAfterMs: number;
      reason?: string;
      status: "cooldown";
      updatedAtMs: number;
    }
  | {
      reason?: string;
      status: "terminal";
      updatedAtMs: number;
    };

function readErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return undefined;
}

function isTerminalGeminiModelError(error: unknown) {
  const status = getGeminiErrorStatus(error);

  if (status !== null && [400, 404, 410, 422].includes(status)) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return TERMINAL_MODEL_MESSAGE_PATTERNS.some((pattern) =>
    pattern.test(error.message),
  );
}

function defaultTransientModelError(error: unknown) {
  if (isRetryableGeminiTransportError(error)) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.toLowerCase();

  return (
    normalizedMessage.includes("high demand") ||
    normalizedMessage.includes("resource exhausted") ||
    normalizedMessage.includes("temporarily unavailable") ||
    normalizedMessage.includes("service unavailable")
  );
}

function inferModelHealthTransition({
  error,
  isTerminalModelError,
  isTransientModelError,
}: {
  error: unknown;
  isTerminalModelError: (error: unknown) => boolean;
  isTransientModelError: (error: unknown) => boolean;
}): GeminiModelHealthTransition {
  if (isTerminalModelError(error)) {
    return "terminal";
  }

  if (isTransientModelError(error)) {
    return "cooldown";
  }

  return "healthy";
}

function createGeminiModelAvailabilityService({
  cooldownMs = DEFAULT_MODEL_COOLDOWN_MS,
  isTerminalModelError = isTerminalGeminiModelError,
  isTransientModelError = defaultTransientModelError,
  now = () => Date.now(),
}: CreateGeminiModelAvailabilityServiceOptions = {}): GeminiModelAvailabilityService {
  const modelStates = new Map<string, ModelState>();

  function resolveModelState(model: string) {
    const state = modelStates.get(model);

    if (!state) {
      return undefined;
    }

    if (state.status !== "cooldown") {
      return state;
    }

    if (state.availableAfterMs > now()) {
      return state;
    }

    modelStates.delete(model);
    return undefined;
  }

  function selectFirstAvailableModel(
    modelChain: readonly string[],
    options: SelectFirstAvailableModelOptions = {},
  ) {
    const attemptedModels = options.attemptedModels;

    for (const model of modelChain) {
      if (attemptedModels?.has(model)) {
        continue;
      }

      const state = resolveModelState(model);

      if (state?.status === "terminal" || state?.status === "cooldown") {
        continue;
      }

      return model;
    }

    return undefined;
  }

  function markModelSuccess(model: string) {
    modelStates.delete(model);
  }

  function markModelFailure(
    model: string,
    error: unknown,
    options: MarkModelFailureOptions = {},
  ) {
    const nowMs = now();

    const transition =
      options.transition ??
      inferModelHealthTransition({
        error,
        isTerminalModelError,
        isTransientModelError,
      });

    if (transition === "terminal") {
      modelStates.set(model, {
        reason: readErrorMessage(error),
        status: "terminal",
        updatedAtMs: nowMs,
      });
      return;
    }

    if (transition === "cooldown") {
      const retryAfterMs = getGeminiRetryAfterMs(error);
      const appliedCooldownMs = Math.max(cooldownMs, retryAfterMs ?? 0);

      modelStates.set(model, {
        availableAfterMs: nowMs + appliedCooldownMs,
        reason: readErrorMessage(error),
        status: "cooldown",
        updatedAtMs: nowMs,
      });
      return;
    }

    modelStates.delete(model);
  }

  function getModelHealth(model: string): GeminiModelHealth {
    const state = resolveModelState(model);
    const nowMs = now();

    if (!state) {
      return {
        status: "healthy",
        updatedAtMs: nowMs,
      };
    }

    if (state.status === "terminal") {
      return {
        reason: state.reason,
        status: state.status,
        updatedAtMs: state.updatedAtMs,
      };
    }

    return {
      cooldownRemainingMs: Math.max(0, state.availableAfterMs - nowMs),
      reason: state.reason,
      status: state.status,
      updatedAtMs: state.updatedAtMs,
    };
  }

  function reset() {
    modelStates.clear();
  }

  return {
    getModelHealth,
    markModelFailure,
    markModelSuccess,
    reset,
    selectFirstAvailableModel,
  };
}

export {
  DEFAULT_MODEL_COOLDOWN_MS,
  createGeminiModelAvailabilityService,
  isTerminalGeminiModelError,
};
export type {
  CreateGeminiModelAvailabilityServiceOptions,
  GeminiModelAvailabilityService,
  GeminiModelHealth,
  GeminiModelHealthStatus,
};
