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
      `${section} · party of ${partySize} · ${eventPhase.replace("-", " ")} · ${mobilityMode}`,
    [eventPhase, mobilityMode, partySize, section],
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
      <section className="hero-card">
        <p className="eyebrow">Issue #10 live recommendation refresh</p>
        <h1>{APP_NAME}</h1>
        <p className="lede">{APP_TAGLINE}</p>

        <div className="control-stack" aria-label="Attendee context">
          <label className="field">
            <span>Section</span>
            <input
              value={section}
              onChange={(event) => setSection(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Party size</span>
            <input
              min={1}
              max={12}
              type="number"
              value={partySize}
              onChange={(event) =>
                setPartySize(Number.parseInt(event.target.value || "1", 10))
              }
            />
          </label>

          <label className="field">
            <span>Event phase</span>
            <select
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

        <section className="intent-panel" aria-label="Quick actions">
          <p className="section-title">What do you need?</p>
          <div className="chip-row">
            {CORE_INTENTS.map((intent) => (
              <button
                key={intent}
                className={intent === activeIntent ? "chip active" : "chip"}
                disabled={isLoading}
                type="button"
                onClick={() => void requestRecommendation(intent)}
              >
                {intentLabels[intent]}
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
        <Suspense
          fallback={
            <section
              className="recommendation-card"
              aria-label="Operator tools"
            >
              <div className="status-row">
                <span className="section-title">Operator tools</span>
                <span className="status-pill">Loading…</span>
              </div>
              <p className="empty-state">
                Loading operator tools in a separate bundle.
              </p>
            </section>
          }
        >
          <OperatorExperience
            activeIntent={activeIntent}
            onRequestRecommendation={requestRecommendation}
          />
        </Suspense>
      </section>
    </main>
  );
}
