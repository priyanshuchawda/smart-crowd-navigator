import { useMemo, useRef, useState } from "react";

import type {
  CoreIntent,
  EVENT_PHASES,
  MOBILITY_MODES,
} from "@smart-crowd-navigator/shared";

import { requestAssistantResponse } from "./api";
import { AttendeeFlowPanels } from "./components/AttendeeFlowPanels";
import { DeferredOperatorExperience } from "./components/DeferredOperatorExperience";
import { HeroSection } from "./components/HeroSection";
import { intentLabels } from "./intent-metadata";
import type { AssistantApiResponse, ChatMessage } from "./types";

const intentKeywords: Array<{
  intent: CoreIntent;
  keywords: string[];
}> = [
  {
    intent: "food",
    keywords: ["food", "eat", "stall", "snack", "drink"],
  },
  {
    intent: "washroom",
    keywords: ["washroom", "restroom", "bathroom", "toilet"],
  },
  {
    intent: "entry-gate",
    keywords: ["entry", "enter", "gate", "get in"],
  },
  {
    intent: "exit",
    keywords: ["exit", "leave", "get out", "way out"],
  },
];

function inferIntentFromQuestion(question: string): CoreIntent | null {
  const normalizedQuestion = question.trim().toLowerCase();

  if (!normalizedQuestion) {
    return null;
  }

  const matchingIntent = intentKeywords.find(({ keywords }) =>
    keywords.some((keyword) => normalizedQuestion.includes(keyword)),
  );

  return matchingIntent?.intent ?? null;
}

export function App() {
  const [section, setSection] = useState("section-a12");
  const [partySize, setPartySize] = useState(3);
  const [eventPhase, setEventPhase] =
    useState<(typeof EVENT_PHASES)[number]>("break");
  const [mobilityMode, setMobilityMode] =
    useState<(typeof MOBILITY_MODES)[number]>("standard");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draftQuestion, setDraftQuestion] = useState("");
  const [response, setResponse] = useState<AssistantApiResponse | null>(null);
  const [activeIntent, setActiveIntent] = useState<CoreIntent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestVersionRef = useRef(0);
  const demoSectionRef = useRef<HTMLDivElement | null>(null);
  const recommendationSectionRef = useRef<HTMLDivElement | null>(null);
  const recommendationHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const demoControlsRef = useRef<HTMLElement | null>(null);

  const summary = useMemo(
    () =>
      `${section.toUpperCase()} · Party of ${partySize} · ${eventPhase.replace("-", " ")} · ${mobilityMode}`,
    [eventPhase, mobilityMode, partySize, section],
  );

  function scrollToDemo() {
    demoSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function scrollToRecommendation() {
    recommendationSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function scrollToDemoControls() {
    demoControlsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function requestRecommendation(
    input:
      | CoreIntent
      | {
          intent?: CoreIntent;
          question?: string;
        },
    options?: {
      announceUser?: boolean;
      assistantPrefix?: string;
      intentOverride?: CoreIntent;
    },
  ) {
    const resolvedInput = typeof input === "string" ? { intent: input } : input;
    const question =
      resolvedInput.question?.trim() ??
      (resolvedInput.intent
        ? `Find the best ${intentLabels[resolvedInput.intent].toLowerCase()} option for ${summary}.`
        : "");
    const resolvedIntent =
      options?.intentOverride ??
      resolvedInput.intent ??
      activeIntent ??
      response?.recommendation.intent ??
      inferIntentFromQuestion(question);

    if (!resolvedIntent) {
      setErrorMessage(
        "Mention food, washroom, entry, or exit in your question, or start with a quick action first.",
      );
      return;
    }

    const requestVersion = ++requestVersionRef.current;
    setIsLoading(true);
    setErrorMessage(null);
    setActiveIntent(resolvedIntent);

    if (options?.announceUser !== false) {
      const userMessage = {
        role: "user" as const,
        text: question,
      };

      setMessages((current) => [...current, userMessage]);
    }

    try {
      const nextConversationHistory =
        options?.announceUser === false
          ? messages
          : [...messages, { role: "user" as const, text: question }];
      const nextResponse = await requestAssistantResponse({
        section,
        intent: resolvedIntent,
        partySize,
        eventPhase,
        mobilityMode,
        question,
        conversationHistory: nextConversationHistory,
      });

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      setResponse(nextResponse);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: options?.assistantPrefix
            ? `${options.assistantPrefix} ${nextResponse.message}`
            : nextResponse.message,
        },
      ]);
      setDraftQuestion("");

      scrollToRecommendation();
      recommendationHeadingRef.current?.focus();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to get a recommendation.";

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      setErrorMessage(message);
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setIsLoading(false);
      }
    }
  }

  return (
    <main className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <output className="visually-hidden" aria-live="polite">
        {isLoading
          ? "Loading recommendation..."
          : response
            ? "Recommendation ready."
            : ""}
      </output>
      <div className="ambient-orb ambient-orb-one" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-two" aria-hidden="true" />

      <section id="main-content" className="hero-card">
        <HeroSection
          activeIntent={activeIntent}
          onRequestFoodDemo={() => {
            scrollToDemo();
            void requestRecommendation("food");
          }}
          onScrollToDemo={scrollToDemo}
          onScrollToDemoControls={scrollToDemoControls}
          summary={summary}
        />

        <div className="app-grid" ref={demoSectionRef}>
          <AttendeeFlowPanels
            activeIntent={activeIntent}
            errorMessage={errorMessage}
            eventPhase={eventPhase}
            isLoading={isLoading}
            messages={messages}
            mobilityMode={mobilityMode}
            onDraftQuestionChange={setDraftQuestion}
            onEventPhaseChange={setEventPhase}
            onMobilityModeChange={setMobilityMode}
            onPartySizeChange={setPartySize}
            onRequestRecommendation={(intent) =>
              void requestRecommendation(intent)
            }
            onSubmitQuestion={() =>
              void requestRecommendation({ question: draftQuestion })
            }
            onSectionChange={setSection}
            partySize={partySize}
            draftQuestion={draftQuestion}
            recommendationHeadingRef={recommendationHeadingRef}
            recommendationSectionRef={recommendationSectionRef}
            response={response}
            section={section}
            summary={summary}
          />

          <aside ref={demoControlsRef} className="secondary-column">
            <DeferredOperatorExperience
              activeIntent={activeIntent}
              onRequestRecommendation={requestRecommendation}
            />
          </aside>
        </div>
      </section>
    </main>
  );
}
