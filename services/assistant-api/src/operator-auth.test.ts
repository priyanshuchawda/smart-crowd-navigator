import {
  type JsonWebKey,
  type KeyObject,
  generateKeyPairSync,
  sign,
} from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createOperatorAuthService,
  getFirebaseProjectId,
  isOperatorAuthRequired,
} from "./operator-auth.js";

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
  const header = {
    alg: "RS256",
    kid,
    typ: "JWT",
  };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = sign(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    privateKey,
  );

  return `${encodedHeader}.${encodedPayload}.${toBase64Url(signature)}`;
}

describe("operator auth", () => {
  beforeEach(() => {
    process.env.FIREBASE_PROJECT_ID = "stadium-demo";
    process.env.OPERATOR_ROLE_COLLECTION = "operator-roles";
    process.env.OPERATOR_AUTH_REQUIRED = undefined;
    process.env.NODE_ENV = "test";
  });

  it("disables auth by default in test environments", () => {
    expect(isOperatorAuthRequired()).toBe(false);
  });

  it("allows OPERATOR_AUTH_REQUIRED to force auth", () => {
    process.env.OPERATOR_AUTH_REQUIRED = "true";

    expect(isOperatorAuthRequired()).toBe(true);
    expect(getFirebaseProjectId()).toBe("stadium-demo");
  });

  it("verifies a Firebase token and operator role document", async () => {
    process.env.OPERATOR_AUTH_REQUIRED = "true";
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const kid = "test-key-1";
    const now = Date.UTC(2026, 3, 11, 4, 45, 0);
    const token = createJwt({
      kid,
      payload: {
        aud: "stadium-demo",
        auth_time: Math.floor(now / 1000) - 60,
        email: "operator@example.com",
        exp: Math.floor(now / 1000) + 3600,
        iat: Math.floor(now / 1000) - 60,
        iss: "https://securetoken.google.com/stadium-demo",
        sub: "operator-1",
        user_id: "operator-1",
      },
      privateKey,
    });

    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();

      if (url.includes("service_accounts")) {
        return new Response(
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
        );
      }

      if (url.includes("/documents/operator-roles/operator-1")) {
        return new Response(
          JSON.stringify({
            fields: {
              active: { booleanValue: true },
              role: { stringValue: "operator" },
            },
          }),
          {
            headers: {
              "content-type": "application/json",
            },
            status: 200,
          },
        );
      }

      return new Response("not-found", { status: 404 });
    });

    const authService = createOperatorAuthService({
      fetchImpl: fetchImpl as typeof fetch,
      now: () => now,
    });
    const operator = await authService.requireOperator({
      headers: {
        authorization: `Bearer ${token}`,
      },
    } as never);

    expect(operator).toMatchObject({
      actor: "operator@example.com",
      email: "operator@example.com",
      role: "operator",
      uid: "operator-1",
    });
  });

  it("rejects tokens without an active operator role", async () => {
    process.env.OPERATOR_AUTH_REQUIRED = "true";
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const kid = "test-key-2";
    const now = Date.UTC(2026, 3, 11, 4, 45, 0);
    const token = createJwt({
      kid,
      payload: {
        aud: "stadium-demo",
        auth_time: Math.floor(now / 1000) - 60,
        exp: Math.floor(now / 1000) + 3600,
        iat: Math.floor(now / 1000) - 60,
        iss: "https://securetoken.google.com/stadium-demo",
        sub: "attendee-1",
        user_id: "attendee-1",
      },
      privateKey,
    });

    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();

      if (url.includes("service_accounts")) {
        return new Response(
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
        );
      }

      return new Response("not-found", { status: 404 });
    });

    const authService = createOperatorAuthService({
      fetchImpl: fetchImpl as typeof fetch,
      now: () => now,
    });

    await expect(
      authService.requireOperator({
        headers: {
          authorization: `Bearer ${token}`,
        },
      } as never),
    ).rejects.toMatchObject({
      code: "operator_forbidden",
      statusCode: 403,
    });
  });
});
