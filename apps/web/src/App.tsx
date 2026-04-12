import { Suspense, lazy, useMemo, useRef, useState } from "react";

import {
  APP_NAME,
  APP_TAGLINE,
  CORE_INTENTS,
  type CoreIntent,
  EVENT_PHASES,
  MOBILITY_MODES,
} from "@smart-crowd-navigator/shared";

import { requestAssistantResponse } from "./api";
import { ConversationPanel } from "./components/ConversationPanel";
import { RecommendationPanel } from "./components/RecommendationPanel";
import type { AssistantApiResponse, ChatMessage } from "./types";

const OperatorExperience = lazy(async () => {
  const module = await import("./components/OperatorExperience");

  return {
    default: module.OperatorExperience,
  };
});

const intentLabels: Record<CoreIntent, string> = {
  food: "Food",
  washroom: "Washroom",
  "entry-gate": "Entry Gate",
  exit: "Exit",
};

const intentDescriptions: Record<CoreIntent, string> = {
  food: "Find the quickest food stop with the best timing.",
  washroom: "Avoid the busiest restroom queue near your section.",
  "entry-gate": "Choose the least-friction entry route for your group.",
  exit: "Leave smoothly with less crowd pressure and fewer bottlenecks.",
};

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

  const summary = useMemo(
    () =>
      `${section.toUpperCase()} · Party of ${partySize} · ${eventPhase.replace("-", " ")} · ${mobilityMode}`,
    [eventPhase, mobilityMode, partySize, section],
  );

  const heroHighlights = useMemo(
    () => [
      {
        label: "Current context",
        value: summary,
      },
      {
        label: "Decision mode",
        value: activeIntent ? intentLabels[activeIntent] : "Choose an action",
      },
      {
        label: "Response model",
        value: "Live Gemini + deterministic fallback",
      },
    ],
    [activeIntent, summary],
  );

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
      <div className="ambient-orb ambient-orb-one" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-two" aria-hidden="true" />

      <section id="main-content" className="hero-card">
        <header className="hero-header">
          <div className="hero-copy">
            <p className="eyebrow">Live Venue Flow Assistant</p>
            <h1>{APP_NAME}</h1>
            <p className="lede">{APP_TAGLINE}</p>
            <p className="supporting-copy">
              Designed for high-pressure event moments, this assistant helps
              attendees decide where to go, whether to move now, and how to
              avoid the worst congestion with calm, practical guidance.
            </p>
          </div>

          <div className="summary-strip" aria-label="Current operating summary">
            {heroHighlights.map((highlight) => (
              <article key={highlight.label} className="summary-card">
                <span className="summary-label">{highlight.label}</span>
                <strong className="summary-value">{highlight.value}</strong>
              </article>
            ))}
          </div>
        </header>

        <div className="app-grid">
          <div className="primary-column">
            <section
              className="panel-card control-panel"
              aria-label="Attendee context"
            >
              <div className="panel-heading-row">
                <div>
                  <p className="section-title">Attendee Context</p>
                  <p className="section-supporting-text">
                    Tune the live recommendation for your group before asking
                    for the next move.
                  </p>
                </div>
                <span className="status-pill status-pill-muted">{summary}</span>
              </div>

              <div className="control-stack">
                <label className="field">
                  <span>Section</span>
                  <input
                    autoCapitalize="characters"
                    autoComplete="off"
                    name="section"
                    value={section}
                    onChange={(event) => setSection(event.target.value)}
                    spellCheck={false}
                  />
                </label>

                <label className="field">
                  <span>Party Size</span>
                  <input
                    inputMode="numeric"
                    max={12}
                    min={1}
                    name="partySize"
                    type="number"
                    value={partySize}
                    onChange={(event) =>
                      setPartySize(
                        Number.parseInt(event.target.value || "1", 10),
                      )
                    }
                  />
                </label>

                <label className="field">
                  <span>Event Phase</span>
                  <select
                    name="eventPhase"
                    value={eventPhase}
                    onChange={(event) =>
                      setEventPhase(
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
                </label>

                <label className="field">
                  <span>Mobility</span>
                  <select
                    name="mobilityMode"
                    value={mobilityMode}
                    onChange={(event) =>
                      setMobilityMode(
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
                </label>
              </div>
            </section>

            <section
              className="panel-card intent-panel"
              aria-label="Quick actions"
            >
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
                    className={
                      intent === activeIntent
                        ? "intent-card active"
                        : "intent-card"
                    }
                    disabled={isLoading}
                    type="button"
                    onClick={() => void requestRecommendation(intent)}
                  >
                    <span className="intent-label">{intentLabels[intent]}</span>
                    <span className="intent-description">
                      {intentDescriptions[intent]}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <ConversationPanel
              errorMessage={errorMessage}
              isLoading={isLoading}
              messages={messages}
            />
            <RecommendationPanel response={response} />
          </div>

          <aside className="secondary-column">
            <Suspense
              fallback={
                <section
                  className="recommendation-card panel-card"
                  aria-label="Operator tools"
                >
                  <div className="status-row">
                    <span className="section-title">Operator Tools</span>
                    <span className="status-pill">Loading…</span>
                  </div>
                  <p className="empty-state">
                    Loading live venue controls in a separate optimized bundle.
                  </p>
                </section>
              }
            >
              <OperatorExperience
                activeIntent={activeIntent}
                onRequestRecommendation={requestRecommendation}
              />
            </Suspense>
          </aside>
        </div>
      </section>
    </main>
  );
}
