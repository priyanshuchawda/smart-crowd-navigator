import { useCallback, useRef, useState } from "react";

import type {
  CoreIntent,
  EventPhase,
  GroupWorkflow,
  MobilityMode,
} from "@smart-crowd-navigator/shared";

import { requestAssistantResponse } from "../api";
import type { ChatMessage } from "../types";

type RequestRecommendationOptions = {
  announceUser?: boolean;
  assistantPrefix?: string;
};

type InternalRequestOptions = RequestRecommendationOptions & {
  question?: string;
  userText?: string;
};

type UseAssistantSessionOptions = {
  eventPhase: EventPhase;
  groupWorkflow: GroupWorkflow;
  mobilityMode: MobilityMode;
  onRecommendationReady?: () => void;
  partySize: number;
  section: string;
  summary: string;
};

type AssistantResponse = Awaited<ReturnType<typeof requestAssistantResponse>>;

function buildQuickActionPrompt(intent: CoreIntent, summary: string) {
  return `Find the best ${intent.replace("-", " ")} option for ${summary}.`;
}

function inferIntentFromQuestion(
  question: string,
  activeIntent: CoreIntent | null,
): CoreIntent {
  const normalizedQuestion = question.toLowerCase();

  if (
    normalizedQuestion.includes("washroom") ||
    normalizedQuestion.includes("restroom") ||
    normalizedQuestion.includes("bathroom")
  ) {
    return "washroom";
  }

  if (
    normalizedQuestion.includes("entry") ||
    normalizedQuestion.includes("gate")
  ) {
    return "entry-gate";
  }

  if (
    normalizedQuestion.includes("exit") ||
    normalizedQuestion.includes("leave") ||
    normalizedQuestion.includes("pickup") ||
    normalizedQuestion.includes("rideshare")
  ) {
    return "exit";
  }

  if (
    normalizedQuestion.includes("food") ||
    normalizedQuestion.includes("drink") ||
    normalizedQuestion.includes("snack") ||
    normalizedQuestion.includes("stall")
  ) {
    return "food";
  }

  return activeIntent ?? "food";
}

export function useAssistantSession({
  eventPhase,
  groupWorkflow,
  mobilityMode,
  onRecommendationReady,
  partySize,
  section,
  summary,
}: UseAssistantSessionOptions) {
  const [draftQuestion, setDraftQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [response, setResponse] =
    useState<AssistantResponse | null>(null);
  const [activeIntent, setActiveIntent] = useState<CoreIntent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const requestVersionRef = useRef(0);

  const runRecommendationRequest = useCallback(
    async (intent: CoreIntent, options?: InternalRequestOptions) => {
      const requestVersion = ++requestVersionRef.current;
      const question = options?.question?.trim();
      const userText =
        options?.userText ??
        question ??
        buildQuickActionPrompt(intent, summary);
      const nextMessages =
        options?.announceUser === false
          ? messages
          : [...messages, { role: "user" as const, text: userText }].slice(
              -12,
            );

      setIsLoading(true);
      setErrorMessage(null);
      setActiveIntent(intent);

      if (options?.announceUser !== false) {
        setMessages(nextMessages);
      }

      try {
        const nextResponse = await requestAssistantResponse({
          section,
          intent,
          partySize,
          eventPhase,
          groupWorkflow: groupWorkflow === "auto" ? undefined : groupWorkflow,
          mobilityMode,
          question: question ?? userText,
          conversationHistory: nextMessages,
        });

        if (requestVersion !== requestVersionRef.current) {
          return;
        }

        const assistantMessage = {
          role: "assistant" as const,
          text: options?.assistantPrefix
            ? `${options.assistantPrefix} ${nextResponse.message}`
            : nextResponse.message,
        };

        setResponse(nextResponse);
        setMessages([...nextMessages, assistantMessage].slice(-12));
        setDraftQuestion("");
        onRecommendationReady?.();
      } catch (error) {
        if (requestVersion !== requestVersionRef.current) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to get a recommendation.",
        );
      } finally {
        if (requestVersion === requestVersionRef.current) {
          setIsLoading(false);
        }
      }
    },
    [
      eventPhase,
      groupWorkflow,
      messages,
      mobilityMode,
      onRecommendationReady,
      partySize,
      section,
      summary,
    ],
  );

  const requestRecommendation = useCallback(
    async (intent: CoreIntent, options?: RequestRecommendationOptions) => {
      await runRecommendationRequest(intent, options);
    },
    [runRecommendationRequest],
  );

  const submitQuestion = useCallback(() => {
    const question = draftQuestion.trim();

    if (!question) {
      return;
    }

    const nextIntent = inferIntentFromQuestion(question, activeIntent);
    void runRecommendationRequest(nextIntent, {
      question,
      userText: question,
    });
  }, [activeIntent, draftQuestion, runRecommendationRequest]);

  return {
    activeIntent,
    draftQuestion,
    errorMessage,
    isLoading,
    messages,
    requestRecommendation,
    response,
    setDraftQuestion,
    submitQuestion,
  };
}

export { inferIntentFromQuestion };
export type { RequestRecommendationOptions };
