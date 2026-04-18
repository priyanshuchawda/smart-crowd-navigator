import { useCallback, useMemo, useRef, useState } from "react";

import type {
  CoreIntent,
  EventPhase,
  GroupWorkflow,
  MobilityMode,
} from "@smart-crowd-navigator/shared";

import { AttendeeFlowPanels } from "./components/AttendeeFlowPanels";
import { DeferredOperatorExperience } from "./components/DeferredOperatorExperience";
import { HeroSection } from "./components/HeroSection";
import { useAssistantSession } from "./hooks/useAssistantSession";
import { useInstallAndConnectivity } from "./hooks/useInstallAndConnectivity";

export function App() {
  const [section, setSection] = useState("section-a12");
  const [partySize, setPartySize] = useState(3);
  const [eventPhase, setEventPhase] = useState<EventPhase>("break");
  const [groupWorkflow, setGroupWorkflow] = useState<GroupWorkflow>("auto");
  const [mobilityMode, setMobilityMode] = useState<MobilityMode>("standard");
  const demoSectionRef = useRef<HTMLDivElement | null>(null);
  const recommendationSectionRef = useRef<HTMLDivElement | null>(null);
  const recommendationHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const demoControlsRef = useRef<HTMLDivElement | null>(null);

  const summary = useMemo(
    () =>
      `${section.toUpperCase()} · Party of ${partySize} · ${eventPhase.replace("-", " ")} · ${mobilityMode}`,
    [eventPhase, mobilityMode, partySize, section],
  );

  const scrollToDemo = useCallback(() => {
    demoSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const scrollToRecommendation = useCallback(() => {
    recommendationSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const scrollToDemoControls = useCallback(() => {
    demoControlsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const handleRecommendationReady = useCallback(() => {
    scrollToRecommendation();
    recommendationHeadingRef.current?.focus();
  }, [scrollToRecommendation]);

  const {
    activeIntent,
    draftQuestion,
    errorMessage,
    isLoading,
    messages,
    requestRecommendation,
    response,
    setDraftQuestion,
    submitQuestion,
  } = useAssistantSession({
    eventPhase,
    groupWorkflow,
    mobilityMode,
    onRecommendationReady: handleRecommendationReady,
    partySize,
    section,
    summary,
  });

  const handleRequestRecommendation = useCallback(
    (intent: CoreIntent) => {
      void requestRecommendation(intent);
    },
    [requestRecommendation],
  );

  const handleRequestFoodDemo = useCallback(() => {
    scrollToDemo();
    void requestRecommendation("food");
  }, [requestRecommendation, scrollToDemo]);

  const { handleInstallApp, installPrompt, isOffline } =
    useInstallAndConnectivity();

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
          onRequestFoodDemo={handleRequestFoodDemo}
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
            onRequestRecommendation={handleRequestRecommendation}
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
