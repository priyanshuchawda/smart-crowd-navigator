import {
  type IncomingMessage,
  type ServerResponse,
  createServer,
} from "node:http";

import {
  APP_NAME,
  assistantRecommendationSchema,
  recommendationRequestSchema,
} from "@smart-crowd-navigator/shared";
import { createVenueEngine } from "@smart-crowd-navigator/venue-engine";

const port = Number(process.env.PORT ?? 8080);
const engine = createVenueEngine();

function respondJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function describeRoute(nodeIds: string[]) {
  return nodeIds
    .map(
      (nodeId) =>
        engine.fixture.nodes.find((node) => node.id === nodeId)?.label ??
        nodeId,
    )
    .join(" → ");
}

function buildRecommendationPayload(requestBody: unknown) {
  const input = recommendationRequestSchema.parse(requestBody);
  const engineInput = {
    sectionId: input.section,
    intent: input.intent,
    eventPhase: input.eventPhase,
    mobilityMode: input.mobilityMode,
  };
  const currentBest = engine.rankDestinations(engineInput)[0];
  const fallback = engine.getFallbackDestination(engineInput);
  const timingAdvice = engine.getTimingAdvice(engineInput);
  const selectedDestination =
    timingAdvice.decision === "wait"
      ? timingAdvice.projectedBest
      : timingAdvice.currentBest;

  if (!currentBest) {
    throw new Error("No recommendation candidates available");
  }

  const payload = assistantRecommendationSchema.parse({
    intent: input.intent,
    timingDecision: timingAdvice.decision,
    waitOrGoReason: timingAdvice.reason,
    primaryOption: {
      id: selectedDestination.destinationId,
      label: selectedDestination.label,
      kind: selectedDestination.kind,
    },
    primaryReason: `Best total score: ${selectedDestination.score.totalScore} minutes.`,
    etaMinutes: Math.round(selectedDestination.score.walkingMinutes),
    waitMinutes: selectedDestination.score.queueMinutes,
    timeSavedMinutes: timingAdvice.timeSavedMinutes,
    routeSummary: describeRoute(selectedDestination.route),
    crowdWarning:
      selectedDestination.score.crowdPenalty > 0
        ? "Crowd pressure is elevated on part of this route."
        : null,
    fallbackOption: fallback
      ? {
          id: fallback.destinationId,
          label: fallback.label,
          kind: fallback.kind,
        }
      : null,
    confidence: selectedDestination.score.totalScore <= 10 ? "high" : "medium",
  });

  return payload;
}

async function requestHandler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", "http://localhost");

  if (method === "GET" && url.pathname === "/health") {
    respondJson(response, 200, {
      service: `${APP_NAME} API`,
      status: "ok",
      engineVersion: engine.version,
    });
    return;
  }

  if (method === "POST" && url.pathname === "/recommendation") {
    try {
      const requestBody = await readJsonBody(request);
      const payload = buildRecommendationPayload(requestBody);

      respondJson(response, 200, payload);
      return;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid request payload";

      respondJson(response, 400, {
        error: "bad_request",
        message,
      });
      return;
    }
  }

  respondJson(response, 404, {
    error: "not_found",
  });
}

function createAppServer() {
  return createServer((request, response) => {
    void requestHandler(request, response);
  });
}

const server = createAppServer();

if (process.env.NODE_ENV !== "test") {
  server.listen(port, () => {
    console.log(`assistant-api listening on http://localhost:${port}`);
  });
}

export { buildRecommendationPayload, createAppServer, requestHandler, server };
