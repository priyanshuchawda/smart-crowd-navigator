import "dotenv/config";

import {
  type IncomingMessage,
  type ServerResponse,
  createServer,
} from "node:http";

import { APP_NAME } from "@smart-crowd-navigator/shared";

import { createGeminiAssistantService } from "./gemini.js";
import { buildRecommendationPayload, engine } from "./recommendation.js";

const port = Number(process.env.PORT ?? 8080);

function respondJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
) {
  response.writeHead(statusCode, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
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

async function requestHandler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", "http://localhost");

  if (method === "OPTIONS") {
    respondJson(response, 204, {});
    return;
  }

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

  if (method === "POST" && url.pathname === "/assistant-response") {
    try {
      const requestBody = await readJsonBody(request);
      const service = createGeminiAssistantService();
      const payload = await service.generateAssistantResponse(requestBody);

      respondJson(response, 200, payload);
      return;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gemini assistant unavailable";

      respondJson(response, 503, {
        error: "assistant_unavailable",
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

export { createAppServer, requestHandler, server };
