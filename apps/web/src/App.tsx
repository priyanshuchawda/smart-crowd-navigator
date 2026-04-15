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
import { VenueMapPanel } from "./components/VenueMapPanel";
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

const attendeeSteps = [
  {
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <polyline points="16 11 18 13 22 9" />
      </svg>
    ),
    description: "Set your section, group size, and mobility needs first.",
    title: "1. Add your context",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    description: "Pick what you need help with right now.",
    title: "2. Choose your goal",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    description: "Read the recommendation and follow the suggested guidance.",
    title: "3. Follow the next move",
  },
];

const productBenefits = [
  {
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    description:
      "Combines venue context, timing, and crowd pressure so attendees know what to do next without second-guessing.",
    title: "Decision support under pressure",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    description:
      "Tells people whether they should move now or wait a few minutes for a better outcome — not just where to go.",
    title: "Wait-vs-go intelligence",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    description:
      "Operator updates can change attendee guidance live, which makes the demo feel like a real venue product instead of static mock data.",
    title: "Live operational awareness",
  },
];

function DeferredOperatorExperience({
  activeIntent,
  onRequestRecommendation,
}: {
  activeIntent: CoreIntent | null;
  onRequestRecommendation: (
    intent: CoreIntent,
    options?: {
      announceUser?: boolean;
      assistantPrefix?: string;
    },
  ) => Promise<void>;
}) {
  const [hasOpened, setHasOpened] = useState(false);

  return (
    <details
      className="operator-disclosure"
      onToggle={(event) => {
        if (event.currentTarget.open) {
          setHasOpened(true);
        }
      }}
    >
      <summary className="operator-disclosure-summary">
        <span>
          <strong>Demo Controls</strong>
          <span className="operator-disclosure-copy">
            Expand only if you are operating the live venue demo.
          </span>
        </span>
      </summary>

      {hasOpened ? (
        <Suspense
          fallback={
            <section
              className="recommendation-card panel-card"
              aria-label="Demo controls"
            >
              <div className="status-row">
                <span className="section-title">Demo Controls</span>
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
            onRequestRecommendation={onRequestRecommendation}
          />
        </Suspense>
      ) : null}
    </details>
  );
}

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
  const demoControlsRef = useRef<HTMLElement | null>(null);

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
      <span
        className="visually-hidden"
        role="status"
        aria-live="polite"
      >
        {isLoading ? "Loading recommendation…" : response ? "Recommendation ready." : ""}
      </span>
      <div className="ambient-orb ambient-orb-one" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-two" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-three" aria-hidden="true" />

      <section id="main-content" className="hero-card">
        <header className="hero-header">
          <nav className="top-nav" aria-label="Page sections">
            <span className="top-nav-brand">{APP_NAME}</span>
            <div className="top-nav-links">
              <button
                className="top-nav-link"
                type="button"
                onClick={scrollToDemo}
              >
                Try Demo
              </button>
              <button
                className="top-nav-link"
                type="button"
                onClick={scrollToDemoControls}
              >
                Demo Controls
              </button>
            </div>
          </nav>

          <div className="hero-layout">
            <div className="hero-copy">
              <p className="eyebrow">Live Venue Flow Assistant</p>
              <h1>{APP_NAME}</h1>
              <p className="lede">{APP_TAGLINE}</p>
              <p className="supporting-copy">
                A real-time event assistant that tells attendees where to go,
                whether to move now or wait, and how to avoid the worst venue
                congestion with clear, confident guidance.
              </p>

              <div className="hero-action-row">
                <button
                  className="hero-action-button hero-action-primary"
                  type="button"
                  onClick={() => {
                    scrollToDemo();
                    void requestRecommendation("food");
                  }}
                >
                  Try the Food Demo
                </button>
                <button
                  className="hero-action-button"
                  type="button"
                  onClick={scrollToDemo}
                >
                  See How It Works
                </button>
                <p className="hero-action-supporting-text">
                  New here? Start with <strong>Food</strong> to see the clearest
                  end-to-end recommendation flow.
                </p>
              </div>
            </div>

            <aside className="hero-visual-card" aria-label="Product preview">
              <div className="hero-visual-copy">
                <span className="summary-label">Product snapshot</span>
                <strong className="summary-value">
                  Built for chaotic venue moments
                </strong>
                <p className="section-supporting-text">
                  The assistant balances route length, queues, and timing
                  changes so the next move feels obvious.
                </p>
              </div>

              <svg
                aria-hidden="true"
                className="route-illustration"
                viewBox="0 0 320 200"
              >
                <defs>
                  <linearGradient
                    id="routeGradient"
                    x1="0%"
                    x2="100%"
                    y1="0%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#22D3EE" />
                    <stop offset="100%" stopColor="#38BDF8" />
                  </linearGradient>
                </defs>
                <path
                  d="M32 154C76 148 95 102 135 102C165 102 177 130 206 130C241 130 254 74 290 62"
                  fill="none"
                  stroke="url(#routeGradient)"
                  strokeDasharray="8 6"
                  strokeLinecap="round"
                  strokeWidth="6"
                />
                <circle cx="32" cy="154" fill="#22D3EE" r="10" />
                <circle cx="135" cy="102" fill="#38BDF8" r="10" />
                <circle cx="206" cy="130" fill="#F97316" r="10" />
                <circle cx="290" cy="62" fill="#34D399" r="12" />
                <rect
                  fill="rgba(34, 211, 238, 0.12)"
                  height="44"
                  rx="16"
                  width="112"
                  x="168"
                  y="12"
                />
                <text
                  fill="#F1F5F9"
                  fontFamily="DM Sans, sans-serif"
                  fontSize="13"
                  x="184"
                  y="30"
                >
                  Best route
                </text>
                <text
                  fill="#94A3B8"
                  fontFamily="DM Sans, sans-serif"
                  fontSize="12"
                  x="184"
                  y="46"
                >
                  3 min saved
                </text>
              </svg>
            </aside>
          </div>

          <div className="summary-strip" aria-label="Current operating summary">
            {heroHighlights.map((highlight) => (
              <article key={highlight.label} className="summary-card">
                <span className="summary-label">{highlight.label}</span>
                <strong className="summary-value">{highlight.value}</strong>
              </article>
            ))}
          </div>

          <section
            className="benefit-grid"
            aria-label="Why this product matters"
          >
            {productBenefits.map((benefit) => (
              <article key={benefit.title} className="benefit-card">
                <div className="benefit-card-icon">{benefit.icon}</div>
                <strong className="benefit-title">{benefit.title}</strong>
                <p className="benefit-description">{benefit.description}</p>
              </article>
            ))}
          </section>
        </header>

        <div className="app-grid" ref={demoSectionRef}>
          <div className="primary-column">
            <section
              className="panel-card step-panel"
              aria-label="How to use this page"
            >
              <div className="panel-heading-row">
                <div>
                  <p className="section-title">How It Works</p>
                  <p className="section-supporting-text">
                    This page is designed for first-time visitors: move from top
                    to bottom and left to right.
                  </p>
                </div>
                <span className="status-pill status-pill-muted">
                  Beginner-friendly flow
                </span>
              </div>

              <div className="step-grid">
                {attendeeSteps.map((step) => (
                  <article key={step.title} className="step-card">
                    <div className="step-card-icon">{step.icon}</div>
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
                    aria-describedby="section-help"
                    autoCapitalize="characters"
                    autoComplete="off"
                    name="section"
                    spellCheck={false}
                    value={section}
                    onChange={(event) => setSection(event.target.value)}
                  />
                  <small id="section-help" className="field-help-text">
                    Example: section-a12 or your venue block/zone.
                  </small>
                </label>

                <label className="field">
                  <span>Party Size</span>
                  <input
                    aria-describedby="party-size-help"
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
                  <small id="party-size-help" className="field-help-text">
                    Supports single visitors through small groups of 12.
                  </small>
                </label>

                <label className="field">
                  <span>Event Phase</span>
                  <select
                    aria-describedby="event-phase-help"
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
                  <small id="event-phase-help" className="field-help-text">
                    Use break or post-event to preview the clearest crowd
                    shifts.
                  </small>
                </label>

                <label className="field">
                  <span>Mobility</span>
                  <select
                    aria-describedby="mobility-help"
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
                  <small id="mobility-help" className="field-help-text">
                    Choose accessible if the route should avoid tighter or
                    harder paths.
                  </small>
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
                    aria-pressed={intent === activeIntent}
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
                    <span className="intent-action-copy">
                      Ask for guidance →
                    </span>
                  </button>
                ))}
              </div>

              <div className="hint-banner">
                <strong>Tip:</strong> Start with <span>Food</span> or{" "}
                <span>Exit</span> during the demo to see the clearest route
                changes.
              </div>
            </section>

            <ConversationPanel
              errorMessage={errorMessage}
              isLoading={isLoading}
              messages={messages}
            />
            <div ref={recommendationSectionRef}>
              <RecommendationPanel response={response} isLoading={isLoading} />
            </div>
            <VenueMapPanel response={response} />
          </div>

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
