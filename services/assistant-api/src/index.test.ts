import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assistantRecommendationSchema,
  recommendationRequestSchema,
} from "@smart-crowd-navigator/shared";

import { AppCheckError, type AppCheckService } from "./app-check.js";
import { createAppServer, resetRateLimitStore } from "./index.js";
import {
  OperatorAuthError,
  type OperatorAuthService,
} from "./operator-auth.js";
import { resetOperatorState, updateOperatorState } from "./recommendation.js";

const activeServers = new Set<ReturnType<typeof createAppServer>>();
const currentDir = dirname(fileURLToPath(import.meta.url));
const webDistDir = resolve(currentDir, "../../../apps/web/dist");

beforeEach(() => {
  process.env.DISABLE_GEMINI_ASSISTANT = undefined;
  process.env.APP_CHECK_REQUIRED = undefined;
  process.env.MAX_BODY_BYTES = undefined;
  process.env.RATE_LIMIT_WINDOW_MS = undefined;
  process.env.RATE_LIMIT_MAX_ASSISTANT = undefined;
  process.env.RATE_LIMIT_MAX_OPERATOR = undefined;
  process.env.OPERATOR_AUTH_REQUIRED = undefined;
  resetRateLimitStore();
  resetOperatorState();
});

afterEach(async () => {
  await Promise.all(
    [...activeServers].map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            const typedError = error as Error | undefined;
            if (typedError) {
              reject(typedError);
              return;
            }

            activeServers.delete(server);
            resolve();
          });
        }),
    ),
  );
});

