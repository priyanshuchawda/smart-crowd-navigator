const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_INITIAL_DELAY_MS = 250;
const DEFAULT_MAX_DELAY_MS = 4_000;
const DEFAULT_JITTER_RATIO = 0.25;

const RETRYABLE_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "EPROTO",
  "ERR_SSL_WRONG_VERSION_NUMBER",
]);

type RetryGeminiCallOptions = {
  initialDelayMs?: number;
  jitterRatio?: number;
  maxAttempts?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
  randomFn?: () => number;
  shouldRetryError?: (error: unknown) => boolean;
  sleep?: (delayMs: number) => Promise<void>;
};

function defaultSleep(delayMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function readStatus(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return null;
}

function readRetryAfterSeconds(rawValue: string): number | null {
  const numericSeconds = Number(rawValue);

  if (Number.isFinite(numericSeconds) && numericSeconds > 0) {
    return Math.round(numericSeconds * 1_000);
  }

  const parsedDate = Date.parse(rawValue);

  if (!Number.isFinite(parsedDate)) {
    return null;
  }

  const delayMs = parsedDate - Date.now();
  return delayMs > 0 ? delayMs : null;
}

function readRetryAfterFromHeaders(headers: unknown): number | null {
  if (!headers || typeof headers !== "object") {
    return null;
  }

  if ("get" in headers && typeof headers.get === "function") {
    const retryAfter = headers.get("retry-after");

    if (typeof retryAfter === "string" && retryAfter.trim().length > 0) {
      return readRetryAfterSeconds(retryAfter.trim());
    }

    return null;
  }

  if ("retry-after" in headers && typeof headers["retry-after"] === "string") {
    return readRetryAfterSeconds(headers["retry-after"]);
  }

  return null;
}

function getErrorCode(error: unknown): string | null {
  let current: unknown = error;

  for (let depth = 0; depth < 5; depth += 1) {
    if (!current || typeof current !== "object") {
      return null;
    }

    if ("code" in current && typeof current.code === "string") {
      return current.code;
    }

    if (!("cause" in current)) {
      return null;
    }

    current = current.cause;
  }

  return null;
}

function getGeminiErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  if ("status" in error) {
    return readStatus(error.status);
  }

  if ("statusCode" in error) {
    return readStatus(error.statusCode);
  }

  return null;
}

function getGeminiRetryAfterMs(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  if ("retryAfterMs" in error) {
    const retryAfterMs = readStatus(error.retryAfterMs);
    return retryAfterMs && retryAfterMs > 0 ? retryAfterMs : null;
  }

  if ("retryAfter" in error && typeof error.retryAfter === "string") {
    return readRetryAfterSeconds(error.retryAfter.trim());
  }

  if ("headers" in error) {
    return readRetryAfterFromHeaders(error.headers);
  }

  return null;
}

function isRetryableGeminiTransportError(error: unknown) {
  const status = getGeminiErrorStatus(error);

  if (status !== null && [429, 499, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  const errorCode = getErrorCode(error);

  if (errorCode && RETRYABLE_NETWORK_CODES.has(errorCode)) {
    return true;
  }

  if (error instanceof Error) {
    const normalizedMessage = error.message.toLowerCase();

    return (
      normalizedMessage.includes("fetch failed") ||
      normalizedMessage.includes("incomplete json") ||
      normalizedMessage.includes("socket hang up")
    );
  }

  return false;
}

function calculateDelayMs({
  attempt,
  error,
  initialDelayMs,
  jitterRatio,
  maxDelayMs,
  randomFn,
}: {
  attempt: number;
  error: unknown;
  initialDelayMs: number;
  jitterRatio: number;
  maxDelayMs: number;
  randomFn: () => number;
}) {
  const exponentialBackoffMs = Math.min(
    maxDelayMs,
    initialDelayMs * 2 ** (attempt - 1),
  );
  const retryAfterMs = getGeminiRetryAfterMs(error);
  const floorMs = retryAfterMs
    ? Math.max(exponentialBackoffMs, retryAfterMs)
    : exponentialBackoffMs;

  if (jitterRatio <= 0) {
    return floorMs;
  }

  const jitterWindow = floorMs * jitterRatio;
  const jitterOffset = (randomFn() * 2 - 1) * jitterWindow;

  return Math.max(0, Math.round(floorMs + jitterOffset));
}

async function retryGeminiCall<T>(
  execute: () => Promise<T>,
  {
    initialDelayMs = DEFAULT_INITIAL_DELAY_MS,
    jitterRatio = DEFAULT_JITTER_RATIO,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    onRetry,
    randomFn = Math.random,
    shouldRetryError = isRetryableGeminiTransportError,
    sleep = defaultSleep,
  }: RetryGeminiCallOptions = {},
) {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    attempt += 1;

    try {
      return await execute();
    } catch (error) {
      lastError = error;

      if (!shouldRetryError(error) || attempt >= maxAttempts) {
        throw error;
      }

      const delayMs = calculateDelayMs({
        attempt,
        error,
        initialDelayMs,
        jitterRatio,
        maxDelayMs,
        randomFn,
      });

      onRetry?.(attempt, error, delayMs);
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gemini retry attempts exhausted");
}

export {
  getGeminiErrorStatus,
  getGeminiRetryAfterMs,
  isRetryableGeminiTransportError,
  retryGeminiCall,
};
