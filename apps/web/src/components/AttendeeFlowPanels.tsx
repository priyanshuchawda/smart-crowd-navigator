import {
  CORE_INTENTS,
  type CoreIntent,
  EVENT_PHASES,
  GROUP_WORKFLOWS,
  MOBILITY_MODES,
} from "@smart-crowd-navigator/shared";

import { Suspense, type RefObject, lazy, memo } from "react";
import { intentDescriptions, intentLabels } from "../intent-metadata";
import type { AssistantApiResponse, ChatMessage } from "../types";
import { ConversationPanel } from "./ConversationPanel";
import { PanelErrorBoundary } from "./PanelErrorBoundary";
import { RecommendationPanel } from "./RecommendationPanel";

/** Lazy-loaded venue map — below the fold and SVG-heavy. */
const LazyVenueMapPanel = lazy(async () => {
  const module = await import("./VenueMapPanel");

  return {
    default: module.VenueMapPanel,
  };
});

const attendeeSteps = [
  {
    description: "Set your section, group size, and mobility needs first.",
    title: "1. Add your context",
  },
  {
    description: "Pick what you need help with right now.",
    title: "2. Choose your goal",
  },
  {
    description: "Read the recommendation and follow the suggested guidance.",
    title: "3. Follow the next move",
  },
];

interface AttendeeFlowPanelsProps {
  activeIntent: CoreIntent | null;
  draftQuestion: string;
  errorMessage: string | null;
  eventPhase: (typeof EVENT_PHASES)[number];
  groupWorkflow: (typeof GROUP_WORKFLOWS)[number];
  isLoading: boolean;
  messages: ChatMessage[];
  mobilityMode: (typeof MOBILITY_MODES)[number];
  onDraftQuestionChange: (value: string) => void;
  onEventPhaseChange: (value: (typeof EVENT_PHASES)[number]) => void;
  onGroupWorkflowChange: (value: (typeof GROUP_WORKFLOWS)[number]) => void;
  onMobilityModeChange: (value: (typeof MOBILITY_MODES)[number]) => void;
  onPartySizeChange: (value: number) => void;
  onRequestRecommendation: (intent: CoreIntent) => void;
  onSectionChange: (value: string) => void;
  onSubmitQuestion: () => void;
  partySize: number;
  recommendationHeadingRef: RefObject<HTMLHeadingElement | null>;
  recommendationSectionRef: RefObject<HTMLDivElement | null>;
  response: AssistantApiResponse | null;
  section: string;
  summary: string;
}

