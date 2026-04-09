import type { AssistantRecommendation } from "@smart-crowd-navigator/shared";

import type { AssistantApiResponse, RecommendationRequestInput } from "./types";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://127.0.0.1:8080";

async function postJson<TResponse>(
  path: string,
  body: RecommendationRequestInput,
): Promise<TResponse> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
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
