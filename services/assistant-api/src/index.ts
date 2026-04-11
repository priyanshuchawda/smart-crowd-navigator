import {
  type IncomingMessage,
  type ServerResponse,
  createServer,
} from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { APP_NAME } from "@smart-crowd-navigator/shared";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

import { createGeminiAssistantService } from "./gemini.js";
import {
  OperatorAuthError,
  type OperatorAuthService,
  createOperatorAuthService,
} from "./operator-auth.js";
import {
  buildDeterministicAssistantResponse,
  buildRecommendationPayload,
  engine,
  getOperatorState,
  resetOperatorState,
  updateOperatorState,
} from "./recommendation.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(currentDir, "../../../.env") });

const port = Number(process.env.PORT ?? 8080);
const operatorStateSchema = z.strictObject({
  nodeId: z.string().min(1),
  queueMinutes: z.number().int().nonnegative(),
  crowdPenalty: z.number().int().nonnegative(),
  queueTrendAfterFiveMinutes: z.number().int(),
  serviceMinutesPerAdditionalPerson: z.number().nonnegative(),
});
const operatorBulkSchema = z.strictObject({
  states: z.array(operatorStateSchema),
});
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

type CreateAppServerOptions = {
  operatorAuthService?: OperatorAuthService;
};

function getAllowedOrigins() {
  return (
    process.env.ALLOWED_ORIGINS ??
    "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getMaxBodyBytes() {
  return Number(process.env.MAX_BODY_BYTES ?? 16_384);
}

function getRateLimitWindowMs() {
  return Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
}

function getRateLimitMax(bucket: "assistant" | "operator") {
  return bucket === "assistant"
    ? Number(process.env.RATE_LIMIT_MAX_ASSISTANT ?? 20)
    : Number(process.env.RATE_LIMIT_MAX_OPERATOR ?? 30);
}

function getRequestOrigin(request: IncomingMessage) {
  const originHeader = request.headers.origin;
  return typeof originHeader === "string" ? originHeader : null;
}

function isOriginAllowed(origin: string | null) {
  if (!origin) {
    return true;
  }

  return getAllowedOrigins().includes(origin);
}

function getCorsHeaders(request: IncomingMessage) {
  const allowedOrigins = getAllowedOrigins();
  const origin = getRequestOrigin(request);

  return {
    "content-type": "application/json",
    "access-control-allow-origin":
      origin && isOriginAllowed(origin) ? origin : (allowedOrigins[0] ?? "*"),
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "authorization,content-type",
  };
}

function getClientKey(request: IncomingMessage) {
  const forwardedFor = request.headers["x-forwarded-for"];
  const forwardedValue = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor;

  if (typeof forwardedValue === "string" && forwardedValue.length > 0) {
    return forwardedValue.split(",")[0]?.trim() ?? "unknown";
  }

  return request.socket.remoteAddress ?? "unknown";
}

function checkRateLimit(
  request: IncomingMessage,
  bucket: "assistant" | "operator",
) {
  const maxRequests = getRateLimitMax(bucket);
  const windowMs = getRateLimitWindowMs();
  const key = `${bucket}:${getClientKey(request)}`;
  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  if (current.count >= maxRequests) {
    return false;
  }

  current.count += 1;
  rateLimitStore.set(key, current);
  return true;
}

function auditOperatorMutation(
  request: IncomingMessage,
  action: string,
  metadata: Record<string, unknown>,
) {
  console.info(
    JSON.stringify({
      type: "operator_audit",
      action,
      at: new Date().toISOString(),
      actor: metadata.actor ?? getClientKey(request),
      ...metadata,
    }),
  );
}

function respondJson(
  request: IncomingMessage,
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
) {
  response.writeHead(statusCode, getCorsHeaders(request));
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;

    if (totalBytes > getMaxBodyBytes()) {
      throw new Error("Request body too large");
    }

    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function requireOperator(
  request: IncomingMessage,
  response: ServerResponse,
  operatorAuthService: OperatorAuthService,
) {
  try {
    return await operatorAuthService.requireOperator(request);
  } catch (error) {
    if (error instanceof OperatorAuthError) {
      respondJson(request, response, error.statusCode, {
        error: error.code,
        message: error.message,
      });
      return null;
    }

    respondJson(request, response, 500, {
      error: "operator_auth_failed",
      message: "Unable to verify operator access",
    });
    return null;
  }
}

function createRequestHandler({
  operatorAuthService = createOperatorAuthService(),
}: CreateAppServerOptions = {}) {
  return async function requestHandler(
    request: IncomingMessage,
    response: ServerResponse,
  ) {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://localhost");
    const origin = getRequestOrigin(request);

    if (!isOriginAllowed(origin)) {
      respondJson(request, response, 403, {
        error: "forbidden_origin",
      });
      return;
    }

    if (method === "OPTIONS") {
      respondJson(request, response, 204, {});
      return;
    }

    if (method === "GET" && url.pathname === "/health") {
      respondJson(request, response, 200, {
        service: `${APP_NAME} API`,
        status: "ok",
        engineVersion: engine.version,
        operatorAuthRequired: operatorAuthService.isRequired(),
      });
      return;
    }

    if (method === "GET" && url.pathname === "/operator/state") {
      respondJson(request, response, 200, {
        states: getOperatorState(),
      });
      return;
    }

    if (method === "POST" && url.pathname === "/operator/state") {
      if (!checkRateLimit(request, "operator")) {
        respondJson(request, response, 429, {
          error: "rate_limited",
        });
        return;
      }

      const operator = await requireOperator(
        request,
        response,
        operatorAuthService,
      );

      if (operatorAuthService.isRequired() && !operator) {
        return;
      }

      try {
        const requestBody = await readJsonBody(request);
        const payload = operatorStateSchema.parse(requestBody);
        const states = updateOperatorState(payload);
        auditOperatorMutation(request, "operator.state.update", {
          actor: operator?.actor,
          nodeId: payload.nodeId,
          role: operator?.role,
          uid: operator?.uid,
        });

        respondJson(request, response, 200, {
          states,
        });
        return;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Invalid operator payload";

        respondJson(
          request,
          response,
          message === "Request body too large" ? 413 : 400,
          {
            error: "bad_request",
            message,
          },
        );
        return;
      }
    }

    if (method === "POST" && url.pathname === "/operator/state/bulk") {
      if (!checkRateLimit(request, "operator")) {
        respondJson(request, response, 429, {
          error: "rate_limited",
        });
        return;
      }

      const operator = await requireOperator(
        request,
        response,
        operatorAuthService,
      );

      if (operatorAuthService.isRequired() && !operator) {
        return;
      }

      try {
        const requestBody = await readJsonBody(request);
        const payload = operatorBulkSchema.parse(requestBody);

        for (const state of payload.states) {
          updateOperatorState(state);
        }

        auditOperatorMutation(request, "operator.state.bulk", {
          actor: operator?.actor,
          count: payload.states.length,
          role: operator?.role,
          uid: operator?.uid,
        });

        respondJson(request, response, 200, {
          states: getOperatorState(),
        });
        return;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Invalid operator bulk payload";

        respondJson(
          request,
          response,
          message === "Request body too large" ? 413 : 400,
          {
            error: "bad_request",
            message,
          },
        );
        return;
      }
    }

    if (method === "POST" && url.pathname === "/operator/reset") {
      if (!checkRateLimit(request, "operator")) {
        respondJson(request, response, 429, {
          error: "rate_limited",
        });
        return;
      }

      const operator = await requireOperator(
        request,
        response,
        operatorAuthService,
      );

      if (operatorAuthService.isRequired() && !operator) {
        return;
      }

      auditOperatorMutation(request, "operator.state.reset", {
        actor: operator?.actor,
        role: operator?.role,
        uid: operator?.uid,
      });

      respondJson(request, response, 200, {
        states: resetOperatorState(),
      });
      return;
    }

    if (method === "POST" && url.pathname === "/recommendation") {
      try {
        const requestBody = await readJsonBody(request);
        const payload = buildRecommendationPayload(requestBody);

        respondJson(request, response, 200, payload);
        return;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Invalid request payload";

        respondJson(
          request,
          response,
          message === "Request body too large" ? 413 : 400,
          {
            error: "bad_request",
            message,
          },
        );
        return;
      }
    }

    if (method === "POST" && url.pathname === "/assistant-response") {
      if (!checkRateLimit(request, "assistant")) {
        respondJson(request, response, 429, {
          error: "rate_limited",
        });
        return;
      }

      let requestBody: unknown;

      try {
        requestBody = await readJsonBody(request);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Invalid request payload";

        respondJson(
          request,
          response,
          message === "Request body too large" ? 413 : 400,
          {
            error: "bad_request",
            message,
          },
        );
        return;
      }

      try {
        if (process.env.DISABLE_GEMINI_ASSISTANT === "true") {
          respondJson(request, response, 200, {
            ...buildDeterministicAssistantResponse(requestBody),
            source: "deterministic-fallback",
          });
          return;
        }

        const service = createGeminiAssistantService();
        const payload = await service.generateAssistantResponse(requestBody);

        respondJson(request, response, 200, payload);
        return;
      } catch {
        const payload = buildDeterministicAssistantResponse(requestBody);

        respondJson(request, response, 200, {
          ...payload,
          source: "deterministic-fallback",
        });
        return;
      }
    }

    respondJson(request, response, 404, {
      error: "not_found",
    });
  };
}

function createAppServer(options?: CreateAppServerOptions) {
  const requestHandler = createRequestHandler(options);

  return createServer((request, response) => {
    void requestHandler(request, response);
  });
}

const requestHandler = createRequestHandler();
const server = createAppServer();

if (process.env.NODE_ENV !== "test") {
  server.listen(port, () => {
    console.log(`assistant-api listening on http://localhost:${port}`);
  });
}

export { createAppServer, createRequestHandler, requestHandler, server };