async function startServer(options?: {
  appCheckService?: AppCheckService;
  operatorAuthService?: OperatorAuthService;
}) {
  const server = createAppServer(options);
  activeServers.add(server);

  await new Promise<void>((resolve, reject) => {
    server.listen(0, () => resolve());
    server.once("error", reject);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected an ephemeral TCP port");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

describe("assistant API", () => {
  it("returns health metadata", async () => {
    const { baseUrl } = await startServer();
    const response = await fetch(`${baseUrl}/health`);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      appCheckRequired: false,
      status: "ok",
      engineVersion: "0.2.0",
      operatorAuthRequired: false,
    });
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("strict-transport-security")).toContain(
      "max-age=31536000",
    );
  });

  it("serves the built web shell from the root path", async () => {
    const indexPath = resolve(webDistDir, "index.html");
    let createdFixture = false;

    try {
      await access(indexPath);
    } catch {
      createdFixture = true;
      await mkdir(webDistDir, { recursive: true });
      await writeFile(
        indexPath,
        "<!doctype html><html><body>Smart Crowd Navigator</body></html>",
      );
    }

    const { baseUrl } = await startServer();
    const response = await fetch(`${baseUrl}/`);
    const markup = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(markup).toContain("Smart Crowd Navigator");

    if (createdFixture) {
      await rm(webDistDir, { force: true, recursive: true });
    }
  });

  it("returns a structured recommendation payload", async () => {
    const { baseUrl } = await startServer();
    const requestPayload = recommendationRequestSchema.parse({
      section: "section-a12",
      intent: "food",
      partySize: 3,
      eventPhase: "break",
      mobilityMode: "standard",
    });

    const response = await fetch(`${baseUrl}/recommendation`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(assistantRecommendationSchema.safeParse(payload).success).toBe(true);
    expect(payload.primaryOption.id).toBe("stall-b");
    expect(response.headers.get("cache-control")).toBe("no-cache, no-store");
  });

  it("returns a group coordinator plan for larger food groups", async () => {
    const { baseUrl } = await startServer();
    const response = await fetch(`${baseUrl}/recommendation`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        section: "section-a12",
        intent: "food",
        partySize: 5,
        eventPhase: "break",
        mobilityMode: "standard",
        groupWorkflow: "runner-pickup",
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.groupPlan.workflowType).toBe("runner-pickup");
  });

  it("rejects invalid recommendation requests", async () => {
    const { baseUrl } = await startServer();
    const response = await fetch(`${baseUrl}/recommendation`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        section: "section-a12",
        intent: "parking",
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("bad_request");
  });

  it("rejects invalid assistant-response requests without crashing the server", async () => {
    const { baseUrl } = await startServer();

    const invalidResponse = await fetch(`${baseUrl}/assistant-response`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        invalid: true,
      }),
    });
    const invalidPayload = await invalidResponse.json();

    expect(invalidResponse.status).toBe(400);
    expect(invalidPayload.error).toBe("bad_request");

    const healthResponse = await fetch(`${baseUrl}/health`);
    const healthPayload = await healthResponse.json();

    expect(healthResponse.status).toBe(200);
    expect(healthPayload.status).toBe("ok");
  });

  it("accepts typed follow-up requests with conversation history", async () => {
    process.env.DISABLE_GEMINI_ASSISTANT = "true";

    const { baseUrl } = await startServer();
    const response = await fetch(`${baseUrl}/assistant-response`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        section: "section-a12",
        intent: "food",
        partySize: 3,
        eventPhase: "break",
        mobilityMode: "standard",
        question: "Why is that the best food option?",
        conversationHistory: [
          {
            role: "user",
            text: "Which food option is best right now?",
          },
          {
            role: "assistant",
            text: "Use Stall B. Waiting 5 minutes reduces the predicted total trip cost by 3 minutes.",
          },
        ],
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.source).toBe("deterministic-fallback");
    expect(payload.message).toContain("Best total score");
  });

  it("returns and updates operator state", async () => {
    const { baseUrl } = await startServer();

    const initialResponse = await fetch(`${baseUrl}/operator/state`);
    const initialPayload = await initialResponse.json();

    expect(initialResponse.status).toBe(200);
    expect(initialPayload.states.length).toBeGreaterThan(0);

    const updateResponse = await fetch(`${baseUrl}/operator/state`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        nodeId: "stall-b",
        queueMinutes: 1,
        crowdPenalty: 0,
        queueTrendAfterFiveMinutes: 0,
        serviceMinutesPerAdditionalPerson: 2,
      }),
    });
    const updatePayload = await updateResponse.json();

    expect(updateResponse.status).toBe(200);
    expect(
      updatePayload.states.find(
        (state: { nodeId: string }) => state.nodeId === "stall-b",
      )?.queueMinutes,
    ).toBe(1);
  });

  it("requires authenticated operator access for operator mutations when enabled", async () => {
    const operatorAuthService: OperatorAuthService = {
      isRequired: () => true,
      requireOperator: vi
        .fn()
        .mockRejectedValue(
          new OperatorAuthError(
            401,
            "operator_auth_required",
            "Operator authentication is required",
          ),
        ),
    };
    const { baseUrl } = await startServer({ operatorAuthService });

    const response = await fetch(`${baseUrl}/operator/state`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        nodeId: "stall-b",
        queueMinutes: 1,
        crowdPenalty: 0,
        queueTrendAfterFiveMinutes: 0,
        serviceMinutesPerAdditionalPerson: 2,
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("operator_auth_required");
  });

  it("requires App Check for protected endpoints when enabled", async () => {
    const appCheckService: AppCheckService = {
      isRequired: () => true,
      requireToken: vi
        .fn()
        .mockRejectedValue(
          new AppCheckError(
            401,
            "app_check_required",
            "App Check token is required",
          ),
        ),
    };
    const { baseUrl } = await startServer({ appCheckService });

    const response = await fetch(`${baseUrl}/assistant-response`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        section: "section-a12",
        intent: "food",
        partySize: 3,
        eventPhase: "break",
        mobilityMode: "standard",
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("app_check_required");
  });

  it("accepts protected requests with a verified App Check token", async () => {
    process.env.DISABLE_GEMINI_ASSISTANT = "true";
    const appCheckService: AppCheckService = {
      isRequired: () => true,
      requireToken: vi.fn().mockResolvedValue({
        appId: "1:1234567890:web:demoapp",
      }),
    };
    const { baseUrl } = await startServer({ appCheckService });

    const response = await fetch(`${baseUrl}/assistant-response`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-firebase-appcheck": "valid-app-check-token",
      },
      body: JSON.stringify({
        section: "section-a12",
        intent: "food",
        partySize: 3,
        eventPhase: "break",
        mobilityMode: "standard",
      }),
    });

    expect(response.status).toBe(200);
  });

  it("accepts operator mutations with an authorized operator service", async () => {
    const operatorAuthService: OperatorAuthService = {
      isRequired: () => true,
      requireOperator: vi.fn().mockResolvedValue({
        actor: "operator@example.com",
        email: "operator@example.com",
        role: "operator",
        uid: "operator-1",
      }),
    };
    const { baseUrl } = await startServer({ operatorAuthService });

    const response = await fetch(`${baseUrl}/operator/state/bulk`, {
      method: "POST",
      headers: {
        authorization: "Bearer valid-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        states: [
          {
            nodeId: "stall-b",
            queueMinutes: 6,
            crowdPenalty: 1,
            queueTrendAfterFiveMinutes: -2,
            serviceMinutesPerAdditionalPerson: 2,
          },
        ],
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.states[0].nodeId).toBe("stall-b");
  });

  it("accepts a bulk operator state sync payload", async () => {
    const { baseUrl } = await startServer();
    const response = await fetch(`${baseUrl}/operator/state/bulk`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        states: [
          {
            nodeId: "stall-b",
            queueMinutes: 6,
            crowdPenalty: 1,
            queueTrendAfterFiveMinutes: -2,
            serviceMinutesPerAdditionalPerson: 2,
          },
        ],
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.states[0].nodeId).toBe("stall-b");
  });

  it("rejects disallowed origins", async () => {
    const { baseUrl } = await startServer();
    const response = await fetch(`${baseUrl}/health`, {
      headers: {
        origin: "https://evil.example.com",
      },
    });

    expect(response.status).toBe(403);
  });

  it("rejects oversized request bodies", async () => {
    const { baseUrl } = await startServer();
    process.env.MAX_BODY_BYTES = "10";
    const response = await fetch(`${baseUrl}/recommendation`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        section: "section-a12",
        intent: "food",
        partySize: 3,
        eventPhase: "break",
        mobilityMode: "standard",
      }),
    });

    expect(response.status).toBe(413);
  });

  it("rate limits assistant requests when configured aggressively", async () => {
    const { baseUrl } = await startServer();
    process.env.DISABLE_GEMINI_ASSISTANT = "true";
    process.env.RATE_LIMIT_WINDOW_MS = "60000";
    process.env.RATE_LIMIT_MAX_ASSISTANT = "1";

    const requestBody = {
      section: "section-a12",
      intent: "food",
      partySize: 3,
      eventPhase: "break",
      mobilityMode: "standard",
    };

    const first = await fetch(`${baseUrl}/assistant-response`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    const second = await fetch(`${baseUrl}/assistant-response`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
  });

  it("emits a structured log when deterministic fallback is forced", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { baseUrl } = await startServer();
    process.env.DISABLE_GEMINI_ASSISTANT = "true";

    const response = await fetch(`${baseUrl}/assistant-response`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        section: "section-a12",
        intent: "food",
        partySize: 3,
        eventPhase: "break",
        mobilityMode: "standard",
      }),
    });

    expect(response.status).toBe(200);
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('"type":"assistant_fallback"'),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('"reason":"disabled_by_env"'),
    );

    infoSpy.mockRestore();
  });

  it("sets dynamic cache headers for assistant responses", async () => {
    process.env.DISABLE_GEMINI_ASSISTANT = "true";
    const { baseUrl } = await startServer();

    const response = await fetch(`${baseUrl}/assistant-response`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        section: "section-a12",
        intent: "food",
        partySize: 3,
        eventPhase: "break",
        mobilityMode: "standard",
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-cache, no-store");
  });

  it("compresses recommendation responses when gzip is requested", async () => {
    const { baseUrl } = await startServer();
    const response = await fetch(`${baseUrl}/recommendation`, {
      method: "POST",
      headers: {
        "accept-encoding": "gzip",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        section: "section-a12",
        intent: "food",
        partySize: 3,
        eventPhase: "break",
        mobilityMode: "standard",
      }),
    });
    const payload = (await response.json()) as {
      primaryOption: { id: string };
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("content-encoding")).toBe("gzip");
    expect(response.headers.get("cache-control")).toBe("no-cache, no-store");
    expect(payload.primaryOption.id).toBe("stall-b");
  });

  it("does not compress recommendation responses when gzip is not requested", async () => {
    const { baseUrl } = await startServer();
    const response = await fetch(`${baseUrl}/recommendation`, {
      method: "POST",
      headers: {
        "accept-encoding": "identity",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        section: "section-a12",
        intent: "food",
        partySize: 3,
        eventPhase: "break",
        mobilityMode: "standard",
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-encoding")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-cache, no-store");
    expect(payload.primaryOption.id).toBe("stall-b");
  });

  it("returns valid recommendation responses for all supported intents", async () => {
    const { baseUrl } = await startServer();
    const intents = ["food", "washroom", "entry-gate", "exit"] as const;

    for (const intent of intents) {
      const response = await fetch(`${baseUrl}/recommendation`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          section: "section-a12",
          intent,
          partySize: 3,
          eventPhase: "break",
          mobilityMode: "standard",
        }),
      });
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(assistantRecommendationSchema.safeParse(payload).success).toBe(
        true,
      );
      expect(payload.intent).toBe(intent);
    }
  });

  it("changes recommendation output when operator state changes", async () => {
    const { baseUrl } = await startServer();
    process.env.DISABLE_GEMINI_ASSISTANT = "true";

    const baselineResponse = await fetch(`${baseUrl}/assistant-response`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        section: "section-a12",
        intent: "food",
        partySize: 3,
        eventPhase: "break",
        mobilityMode: "standard",
      }),
    });
    const baselinePayload = await baselineResponse.json();

    updateOperatorState({
      nodeId: "stall-b",
      queueMinutes: 20,
      crowdPenalty: 4,
      queueTrendAfterFiveMinutes: 0,
      serviceMinutesPerAdditionalPerson: 2,
    });

    const changedResponse = await fetch(`${baseUrl}/assistant-response`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        section: "section-a12",
        intent: "food",
        partySize: 3,
        eventPhase: "break",
        mobilityMode: "standard",
      }),
    });
    const changedPayload = await changedResponse.json();

    expect(baselineResponse.status).toBe(200);
    expect(changedResponse.status).toBe(200);
    expect(baselinePayload.recommendation.primaryOption.id).toBe("stall-b");
    expect(changedPayload.recommendation.primaryOption.id).toBe("stall-d");
  });
});
