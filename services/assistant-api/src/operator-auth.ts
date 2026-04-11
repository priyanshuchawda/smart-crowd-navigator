import {
  type JsonWebKey as CryptoJsonWebKey,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import type { IncomingMessage } from "node:http";

const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const FIRESTORE_DATABASE_ID = "(default)";
const OPERATOR_ROLE_COLLECTION = "operator-roles";
const OPERATOR_ROLES = new Set(["operator", "admin"]);

type JsonWebKeyWithKid = CryptoJsonWebKey & {
  kid?: string;
};

type FirebaseTokenPayload = {
  aud?: string;
  auth_time?: number;
  email?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  sub?: string;
  user_id?: string;
};

type AuthorizedOperator = {
  actor: string;
  email: string | null;
  role: "operator" | "admin";
  uid: string;
};

type OperatorAuthDependencies = {
  fetchImpl?: typeof fetch;
  now?: () => number;
};

type OperatorAuthService = {
  isRequired: () => boolean;
  requireOperator: (
    request: IncomingMessage,
  ) => Promise<AuthorizedOperator | null>;
};

type JwksCache = {
  expiresAt: number;
  keysById: Map<string, JsonWebKeyWithKid>;
};

class OperatorAuthError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function getFirebaseProjectId() {
  return (
    process.env.FIREBASE_PROJECT_ID ??
    process.env.VITE_FIREBASE_PROJECT_ID ??
    ""
  ).trim();
}

function getOperatorRoleCollection() {
  return (
    process.env.OPERATOR_ROLE_COLLECTION ?? OPERATOR_ROLE_COLLECTION
  ).trim();
}

function isOperatorAuthRequired() {
  const override = process.env.OPERATOR_AUTH_REQUIRED?.trim().toLowerCase();

  if (override === "true") {
    return true;
  }

  if (override === "false") {
    return false;
  }

  return process.env.NODE_ENV !== "test" && getFirebaseProjectId().length > 0;
}

function readBearerToken(request: IncomingMessage) {
  const authorization = request.headers.authorization;

  if (typeof authorization !== "string") {
    return null;
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
}

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding =
    normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));

  return Buffer.from(`${normalized}${padding}`, "base64");
}

function parseCacheMaxAge(cacheControl: string | null) {
  if (!cacheControl) {
    return 3_600_000;
  }

  const match = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSeconds = match ? Number.parseInt(match[1] ?? "0", 10) : 3600;

  return Number.isFinite(maxAgeSeconds) && maxAgeSeconds > 0
    ? maxAgeSeconds * 1000
    : 3_600_000;
}

function parseJwtSegment<TValue>(segment: string) {
  return JSON.parse(decodeBase64Url(segment).toString("utf8")) as TValue;
}

