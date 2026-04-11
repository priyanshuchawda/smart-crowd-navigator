import {
  type JsonWebKey as CryptoJsonWebKey,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import type { IncomingMessage } from "node:http";

const APP_CHECK_JWKS_URL = "https://firebaseappcheck.googleapis.com/v1/jwks";

class AppCheckError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type JsonWebKeyWithKid = CryptoJsonWebKey & {
  kid?: string;
};

type AppCheckTokenPayload = {
  aud?: string | string[];
  exp?: number;
  iss?: string;
  sub?: string;
};

type VerifiedAppCheckToken = {
  appId: string | null;
};

type AppCheckDependencies = {
  fetchImpl?: typeof fetch;
  now?: () => number;
};

type AppCheckService = {
  isRequired: () => boolean;
  requireToken: (
    request: IncomingMessage,
  ) => Promise<VerifiedAppCheckToken | null>;
};

type JwksCache = {
  expiresAt: number;
  keysById: Map<string, JsonWebKeyWithKid>;
};

function normalizeOptionalValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function getFirebaseProjectNumber() {
  return normalizeOptionalValue(process.env.FIREBASE_PROJECT_NUMBER);
}

function getAllowedAppIds() {
  const configured = normalizeOptionalValue(
    process.env.APP_CHECK_ALLOWED_APP_IDS,
  );

  if (configured) {
    return configured
      .split(",")
      .map((appId) => appId.trim())
      .filter(Boolean);
  }

  const defaultAppId = normalizeOptionalValue(process.env.VITE_FIREBASE_APP_ID);
  return defaultAppId ? [defaultAppId] : [];
}

function isAppCheckRequired() {
  const override = process.env.APP_CHECK_REQUIRED?.trim().toLowerCase();

  if (override === "true") {
    return true;
  }

  if (override === "false") {
    return false;
  }

  return false;
}

function readAppCheckToken(request: IncomingMessage) {
  const header = request.headers["x-firebase-appcheck"];

  if (Array.isArray(header)) {
    return header[0]?.trim() ?? null;
  }

  if (typeof header !== "string") {
    return null;
  }

  return header.trim() || null;
}

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding =
    normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));

  return Buffer.from(`${normalized}${padding}`, "base64");
}

function parseCacheMaxAge(cacheControl: string | null) {
  if (!cacheControl) {
    return 21_600_000;
  }

  const match = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSeconds = match ? Number.parseInt(match[1] ?? "0", 10) : 21_600;

  return Number.isFinite(maxAgeSeconds) && maxAgeSeconds > 0
    ? maxAgeSeconds * 1000
    : 21_600_000;
}

function parseJwtSegment<TValue>(segment: string) {
  return JSON.parse(decodeBase64Url(segment).toString("utf8")) as TValue;
}

function verifyJwtSignature(token: string, jwk: CryptoJsonWebKey) {
  const [headerSegment, payloadSegment, signatureSegment] = token.split(".");

  if (!headerSegment || !payloadSegment || !signatureSegment) {
    return false;
  }

  const verifierInput = Buffer.from(`${headerSegment}.${payloadSegment}`);
  const signature = decodeBase64Url(signatureSegment);
  const publicKey = createPublicKey({
    format: "jwk",
    key: jwk as unknown as CryptoJsonWebKey,
  });

  return verifySignature("RSA-SHA256", verifierInput, publicKey, signature);
}

function normalizeAudience(aud: string | string[] | undefined) {
  if (typeof aud === "string") {
    return [aud];
  }

  return Array.isArray(aud) ? aud : [];
}

function assertAppCheckClaims(
  payload: AppCheckTokenPayload,
  projectNumber: string,
  now: number,
) {
  const issuer = `https://firebaseappcheck.googleapis.com/${projectNumber}`;
  const expiry = typeof payload.exp === "number" ? payload.exp * 1000 : 0;
  const audience = normalizeAudience(payload.aud);

  if (payload.iss !== issuer) {
    throw new AppCheckError(
      401,
      "invalid_app_check",
      "App Check token issuer mismatch",
    );
  }

  if (expiry <= now) {
    throw new AppCheckError(
      401,
      "invalid_app_check",
      "App Check token has expired",
    );
  }

  if (!audience.includes(`projects/${projectNumber}`)) {
    throw new AppCheckError(
      401,
      "invalid_app_check",
      "App Check token audience mismatch",
    );
  }
}

