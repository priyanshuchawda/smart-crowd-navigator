import type {
  IncomingHttpHeaders,
  IncomingMessage,
  ServerResponse,
} from "node:http";
import { Readable } from "node:stream";
import { gunzipSync } from "node:zlib";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkRateLimit,
  getClientKey,
  isOriginAllowed,
  readJsonBody,
  resetRateLimitStore,
  respondJson,
} from "./request-utils.js";

function createRequest({
  chunks = [],
  encrypted = false,
  headers = {},
  remoteAddress = "127.0.0.1",
}: {
  chunks?: string[];
  encrypted?: boolean;
  headers?: IncomingHttpHeaders;
  remoteAddress?: string;
} = {}) {
  const stream = Readable.from(chunks) as IncomingMessage;
  stream.headers = headers;
  Object.defineProperty(stream, "socket", {
    value: {
      encrypted,
      remoteAddress,
    } as unknown as IncomingMessage["socket"],
    writable: true,
  });

  return stream;
}

function createResponseDouble() {
  let body: Buffer | string | undefined;
  let headers: Record<string, string> = {};
  let statusCode = 0;
  const response = {
    end: vi.fn((payload?: Buffer | string) => {
      body = payload;
    }),
    writeHead: vi.fn(
      (nextStatusCode: number, nextHeaders: Record<string, string>) => {
        statusCode = nextStatusCode;
        headers = nextHeaders;
      },
    ),
  } as unknown as ServerResponse;

  return {
    getBody: () => body,
    getHeaders: () => headers,
    getStatusCode: () => statusCode,
    response,
  };
}

describe("request-utils", () => {
  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "https://allowed.example.com";
    process.env.MAX_BODY_BYTES = undefined;
    process.env.RATE_LIMIT_MAX_ASSISTANT = undefined;
    process.env.RATE_LIMIT_MAX_OPERATOR = undefined;
    process.env.RATE_LIMIT_WINDOW_MS = undefined;
    resetRateLimitStore();
  });

  afterEach(() => {
    resetRateLimitStore();
  });

  it("allows same-origin requests even when not in ALLOWED_ORIGINS", () => {
    const request = createRequest({
      headers: {
        host: "api.example.com",
        origin: "https://api.example.com",
        "x-forwarded-proto": "https",
      },
    });

    expect(isOriginAllowed(request, "https://api.example.com")).toBe(true);
  });

  it("respects forwarded proto and host when checking same-origin", () => {
    const request = createRequest({
      headers: {
        origin: "https://edge.example.com",
        "x-forwarded-host": "edge.example.com",
        "x-forwarded-proto": "https",
      },
    });

    expect(isOriginAllowed(request, "https://edge.example.com")).toBe(true);
    expect(isOriginAllowed(request, "https://other.example.com")).toBe(false);
  });

  it("derives the client key from forwarded-for and falls back to remoteAddress", () => {
    const forwardedRequest = createRequest({
      headers: {
        "x-forwarded-for": "198.51.100.24, 203.0.113.10",
      },
      remoteAddress: "127.0.0.1",
    });
    const remoteAddressRequest = createRequest({
      headers: {},
      remoteAddress: "203.0.113.77",
    });

    expect(getClientKey(forwardedRequest)).toBe("198.51.100.24");
    expect(getClientKey(remoteAddressRequest)).toBe("203.0.113.77");
  });

  it("enforces bucketed rate limits and reset behavior", () => {
    process.env.RATE_LIMIT_MAX_ASSISTANT = "1";
    process.env.RATE_LIMIT_MAX_OPERATOR = "2";
    process.env.RATE_LIMIT_WINDOW_MS = "60000";
    const request = createRequest({
      headers: {
        "x-forwarded-for": "198.51.100.41",
      },
    });

    expect(checkRateLimit(request, "assistant")).toBe(true);
    expect(checkRateLimit(request, "assistant")).toBe(false);
    expect(checkRateLimit(request, "operator")).toBe(true);
    expect(checkRateLimit(request, "operator")).toBe(true);
    expect(checkRateLimit(request, "operator")).toBe(false);

    resetRateLimitStore();

    expect(checkRateLimit(request, "assistant")).toBe(true);
  });

  it("reads JSON payloads and returns an empty object for empty bodies", async () => {
    const withBody = createRequest({
      chunks: ['{"intent":"food","partySize":3}'],
    });
    const withoutBody = createRequest();

    await expect(readJsonBody(withBody)).resolves.toMatchObject({
      intent: "food",
      partySize: 3,
    });
    await expect(readJsonBody(withoutBody)).resolves.toEqual({});
  });

  it("rejects oversized request bodies", async () => {
    process.env.MAX_BODY_BYTES = "5";
    const oversized = createRequest({
      chunks: ["0123456789"],
    });

    await expect(readJsonBody(oversized)).rejects.toThrow(
      "Request body too large",
    );
  });

  it("responds with gzip encoding when requested", () => {
    const request = createRequest({
      headers: {
        "accept-encoding": "gzip, deflate",
        origin: "https://allowed.example.com",
      },
    });
    const responseDouble = createResponseDouble();

    respondJson(request, responseDouble.response, 200, {
      ok: true,
    });

    expect(responseDouble.getStatusCode()).toBe(200);
    expect(responseDouble.getHeaders()["content-encoding"]).toBe("gzip");

    const encodedBody = responseDouble.getBody();
    if (!Buffer.isBuffer(encodedBody)) {
      throw new Error("Expected gzip response body buffer");
    }
    expect(JSON.parse(gunzipSync(encodedBody).toString("utf8"))).toEqual({
      ok: true,
    });
  });

  it("responds with plain json when gzip is not requested", () => {
    const request = createRequest({
      headers: {
        "accept-encoding": "identity",
        origin: "https://allowed.example.com",
      },
    });
    const responseDouble = createResponseDouble();

    respondJson(
      request,
      responseDouble.response,
      201,
      {
        created: true,
      },
      {
        "cache-control": "public, max-age=60",
      },
    );

    expect(responseDouble.getStatusCode()).toBe(201);
    expect(responseDouble.getHeaders()["content-encoding"]).toBeUndefined();
    expect(responseDouble.getHeaders()["cache-control"]).toBe(
      "public, max-age=60",
    );
    expect(JSON.parse(responseDouble.getBody() as string)).toEqual({
      created: true,
    });
  });
});
