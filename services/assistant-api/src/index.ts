import { readFile } from "node:fs/promises";
import {
  type IncomingMessage,
  type ServerResponse,
  createServer,
} from "node:http";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { APP_NAME } from "@smart-crowd-navigator/shared";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

import {
  AppCheckError,
  type AppCheckService,
  createAppCheckService,
} from "./app-check.js";
import { validateRuntimeEnvironment } from "./env.js";
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
  getLiveVenueStateMetadata,
  getOperatorState,
  parseRecommendationRequest,
  resetOperatorState,
  syncLiveVenueState,
  updateOperatorState,
} from "./recommendation.js";
import {
  checkRateLimit,
  getClientKey,
  getRequestOrigin,
  isOriginAllowed,
  readJsonBody,
  resetRateLimitStore,
  respondJson,
} from "./request-utils.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(currentDir, "../../../.env") });
validateRuntimeEnvironment(process.env);

const port = Number(process.env.PORT ?? 8080);
const webDistDir = resolve(currentDir, "../../../apps/web/dist");
const staticAssetTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};
const operatorStateSchema = z.strictObject({
  nodeId: z.string().min(1),
  status: z.enum(["open", "limited", "closed"]).optional(),
  queueMinutes: z.number().int().nonnegative(),
  crowdPenalty: z.number().int().nonnegative(),
  queueTrendAfterFiveMinutes: z.number().int(),
  serviceMinutesPerAdditionalPerson: z.number().nonnegative(),
  telemetryConfidence: z
    .enum(["observed", "estimated", "predicted"])
    .optional(),
  waitTimeVariability: z.number().int().nonnegative().optional(),
});
const operatorBulkSchema = z.strictObject({
  states: z.array(operatorStateSchema),
});

type CreateAppServerOptions = {
  appCheckService?: AppCheckService;
  operatorAuthService?: OperatorAuthService;
};

type ObservabilityRecommendationPayload =
  | ReturnType<typeof buildRecommendationPayload>
  | ReturnType<typeof buildDeterministicAssistantResponse>["recommendation"];

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

function logRuntimeEvent(type: string, metadata: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      type,
      at: new Date().toISOString(),
      ...metadata,
    }),
  );
}

function logRecommendationObservability({
  channel,
  latencyMs,
  recommendation,
  requestPayload,
  source,
}: {
  channel: "assistant" | "recommendation";
  latencyMs: number;
  recommendation: ObservabilityRecommendationPayload;
  requestPayload: ReturnType<typeof parseRecommendationRequest>;
  source: "deterministic" | "deterministic-fallback" | "gemini";
}) {
  logRuntimeEvent("recommendation_observability", {
    advisorySeverity: recommendation.operationalAdvisory?.severity ?? "none",
    channel,
    confidence: recommendation.confidence,
    crowdPenalty: recommendation.crowdWarning ? 1 : 0,
    fallbackUsed: source === "deterministic-fallback",
    intent: requestPayload.intent,
    latencyMs,
    mapsGroundingUsed: false,
    primaryOptionId: recommendation.primaryOption.id,
    queueMinutes: recommendation.waitMinutes,
    scoreSummary: recommendation.primaryReason,
    source,
    timingDecision: recommendation.timingDecision,
  });
}

function logAssistantObservability({
  latencyMs,
  payload,
  requestPayload,
  source,
}: {
  latencyMs: number;
  payload: {
    grounding?: {
      places?: unknown[];
    };
    recommendation: ObservabilityRecommendationPayload;
  };
  requestPayload: ReturnType<typeof parseRecommendationRequest>;
  source: "deterministic-fallback" | "gemini";
}) {
  logRuntimeEvent("assistant_observability", {
    advisorySeverity:
      payload.recommendation.operationalAdvisory?.severity ?? "none",
    confidence: payload.recommendation.confidence,
    fallbackUsed: source === "deterministic-fallback",
    intent: requestPayload.intent,
    latencyMs,
    mapsGroundingUsed: Boolean(payload.grounding?.places?.length),
    primaryOptionId: payload.recommendation.primaryOption.id,
    queueMinutes: payload.recommendation.waitMinutes,
    source,
    timingDecision: payload.recommendation.timingDecision,
  });
}

async function readStaticFile(pathname: string) {
  const normalizedPath = pathname === "/" ? "/index.html" : pathname;
  const staticFilePath = resolve(webDistDir, `.${normalizedPath}`);

  if (!staticFilePath.startsWith(webDistDir)) {
    return null;
  }

  try {
    return {
      buffer: await readFile(staticFilePath),
      filePath: staticFilePath,
    };
  } catch {
    if (pathname.includes(".")) {
      return null;
    }

    try {
      return {
        buffer: await readFile(resolve(webDistDir, "index.html")),
        filePath: resolve(webDistDir, "index.html"),
      };
    } catch {
      return null;
    }
  }
}

