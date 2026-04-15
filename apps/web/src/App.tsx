import { useEffect, useMemo, useRef, useState } from "react";

import type {
  CoreIntent,
  EventPhase,
  GroupWorkflow,
  MobilityMode,
} from "@smart-crowd-navigator/shared";

import { requestAssistantResponse } from "./api";
import { AttendeeFlowPanels } from "./components/AttendeeFlowPanels";
import { DeferredOperatorExperience } from "./components/DeferredOperatorExperience";
import { HeroSection } from "./components/HeroSection";
import type { ChatMessage } from "./types";

type RequestRecommendationOptions = {
  announceUser?: boolean;
  assistantPrefix?: string;
};

type InternalRequestOptions = RequestRecommendationOptions & {
  question?: string;
  userText?: string;
};

type DeferredInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

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

export function App() {
  const [section, setSection] = useState("section-a12");
  const [partySize, setPartySize] = useState(3);
  const [eventPhase, setEventPhase] = useState<EventPhase>("break");
  const [groupWorkflow, setGroupWorkflow] = useState<GroupWorkflow>("auto");
  const [mobilityMode, setMobilityMode] = useState<MobilityMode>("standard");
  const [draftQuestion, setDraftQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [response, setResponse] = useState<Awaited<
    ReturnType<typeof requestAssistantResponse>
  > | null>(null);
  const [activeIntent, setActiveIntent] = useState<CoreIntent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] =
    useState<DeferredInstallPromptEvent | null>(null);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const requestVersionRef = useRef(0);
  const demoSectionRef = useRef<HTMLDivElement | null>(null);
  const recommendationSectionRef = useRef<HTMLDivElement | null>(null);
  const recommendationHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const demoControlsRef = useRef<HTMLDivElement | null>(null);

  const summary = useMemo(
    () =>
      `${section.toUpperCase()} · Party of ${partySize} · ${eventPhase.replace("-", " ")} · ${mobilityMode}`,
    [eventPhase, mobilityMode, partySize, section],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as DeferredInstallPromptEvent);
    };
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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

  async function runRecommendationRequest(
    intent: CoreIntent,
    options?: InternalRequestOptions,
  ) {
    const requestVersion = ++requestVersionRef.current;
    const question = options?.question?.trim();
    const userText =
      options?.userText ?? question ?? buildQuickActionPrompt(intent, summary);
    const nextMessages =
      options?.announceUser === false
        ? messages
        : [...messages, { role: "user" as const, text: userText }].slice(-12);

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
      scrollToRecommendation();
      recommendationHeadingRef.current?.focus();
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
  }

  async function requestRecommendation(
    intent: CoreIntent,
    options?: RequestRecommendationOptions,
  ) {
    await runRecommendationRequest(intent, options);
  }

  function submitQuestion() {
    const question = draftQuestion.trim();

    if (!question) {
      return;
    }

    const nextIntent = inferIntentFromQuestion(question, activeIntent);
    void runRecommendationRequest(nextIntent, {
      question,
      userText: question,
    });
  }

  async function handleInstallApp() {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    await installPrompt.userChoice.catch(() => null);
    setInstallPrompt(null);
  }

  return (
    <main className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <output className="visually-hidden" aria-live="polite">
        {isLoading
          ? "Loading recommendation…"
          : response
            ? "Recommendation ready."
            : ""}
      </output>
      <div className="ambient-orb ambient-orb-one" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-two" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-three" aria-hidden="true" />

      {isOffline ? (
        <section
          className="app-alert-banner offline-banner"
          aria-label="Offline mode"
        >
          <strong>You&apos;re offline.</strong> Using the last known crowd data
          until the live connection returns.
        </section>
      ) : null}

      {installPrompt ? (
        <section
          className="app-alert-banner install-banner"
          aria-label="Install Smart Crowd Navigator"
        >
          <div>
            <strong>Install the app.</strong> Keep venue guidance on the home
            screen for faster offline-friendly access.
          </div>
          <button
            className="hero-action-button hero-action-primary"
            type="button"
            onClick={() => void handleInstallApp()}
          >
            Install App
          </button>
        </section>
      ) : null}

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
            draftQuestion={draftQuestion}
            errorMessage={errorMessage}
            eventPhase={eventPhase}
            groupWorkflow={groupWorkflow}
            isLoading={isLoading}
            messages={messages}
            mobilityMode={mobilityMode}
            onDraftQuestionChange={setDraftQuestion}
            onEventPhaseChange={setEventPhase}
            onGroupWorkflowChange={setGroupWorkflow}
            onMobilityModeChange={setMobilityMode}
            onPartySizeChange={setPartySize}
            onRequestRecommendation={(intent) => {
              void requestRecommendation(intent);
            }}
            onSectionChange={setSection}
            onSubmitQuestion={submitQuestion}
            partySize={partySize}
            recommendationHeadingRef={recommendationHeadingRef}
            recommendationSectionRef={recommendationSectionRef}
            response={response}
            section={section}
            summary={summary}
          />

          <div ref={demoControlsRef} className="secondary-column">
            <DeferredOperatorExperience
              activeIntent={activeIntent}
              onRequestRecommendation={requestRecommendation}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