const AttendeeFlowPanels = memo(function AttendeeFlowPanels({
  activeIntent,
  draftQuestion,
  errorMessage,
  eventPhase,
  groupWorkflow,
  isLoading,
  messages,
  mobilityMode,
  onDraftQuestionChange,
  onEventPhaseChange,
  onGroupWorkflowChange,
  onMobilityModeChange,
  onPartySizeChange,
  onRequestRecommendation,
  onSectionChange,
  onSubmitQuestion,
  partySize,
  recommendationHeadingRef,
  recommendationSectionRef,
  response,
  section,
  summary,
}: AttendeeFlowPanelsProps) {
  return (
    <div className="primary-column">
      <section
        className="panel-card step-panel"
        aria-label="How to use this page"
      >
        <div className="panel-heading-row">
          <div>
            <p className="section-title">How It Works</p>
            <p className="section-supporting-text">
              This page is designed for first-time visitors: move from top to
              bottom and left to right.
            </p>
          </div>
          <span className="status-pill status-pill-muted">
            Beginner-friendly flow
          </span>
        </div>

        <div className="step-grid">
          {attendeeSteps.map((step) => (
            <article key={step.title} className="step-card">
              <strong className="step-title">{step.title}</strong>
              <p className="step-description">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="panel-card control-panel"
        aria-label="Attendee context"
      >
        <div className="panel-heading-row">
          <div>
            <p className="section-title">Attendee Context</p>
            <p className="section-supporting-text">
              Tune the live recommendation for your group before asking for the
              next move.
            </p>
          </div>
          <span className="status-pill status-pill-muted">{summary}</span>
        </div>

        <div className="control-stack">
          <label className="field" htmlFor="attendee-section">
            <span>Section</span>
            <input
              id="attendee-section"
              aria-describedby="section-help"
              autoCapitalize="characters"
              autoComplete="off"
              name="section"
              spellCheck={false}
              value={section}
              onChange={(event) => onSectionChange(event.target.value)}
            />
            <small id="section-help" className="field-help-text">
              Example: section-a12 or your venue block/zone.
            </small>
          </label>

          <label className="field" htmlFor="attendee-party-size">
            <span>Party Size</span>
            <input
              id="attendee-party-size"
              aria-describedby="party-size-help"
              inputMode="numeric"
              max={12}
              min={1}
              name="partySize"
              type="number"
              value={partySize}
              onChange={(event) =>
                onPartySizeChange(
                  Number.parseInt(event.target.value || "1", 10),
                )
              }
            />
            <small id="party-size-help" className="field-help-text">
              Supports single visitors through small groups of 12.
            </small>
          </label>

          <label className="field" htmlFor="attendee-event-phase">
            <span>Event Phase</span>
            <select
              id="attendee-event-phase"
              aria-describedby="event-phase-help"
              name="eventPhase"
              value={eventPhase}
              onChange={(event) =>
                onEventPhaseChange(
                  event.target.value as (typeof EVENT_PHASES)[number],
                )
              }
            >
              {EVENT_PHASES.map((phase) => (
                <option key={phase} value={phase}>
                  {phase}
                </option>
              ))}
            </select>
            <small id="event-phase-help" className="field-help-text">
              Use break or post-event to preview the clearest crowd shifts.
            </small>
          </label>

          <label className="field" htmlFor="attendee-group-workflow">
            <span>Group coordination</span>
            <select
              id="attendee-group-workflow"
              aria-describedby="group-workflow-help"
              name="groupWorkflow"
              value={groupWorkflow}
              onChange={(event) =>
                onGroupWorkflowChange(
                  event.target.value as (typeof GROUP_WORKFLOWS)[number],
                )
              }
            >
              {GROUP_WORKFLOWS.map((workflow) => (
                <option key={workflow} value={workflow}>
                  {workflow}
                </option>
              ))}
            </select>
            <small id="group-workflow-help" className="field-help-text">
              Use runner pickup, meet-up, or return-before-play to make the
              group plan more explicit.
            </small>
          </label>

          <label className="field" htmlFor="attendee-mobility-mode">
            <span>Mobility</span>
            <select
              id="attendee-mobility-mode"
              aria-describedby="mobility-help"
              name="mobilityMode"
              value={mobilityMode}
              onChange={(event) =>
                onMobilityModeChange(
                  event.target.value as (typeof MOBILITY_MODES)[number],
                )
              }
            >
              {MOBILITY_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
            <small id="mobility-help" className="field-help-text">
              Choose accessible if the route should avoid tighter or harder
              paths.
            </small>
          </label>
        </div>
      </section>

      <section className="panel-card intent-panel" aria-label="Quick actions">
        <div className="panel-heading-row">
          <div>
            <p className="section-title">What Do You Need?</p>
            <p className="section-supporting-text">
              Pick the decision the assistant should solve next.
            </p>
          </div>
          <span className="status-pill status-pill-accent">
            {isLoading ? "Planning…" : "Ready for the next move"}
          </span>
        </div>

        <div className="intent-grid">
          {CORE_INTENTS.map((intent) => (
            <button
              key={intent}
              aria-pressed={intent === activeIntent}
              className={
                intent === activeIntent ? "intent-card active" : "intent-card"
              }
              disabled={isLoading}
              type="button"
              onClick={() => onRequestRecommendation(intent)}
            >
              <span className="intent-label">{intentLabels[intent]}</span>
              <span className="intent-description">
                {intentDescriptions[intent]}
              </span>
              <span className="intent-action-copy">Ask for guidance →</span>
            </button>
          ))}
        </div>

        <div className="hint-banner">
          <strong>Tip:</strong> Start with <span>Food</span> or{" "}
          <span>Exit</span> during the demo to see the clearest route changes.
        </div>
      </section>

      <PanelErrorBoundary panelName="Live Assistant">
        <ConversationPanel
          draftQuestion={draftQuestion}
          errorMessage={errorMessage}
          isLoading={isLoading}
          messages={messages}
          onDraftQuestionChange={onDraftQuestionChange}
          onSubmitQuestion={onSubmitQuestion}
        />
      </PanelErrorBoundary>
      <PanelErrorBoundary panelName="Recommendation">
        <div ref={recommendationSectionRef}>
          <RecommendationPanel
            response={response}
            headingRef={recommendationHeadingRef}
          />
        </div>
      </PanelErrorBoundary>
      <PanelErrorBoundary panelName="Venue Map">
        <Suspense
          fallback={
            <section
              className="panel-card venue-map-panel"
              aria-label="Venue layout map"
            >
              <div className="panel-heading-row">
                <div>
                  <span className="section-title">Venue Layout</span>
                  <p className="section-supporting-text">
                    Loading the interactive venue map…
                  </p>
                </div>
                <span className="status-pill status-pill-muted">
                  Loading…
                </span>
              </div>
            </section>
          }
        >
          <LazyVenueMapPanel response={response} />
        </Suspense>
      </PanelErrorBoundary>
    </div>
  );
});

export { AttendeeFlowPanels };
