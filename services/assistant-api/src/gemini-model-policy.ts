import { getGeminiErrorStatus } from "./gemini-retry.js";

type GeminiFailureKind = "terminal" | "transient" | "not_found" | "unknown";
type GeminiFallbackAction = "silent" | "stop";
type GeminiModelHealthTransition =
  | "terminal"
  | "cooldown"
  | "sticky_retry"
  | "healthy";

type GeminiModelPolicyActionMap = Partial<
  Record<GeminiFailureKind, GeminiFallbackAction>
>;
type GeminiModelPolicyTransitionMap = Partial<
  Record<GeminiFailureKind, GeminiModelHealthTransition>
>;

type GeminiModelPolicy = {
  actions: GeminiModelPolicyActionMap;
  isLastResort?: boolean;
  model: string;
  stateTransitions: GeminiModelPolicyTransitionMap;
};

type GeminiModelPolicyChain = GeminiModelPolicy[];

type CreateGeminiModelPolicyOptions = {
  actions?: GeminiModelPolicyActionMap;
  isLastResort?: boolean;
  model: string;
  stateTransitions?: GeminiModelPolicyTransitionMap;
};

const RETRYABLE_STATUS_CODES = new Set([429, 499, 500, 502, 503, 504]);
const TERMINAL_STATUS_CODES = new Set([400, 401, 403, 410, 422]);
const MODEL_NOT_FOUND_MESSAGE_PATTERNS = [
  /model.+not found/i,
  /not found for api version/i,
  /model.+does not exist/i,
];
const TERMINAL_MODEL_MESSAGE_PATTERNS = [
  /unsupported model/i,
  /model.+not supported/i,
  /invalid model/i,
  /permission denied.+model/i,
];

const DEFAULT_POLICY_ACTIONS: Record<GeminiFailureKind, GeminiFallbackAction> =
  {
    terminal: "silent",
    transient: "silent",
    not_found: "silent",
    unknown: "stop",
  };
const DEFAULT_POLICY_TRANSITIONS: Record<
  GeminiFailureKind,
  GeminiModelHealthTransition
> = {
  terminal: "terminal",
  transient: "sticky_retry",
  not_found: "terminal",
  unknown: "healthy",
};

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.toLowerCase();
  }

  return "";
}

function classifyGeminiFailureKind(error: unknown): GeminiFailureKind {
  const status = getGeminiErrorStatus(error);
  const normalizedMessage = normalizeErrorMessage(error);

  if (
    status === 404 ||
    MODEL_NOT_FOUND_MESSAGE_PATTERNS.some((pattern) =>
      pattern.test(normalizedMessage),
    )
  ) {
    return "not_found";
  }

  if (
    (status !== null && RETRYABLE_STATUS_CODES.has(status)) ||
    normalizedMessage.includes("high demand") ||
    normalizedMessage.includes("resource exhausted") ||
    normalizedMessage.includes("temporarily unavailable") ||
    normalizedMessage.includes("service unavailable") ||
    normalizedMessage.includes("unavailable")
  ) {
    return "transient";
  }

  if (
    (status !== null && TERMINAL_STATUS_CODES.has(status)) ||
    TERMINAL_MODEL_MESSAGE_PATTERNS.some((pattern) =>
      pattern.test(normalizedMessage),
    )
  ) {
    return "terminal";
  }

  return "unknown";
}

function createGeminiModelPolicy({
  actions,
  isLastResort,
  model,
  stateTransitions,
}: CreateGeminiModelPolicyOptions): GeminiModelPolicy {
  return {
    actions: {
      ...DEFAULT_POLICY_ACTIONS,
      ...(actions ?? {}),
    },
    isLastResort,
    model,
    stateTransitions: {
      ...DEFAULT_POLICY_TRANSITIONS,
      ...(stateTransitions ?? {}),
    },
  };
}

function buildGeminiModelPolicyChain(
  modelChain: readonly string[],
): GeminiModelPolicyChain {
  return modelChain.map((model, index) =>
    createGeminiModelPolicy({
      isLastResort: index === modelChain.length - 1,
      model,
    }),
  );
}

function resolveGeminiModelPolicy(
  policyChain: GeminiModelPolicyChain,
  model: string,
): GeminiModelPolicy {
  const matchedPolicy = policyChain.find((policy) => policy.model === model);

  return matchedPolicy ?? createGeminiModelPolicy({ model });
}

function resolveGeminiFailureAction(
  policy: GeminiModelPolicy,
  failureKind: GeminiFailureKind,
): GeminiFallbackAction {
  return policy.actions[failureKind] ?? DEFAULT_POLICY_ACTIONS[failureKind];
}

function resolveGeminiFailureTransition(
  policy: GeminiModelPolicy,
  failureKind: GeminiFailureKind,
): GeminiModelHealthTransition {
  return (
    policy.stateTransitions[failureKind] ??
    DEFAULT_POLICY_TRANSITIONS[failureKind]
  );
}

export {
  buildGeminiModelPolicyChain,
  classifyGeminiFailureKind,
  createGeminiModelPolicy,
  resolveGeminiFailureAction,
  resolveGeminiFailureTransition,
  resolveGeminiModelPolicy,
};
export type {
  CreateGeminiModelPolicyOptions,
  GeminiFallbackAction,
  GeminiFailureKind,
  GeminiModelHealthTransition,
  GeminiModelPolicy,
  GeminiModelPolicyActionMap,
  GeminiModelPolicyChain,
  GeminiModelPolicyTransitionMap,
};