async function serveStaticAsset(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
) {
  const staticFile = await readStaticFile(pathname);

  if (!staticFile) {
    return false;
  }

  response.writeHead(200, {
    "cache-control": pathname.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "no-cache",
    "content-type":
      staticAssetTypes[extname(staticFile.filePath)] ??
      "application/octet-stream",
  });

  if (request.method === "HEAD") {
    response.end();
    return true;
  }

  response.end(staticFile.buffer);
  return true;
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

async function requireAppCheck(
  request: IncomingMessage,
  response: ServerResponse,
  appCheckService: AppCheckService,
) {
  try {
    return await appCheckService.requireToken(request);
  } catch (error) {
    if (error instanceof AppCheckError) {
      respondJson(request, response, error.statusCode, {
        error: error.code,
        message: error.message,
      });
      return null;
    }

    respondJson(request, response, 500, {
      error: "app_check_failed",
      message: "Unable to verify App Check protection",
    });
    return null;
  }
}

function createRequestHandler({
  appCheckService = createAppCheckService(),
  operatorAuthService = createOperatorAuthService(),
}: CreateAppServerOptions = {}) {
  return async function requestHandler(
    request: IncomingMessage,
    response: ServerResponse,
  ) {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://localhost");

    // Serve explicit static assets early — paths with a file extension or the
    // root path.  API routes (no extension) fall through to the handlers below.
    const isExplicitAssetPath =
      url.pathname === "/" || url.pathname.split("/").pop()?.includes(".") === true;

    if (
      isExplicitAssetPath &&
      (method === "GET" || method === "HEAD") &&
      (await serveStaticAsset(request, response, url.pathname))
    ) {
      return;
    }

    const origin = getRequestOrigin(request);

    if (!isOriginAllowed(request, origin)) {
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
      respondJson(
        request,
        response,
        200,
        {
          service: `${APP_NAME} API`,
          status: "ok",
          engineVersion: engine.version,
          appCheckRequired: appCheckService.isRequired(),
          operatorAuthRequired: operatorAuthService.isRequired(),
        },
        {
          "cache-control": "public, max-age=3600",
        },
      );
      return;
    }

    if (method === "GET" && url.pathname === "/live-state/source") {
      respondJson(request, response, 200, getLiveVenueStateMetadata());
      return;
    }

    if (method === "GET" && url.pathname === "/operator/state") {
      respondJson(request, response, 200, {
        states: getOperatorState(),
      });
      return;
    }

    if (method === "POST" && url.pathname === "/operator/state") {
      const appCheck = await requireAppCheck(
        request,
        response,
        appCheckService,
      );

      if (appCheckService.isRequired() && !appCheck) {
        return;
      }

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
      const appCheck = await requireAppCheck(
        request,
        response,
        appCheckService,
      );

      if (appCheckService.isRequired() && !appCheck) {
        return;
      }

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
        const states = syncLiveVenueState(payload.states);

        auditOperatorMutation(request, "operator.state.bulk", {
          actor: operator?.actor,
          count: payload.states.length,
          role: operator?.role,
          uid: operator?.uid,
        });

        respondJson(request, response, 200, {
          states,
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
      const appCheck = await requireAppCheck(
        request,
        response,
        appCheckService,
      );

      if (appCheckService.isRequired() && !appCheck) {
        return;
      }

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
      const startedAt = Date.now();
      const appCheck = await requireAppCheck(
        request,
        response,
        appCheckService,
      );

      if (appCheckService.isRequired() && !appCheck) {
        return;
      }

      if (!checkRateLimit(request, "assistant")) {
        respondJson(request, response, 429, {
          error: "rate_limited",
        });
        return;
      }

      try {
        const requestBody = await readJsonBody(request);
        const typedRequestBody = parseRecommendationRequest(requestBody);
        const payload = buildRecommendationPayload(typedRequestBody);

        logRecommendationObservability({
          channel: "recommendation",
          latencyMs: Date.now() - startedAt,
          recommendation: payload,
          requestPayload: typedRequestBody,
          source: "deterministic",
        });

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
      const startedAt = Date.now();
      const appCheck = await requireAppCheck(
        request,
        response,
        appCheckService,
      );

      if (appCheckService.isRequired() && !appCheck) {
        return;
      }

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

      let validatedRequestBody: ReturnType<typeof parseRecommendationRequest>;

      try {
        validatedRequestBody = parseRecommendationRequest(requestBody);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Invalid request payload";

        respondJson(request, response, 400, {
          error: "bad_request",
          message,
        });
        return;
      }

      try {
        if (process.env.DISABLE_GEMINI_ASSISTANT === "true") {
          logRuntimeEvent("assistant_fallback", {
            reason: "disabled_by_env",
          });
          const payload =
            buildDeterministicAssistantResponse(validatedRequestBody);

          logAssistantObservability({
            latencyMs: Date.now() - startedAt,
            payload,
            requestPayload: validatedRequestBody,
            source: "deterministic-fallback",
          });

          respondJson(request, response, 200, {
            ...payload,
            source: "deterministic-fallback",
          });
          return;
        }

        const service = createGeminiAssistantService();
        const payload =
          await service.generateAssistantResponse(validatedRequestBody);

        logAssistantObservability({
          latencyMs: Date.now() - startedAt,
          payload,
          requestPayload: validatedRequestBody,
          source: "gemini",
        });

        respondJson(request, response, 200, payload);
        return;
      } catch (error) {
        logRuntimeEvent("assistant_fallback", {
          error:
            error instanceof Error ? error.message : "unknown_assistant_error",
          reason: "gemini_failure",
        });
        const payload =
          buildDeterministicAssistantResponse(validatedRequestBody);

        logAssistantObservability({
          latencyMs: Date.now() - startedAt,
          payload,
          requestPayload: validatedRequestBody,
          source: "deterministic-fallback",
        });

        respondJson(request, response, 200, {
          ...payload,
          source: "deterministic-fallback",
        });
        return;
      }
    }

    // SPA fallback — serve index.html for client-side routes that didn't match
    // any API handler above.
    if (
      (method === "GET" || method === "HEAD") &&
      (await serveStaticAsset(request, response, url.pathname))
    ) {
      return;
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

export {
  createAppServer,
  createRequestHandler,
  requestHandler,
  resetRateLimitStore,
  server,
};
