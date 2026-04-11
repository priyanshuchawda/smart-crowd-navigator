import type { AssistantRecommendation } from "@smart-crowd-navigator/shared";
import type { DestinationState } from "@smart-crowd-navigator/venue-engine";

import type {
  AssistantApiResponse,
  OperatorStateResponse,
  RecommendationRequestInput,
} from "./types";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://127.0.0.1:8080";

function buildHeaders(token?: string, hasBody = true) {
  const headers = new Headers();

  if (hasBody) {
    headers.set("content-type", "application/json");
  }

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  return headers;
}

async function postJson<TResponse>(
  path: string,
  body: RecommendationRequestInput,
): Promise<TResponse> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as TResponse;
}

export async function requestAssistantResponse(
  body: RecommendationRequestInput,
): Promise<AssistantApiResponse> {
  try {
    return await postJson<AssistantApiResponse>("/assistant-response", body);
  } catch {
    const fallback = await postJson<AssistantRecommendation>(
      "/recommendation",
      body,
    );
    return {
      message: `Use ${fallback.primaryOption.label}. ${fallback.waitOrGoReason}`,
      recommendation: fallback,
    };
  }
}

export async function getOperatorState() {
  const response = await fetch(`${apiBaseUrl}/operator/state`);

  if (!response.ok) {
    throw new Error(`Operator fetch failed with status ${response.status}`);
  }

  return (await response.json()) as OperatorStateResponse;
}

export async function updateOperatorState(
  state: DestinationState,
  authToken?: string,
) {
  const response = await fetch(`${apiBaseUrl}/operator/state`, {
    method: "POST",
    headers: buildHeaders(authToken),
    body: JSON.stringify(state),
  });

  if (!response.ok) {
    throw new Error(`Operator update failed with status ${response.status}`);
  }

  return (await response.json()) as OperatorStateResponse;
}

export async function syncOperatorStates(
  states: DestinationState[],
  authToken?: string,
) {
  const response = await fetch(`${apiBaseUrl}/operator/state/bulk`, {
    method: "POST",
    headers: buildHeaders(authToken),
    body: JSON.stringify({ states }),
  });

  if (!response.ok) {
    throw new Error(`Operator sync failed with status ${response.status}`);
  }

  return (await response.json()) as OperatorStateResponse;
}

export async function resetOperatorState(authToken?: string) {
  const response = await fetch(`${apiBaseUrl}/operator/reset`, {
    method: "POST",
    headers: buildHeaders(authToken, false),
  });

  if (!response.ok) {
    throw new Error(`Operator reset failed with status ${response.status}`);
  }

  return (await response.json()) as OperatorStateResponse;
}