function verifyJwtSignature(token: string, jwk: JsonWebKey) {
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

function assertFirebaseClaims(
  payload: FirebaseTokenPayload,
  projectId: string,
  now: number,
) {
  const issuer = `https://securetoken.google.com/${projectId}`;
  const expiry = typeof payload.exp === "number" ? payload.exp * 1000 : 0;
  const issuedAt = typeof payload.iat === "number" ? payload.iat * 1000 : 0;
  const authTime =
    typeof payload.auth_time === "number" ? payload.auth_time * 1000 : 0;
  const uid = payload.user_id ?? payload.sub;

  if (payload.aud !== projectId) {
    throw new OperatorAuthError(
      401,
      "invalid_token",
      "Firebase token audience mismatch",
    );
  }

  if (payload.iss !== issuer) {
    throw new OperatorAuthError(
      401,
      "invalid_token",
      "Firebase token issuer mismatch",
    );
  }

  if (!uid || typeof uid !== "string") {
    throw new OperatorAuthError(
      401,
      "invalid_token",
      "Firebase token subject missing",
    );
  }

  if (expiry <= now) {
    throw new OperatorAuthError(
      401,
      "invalid_token",
      "Firebase token has expired",
    );
  }

  if (issuedAt > now + 60_000) {
    throw new OperatorAuthError(
      401,
      "invalid_token",
      "Firebase token issued in the future",
    );
  }

  if (authTime > now + 60_000) {
    throw new OperatorAuthError(
      401,
      "invalid_token",
      "Firebase token auth_time invalid",
    );
  }
}

function parseOperatorRole(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const fields = (payload as { fields?: Record<string, unknown> }).fields;

  if (!fields || typeof fields !== "object") {
    return null;
  }

  const roleField = fields.role;
  const activeField = fields.active;
  const role =
    roleField && typeof roleField === "object" && "stringValue" in roleField
      ? (roleField.stringValue as string)
      : null;
  const isActive =
    activeField &&
    typeof activeField === "object" &&
    "booleanValue" in activeField
      ? activeField.booleanValue === true
      : false;

  if (!role || !isActive || !OPERATOR_ROLES.has(role)) {
    return null;
  }

  return role as "operator" | "admin";
}

function createOperatorAuthService({
  fetchImpl = fetch,
  now = () => Date.now(),
}: OperatorAuthDependencies = {}): OperatorAuthService {
  let jwksCache: JwksCache | null = null;

  async function getJwks() {
    if (jwksCache && jwksCache.expiresAt > now()) {
      return jwksCache.keysById;
    }

    const response = await fetchImpl(FIREBASE_JWKS_URL);

    if (!response.ok) {
      throw new OperatorAuthError(
        502,
        "auth_unavailable",
        "Unable to fetch Firebase signing keys",
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
      throw new OperatorAuthError(
        502,
        "auth_unavailable",
        "Firebase signing keys payload was empty",
      );
    }

    jwksCache = {
      expiresAt:
        now() + parseCacheMaxAge(response.headers.get("cache-control")),
      keysById: keys,
    };

    return keys;
  }

  async function verifyFirebaseIdToken(token: string) {
    const [headerSegment, payloadSegment, signatureSegment] = token.split(".");
    const projectId = getFirebaseProjectId();

    if (!projectId) {
      throw new OperatorAuthError(
        500,
        "auth_not_configured",
        "Firebase project id is not configured",
      );
    }

    if (!headerSegment || !payloadSegment || !signatureSegment) {
      throw new OperatorAuthError(
        401,
        "invalid_token",
        "Malformed bearer token",
      );
    }

    const header = parseJwtSegment<{ alg?: string; kid?: string }>(
      headerSegment,
    );

    if (header.alg !== "RS256" || !header.kid) {
      throw new OperatorAuthError(
        401,
        "invalid_token",
        "Unexpected Firebase token header",
      );
    }

    const keysById = await getJwks();
    const key = keysById.get(header.kid);

    if (!key) {
      throw new OperatorAuthError(
        401,
        "invalid_token",
        "Unknown Firebase signing key",
      );
    }

    if (!verifyJwtSignature(token, key)) {
      throw new OperatorAuthError(
        401,
        "invalid_token",
        "Firebase token signature is invalid",
      );
    }

    const payload = parseJwtSegment<FirebaseTokenPayload>(payloadSegment);
    assertFirebaseClaims(payload, projectId, now());

    return {
      email: payload.email ?? null,
      projectId,
      uid: payload.user_id ?? payload.sub ?? "",
    };
  }

  async function getOperatorRole(
    projectId: string,
    uid: string,
    idToken: string,
  ) {
    const rolePath = encodeURIComponent(getOperatorRoleCollection());
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${encodeURIComponent(
      FIRESTORE_DATABASE_ID,
    )}/documents/${rolePath}/${encodeURIComponent(uid)}`;
    const response = await fetchImpl(url, {
      headers: {
        authorization: `Bearer ${idToken}`,
      },
    });

    if (response.status === 403 || response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new OperatorAuthError(
        502,
        "auth_unavailable",
        "Unable to read operator role document",
      );
    }

    return parseOperatorRole(await response.json());
  }

  return {
    isRequired: isOperatorAuthRequired,
    async requireOperator(request) {
      if (!isOperatorAuthRequired()) {
        return null;
      }

      const token = readBearerToken(request);

      if (!token) {
        throw new OperatorAuthError(
          401,
          "operator_auth_required",
          "Operator authentication is required",
        );
      }

      const identity = await verifyFirebaseIdToken(token);
      const role = await getOperatorRole(
        identity.projectId,
        identity.uid,
        token,
      );

      if (!role) {
        throw new OperatorAuthError(
          403,
          "operator_forbidden",
          "Operator privileges are required",
        );
      }

      return {
        actor: identity.email ?? identity.uid,
        email: identity.email,
        role,
        uid: identity.uid,
      };
    },
  };
}

export {
  OperatorAuthError,
  createOperatorAuthService,
  getFirebaseProjectId,
  isOperatorAuthRequired,
};
export type {
  AuthorizedOperator,
  OperatorAuthDependencies,
  OperatorAuthService,
};
