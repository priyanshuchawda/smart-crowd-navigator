import { afterEach, describe, expect, it } from "vitest";

import {
  assistantRecommendationSchema,
  recommendationRequestSchema,
} from "@smart-crowd-navigator/shared";

import { createAppServer } from "./index.js";

const activeServers = new Set<ReturnType<typeof createAppServer>>();

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

async function startServer() {
  const server = createAppServer();
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
      status: "ok",
      engineVersion: "0.2.0",
    });
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
});
