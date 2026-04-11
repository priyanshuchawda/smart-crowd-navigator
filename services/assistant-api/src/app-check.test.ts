import {
  type JsonWebKey,
  type KeyObject,
  generateKeyPairSync,
  sign,
} from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAppCheckService,
  getFirebaseProjectNumber,
  isAppCheckRequired,
} from "./app-check.js";

function toBase64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createJwt({
  kid,
  payload,
  privateKey,
}: {
  kid: string;
  payload: Record<string, unknown>;
  privateKey: KeyObject;
}) {
  const header = { alg: "RS256", kid, typ: "JWT" };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = sign(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    privateKey,
  );

  return `${encodedHeader}.${encodedPayload}.${toBase64Url(signature)}`;
}

describe("app check", () => {
  beforeEach(() => {
    process.env.APP_CHECK_ALLOWED_APP_IDS = undefined;
    process.env.APP_CHECK_REQUIRED = undefined;
    process.env.FIREBASE_PROJECT_NUMBER = "1234567890";
    process.env.VITE_FIREBASE_APP_ID = "1:1234567890:web:demoapp";
  });

  it("stays disabled by default", () => {
    expect(isAppCheckRequired()).toBe(false);
  });

  it("allows APP_CHECK_REQUIRED to force protection", () => {
    process.env.APP_CHECK_REQUIRED = "true";

    expect(isAppCheckRequired()).toBe(true);
    expect(getFirebaseProjectNumber()).toBe("1234567890");
  });

  it("verifies a valid App Check token", async () => {
    process.env.APP_CHECK_REQUIRED = "true";
    process.env.APP_CHECK_ALLOWED_APP_IDS = "1:1234567890:web:demoapp";
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const kid = "app-check-key-1";
    const now = Date.UTC(2026, 3, 11, 12, 0, 0);
    const token = createJwt({
      kid,
      payload: {
        aud: ["projects/1234567890"],
        exp: Math.floor(now / 1000) + 3600,
        iss: "https://firebaseappcheck.googleapis.com/1234567890",
        sub: "1:1234567890:web:demoapp",
      },
      privateKey,
    });

    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            keys: [
              {
                ...(publicKey.export({ format: "jwk" }) as JsonWebKey),
                kid,
              },
            ],
          }),
          {
            headers: {
              "cache-control": "public, max-age=3600",
              "content-type": "application/json",
            },
            status: 200,
          },
        ),
    );

    const appCheckService = createAppCheckService({
      fetchImpl: fetchImpl as typeof fetch,
      now: () => now,
    });
    const result = await appCheckService.requireToken({
      headers: {
        "x-firebase-appcheck": token,
      },
    } as never);

    expect(result).toMatchObject({
      appId: "1:1234567890:web:demoapp",
    });
  });

  it("rejects tokens from apps outside the allowlist", async () => {
    process.env.APP_CHECK_REQUIRED = "true";
    process.env.APP_CHECK_ALLOWED_APP_IDS = "1:1234567890:web:allowed-app";
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const kid = "app-check-key-2";
    const now = Date.UTC(2026, 3, 11, 12, 0, 0);
    const token = createJwt({
      kid,
      payload: {
        aud: ["projects/1234567890"],
        exp: Math.floor(now / 1000) + 3600,
        iss: "https://firebaseappcheck.googleapis.com/1234567890",
        sub: "1:1234567890:web:other-app",
      },
      privateKey,
    });

    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            keys: [
              {
                ...(publicKey.export({ format: "jwk" }) as JsonWebKey),
                kid,
              },
            ],
          }),
          {
            headers: {
              "cache-control": "public, max-age=3600",
              "content-type": "application/json",
            },
            status: 200,
          },
        ),
    );

    const appCheckService = createAppCheckService({
      fetchImpl: fetchImpl as typeof fetch,
      now: () => now,
    });

    await expect(
      appCheckService.requireToken({
        headers: {
          "x-firebase-appcheck": token,
        },
      } as never),
    ).rejects.toMatchObject({
      code: "app_check_forbidden",
      statusCode: 403,
    });
  });
});
