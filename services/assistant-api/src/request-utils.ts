import type { IncomingMessage, ServerResponse } from "node:http";
import { gzipSync } from "node:zlib";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

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

function getRequestHost(request: IncomingMessage) {
  const forwardedHost = request.headers["x-forwarded-host"];
  const forwardedHostValue = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost;
  const hostValue =
    typeof forwardedHostValue === "string" && forwardedHostValue.length > 0
      ? forwardedHostValue
      : request.headers.host;

  if (typeof hostValue !== "string" || hostValue.length === 0) {
    return null;
  }

  return hostValue.split(",")[0]?.trim() ?? null;
}

function getRequestProtocol(request: IncomingMessage) {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const forwardedProtoValue = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto;

  if (typeof forwardedProtoValue === "string" && forwardedProtoValue.length) {
    return (
      forwardedProtoValue
        .split(",")[0]
        ?.trim()
        .toLowerCase() ?? "http"
    );
  }

  if (request.socket && "encrypted" in request.socket) {
    return Boolean(request.socket.encrypted) ? "https" : "http";
  }

  return "http";
}

function getCurrentRequestOrigin(request: IncomingMessage) {
  const host = getRequestHost(request);

  if (!host) {
    return null;
  }

  return `${getRequestProtocol(request)}://${host}`;
}

function isOriginAllowed(request: IncomingMessage, origin: string | null) {
  if (!origin) {
    return true;
  }

  if (getAllowedOrigins().includes(origin)) {
    return true;
  }

  return getCurrentRequestOrigin(request) === origin;
}

function getCorsHeaders(request: IncomingMessage) {
  const allowedOrigins = getAllowedOrigins();
  const origin = getRequestOrigin(request);
  const currentRequestOrigin = getCurrentRequestOrigin(request);

  return {
    "content-type": "application/json",
    "access-control-allow-origin":
      origin && isOriginAllowed(request, origin)
        ? origin
        : (currentRequestOrigin ?? allowedOrigins[0] ?? "null"),
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers":
      "authorization,content-type,x-firebase-appcheck",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    "content-security-policy":
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com; img-src 'self' data: https://*.googleapis.com https://*.gstatic.com; frame-src https://www.google.com https://maps.google.com;",
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

function resetRateLimitStore() {
  rateLimitStore.clear();
}

function respondJson(
  request: IncomingMessage,
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
  extraHeaders: Record<string, string> = {
    "cache-control": "no-cache, no-store",
  },
) {
  const jsonPayload = JSON.stringify(payload);
  const acceptsGzip = request.headers["accept-encoding"]?.includes("gzip");
  const headers: Record<string, string> = {
    ...getCorsHeaders(request),
    ...extraHeaders,
  };

  if (acceptsGzip) {
    headers["content-encoding"] = "gzip";
    headers.vary = "accept-encoding";
    response.writeHead(statusCode, headers);
    response.end(gzipSync(jsonPayload));
    return;
  }

  response.writeHead(statusCode, headers);
  response.end(jsonPayload);
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

export {
  checkRateLimit,
  getClientKey,
  getRequestOrigin,
  isOriginAllowed,
  readJsonBody,
  resetRateLimitStore,
  respondJson,
};
