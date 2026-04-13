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

export function App() {
  const [section, setSection] = useState("section-a12");
  const [partySize, setPartySize] = useState(3);
  const [eventPhase, setEventPhase] =
    useState<(typeof EVENT_PHASES)[number]>("break");
  const [mobilityMode, setMobilityMode] =
    useState<(typeof MOBILITY_MODES)[number]>("standard");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
    intent: CoreIntent,
    options?: {
      announceUser?: boolean;
      assistantPrefix?: string;
    },
  ) {
    const requestVersion = ++requestVersionRef.current;
    setIsLoading(true);
    setErrorMessage(null);
    setActiveIntent(intent);

    if (options?.announceUser !== false) {
      const userMessage = {
        role: "user" as const,
        text: `Find the best ${intentLabels[intent].toLowerCase()} option for ${summary}.`,
      };

      setMessages((current) => [...current, userMessage]);
    }

    try {
      const nextResponse = await requestAssistantResponse({
        section,
        intent,
        partySize,
        eventPhase,
        mobilityMode,
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
            onEventPhaseChange={setEventPhase}
            onMobilityModeChange={setMobilityMode}
            onPartySizeChange={setPartySize}
            onRequestRecommendation={(intent) =>
              void requestRecommendation(intent)
            }
            onSectionChange={setSection}
            partySize={partySize}
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
