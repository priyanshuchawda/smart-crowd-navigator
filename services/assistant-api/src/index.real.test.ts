import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { afterEach, describe, expect, it } from "vitest";

import { createAppServer } from "./index.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(currentDir, "../../../.env") });

const maybeDescribe = process.env.GEMINI_API_KEY ? describe : describe.skip;

const activeServers = new Set<ReturnType<typeof createAppServer>>();

afterEach(async () => {
  await Promise.all(
    [...activeServers].map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            activeServers.delete(server);
            resolve();
          });
        }),
    ),
  );
}, 60_000);

async function startServer() {
  const server = createAppServer();
  activeServers.add(server);

  await new Promise<void>((resolve, reject) => {
    server.listen(0, () => resolve());
    server.once("error", reject);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected ephemeral TCP port");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

maybeDescribe("real Gemini API smoke", () => {
  it("returns a live Gemini-sourced assistant response", async () => {
    process.env.DISABLE_GEMINI_ASSISTANT = undefined;
    const { baseUrl } = await startServer();
    const response = await fetch(`${baseUrl}/assistant-response`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        section: "section-a12",
        intent: "food",
        partySize: 4,
        eventPhase: "break",
        mobilityMode: "standard",
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.source).toBe("gemini");
    expect(payload.recommendation?.intent).toBe("food");
  }, 300_000);
});