function createAppCheckService({
  fetchImpl = fetch,
  now = () => Date.now(),
}: AppCheckDependencies = {}): AppCheckService {
  let jwksCache: JwksCache | null = null;

  async function getJwks() {
    if (jwksCache && jwksCache.expiresAt > now()) {
      return jwksCache.keysById;
    }

    const response = await fetchImpl(APP_CHECK_JWKS_URL);

    if (!response.ok) {
      throw new AppCheckError(
        502,
        "app_check_unavailable",
        "Unable to fetch App Check signing keys",
      );
    }

    const payload = (await response.json()) as { keys?: JsonWebKeyWithKid[] };
    const keys = new Map<string, JsonWebKeyWithKid>();

    for (const key of payload.keys ?? []) {
      if (key.kid) {
        keys.set(key.kid, key);
      }
    }

    if (keys.size === 0) {
      throw new AppCheckError(
        502,
        "app_check_unavailable",
        "App Check signing keys payload was empty",
      );
    }

    jwksCache = {
      expiresAt:
        now() + parseCacheMaxAge(response.headers.get("cache-control")),
      keysById: keys,
    };

    return keys;
  }

  async function verifyToken(token: string) {
    const projectNumber = getFirebaseProjectNumber();

    if (!projectNumber) {
      throw new AppCheckError(
        500,
        "app_check_not_configured",
        "FIREBASE_PROJECT_NUMBER is required for App Check verification",
      );
    }

    const [headerSegment, payloadSegment, signatureSegment] = token.split(".");

    if (!headerSegment || !payloadSegment || !signatureSegment) {
      throw new AppCheckError(
        401,
        "invalid_app_check",
        "Malformed App Check token",
      );
    }

    const header = parseJwtSegment<{
      alg?: string;
      kid?: string;
      typ?: string;
    }>(headerSegment);

    if (header.alg !== "RS256") {
      throw new AppCheckError(
        401,
        "invalid_app_check",
        "Unexpected App Check token algorithm",
      );
    }

    if (header.typ !== "JWT") {
      throw new AppCheckError(
        401,
        "invalid_app_check",
        "Unexpected App Check token type",
      );
    }

    if (!header.kid) {
      throw new AppCheckError(
        401,
        "invalid_app_check",
        "App Check token key id missing",
      );
    }

    const keysById = await getJwks();
    const key = keysById.get(header.kid);

    if (!key || !verifyJwtSignature(token, key)) {
      throw new AppCheckError(
        401,
        "invalid_app_check",
        "App Check token signature is invalid",
      );
    }

    const payload = parseJwtSegment<AppCheckTokenPayload>(payloadSegment);
    assertAppCheckClaims(payload, projectNumber, now());

    const allowedAppIds = getAllowedAppIds();

    if (
      allowedAppIds.length > 0 &&
      payload.sub &&
      !allowedAppIds.includes(payload.sub)
    ) {
      throw new AppCheckError(
        403,
        "app_check_forbidden",
        "App Check token app id is not allowlisted",
      );
    }

    return {
      appId: payload.sub ?? null,
    };
  }

  return {
    isRequired: isAppCheckRequired,
    async requireToken(request) {
      if (!isAppCheckRequired()) {
        return null;
      }

      const token = readAppCheckToken(request);

      if (!token) {
        throw new AppCheckError(
          401,
          "app_check_required",
          "App Check token is required",
        );
      }

      return verifyToken(token);
    },
  };
}

export {
  AppCheckError,
  createAppCheckService,
  getFirebaseProjectNumber,
  isAppCheckRequired,
};
export type { AppCheckDependencies, AppCheckService, VerifiedAppCheckToken };
