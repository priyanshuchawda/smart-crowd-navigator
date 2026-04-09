import { useEffect, useMemo, useRef, useState } from "react";

import {
  APP_NAME,
  APP_TAGLINE,
  CORE_INTENTS,
  type CoreIntent,
  EVENT_PHASES,
  MOBILITY_MODES,
} from "@smart-crowd-navigator/shared";
import type { DestinationState } from "@smart-crowd-navigator/venue-engine";

import {
  getOperatorState,
  requestAssistantResponse,
  resetOperatorState,
  syncOperatorStates,
  updateOperatorState,
} from "./api";
import { ConversationPanel } from "./components/ConversationPanel";
import { OperatorPanel } from "./components/OperatorPanel";
import { RecommendationPanel } from "./components/RecommendationPanel";
import {
  getFirebaseOperatorStates,
  hasFirebaseConfig,
  setFirebaseOperatorStates,
  subscribeToFirebaseOperatorStates,
} from "./firebase";
import type { AssistantApiResponse, ChatMessage } from "./types";

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
  const [operatorStates, setOperatorStates] = useState<DestinationState[]>([]);
  const [operatorErrorMessage, setOperatorErrorMessage] = useState<
    string | null
  >(null);
  const [isOperatorUpdating, setIsOperatorUpdating] = useState(false);
  const activeIntentRef = useRef<CoreIntent | null>(null);
  const requestVersionRef = useRef(0);

  const summary = useMemo(
    () =>
      `${section} · party of ${partySize} · ${eventPhase.replace("-", " ")} · ${mobilityMode}`,
    [eventPhase, mobilityMode, partySize, section],
  );

  useEffect(() => {
    activeIntentRef.current = activeIntent;
  }, [activeIntent]);

  useEffect(() => {
    let ignore = false;
    let unsubscribe = () => {};

    const loadLocalState = async (message?: string) => {
      const payload = await getOperatorState();

      if (!ignore) {
        setOperatorStates(payload.states);
        setOperatorErrorMessage(message ?? null);
      }

      return payload.states;
    };

    async function bootstrapOperatorState() {
      try {
        if (!hasFirebaseConfig) {
          await loadLocalState();
          return;
        }

        const firebaseStates = await getFirebaseOperatorStates();

        if (firebaseStates && firebaseStates.length > 0) {
          await syncOperatorStates(firebaseStates);

          if (!ignore) {
            setOperatorStates(firebaseStates);
            setOperatorErrorMessage(null);
          }
        } else {
          const localStates = await loadLocalState();
          await setFirebaseOperatorStates(localStates);
        }

        unsubscribe = subscribeToFirebaseOperatorStates(
          (states) => {
            if (ignore) {
              return;
            }

            setOperatorStates(states);
            setOperatorErrorMessage(null);
            void syncOperatorStates(states);

            if (activeIntentRef.current) {
              void requestRecommendation(activeIntentRef.current, {
                announceUser: false,
                assistantPrefix: "Live update:",
              });
            }
          },
          async () => {
            await loadLocalState(
              "Firebase operator sync failed, using local API state.",
            );
          },
        );
      } catch {
        await loadLocalState(
          "Firebase operator sync failed, using local API state.",
        );
      }
    }

    void bootstrapOperatorState();

    return () => {
      ignore = true;
      unsubscribe();
    };
  }, []);

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

  async function handleIntent(intent: CoreIntent) {
    await requestRecommendation(intent);
  }

  async function handleOperatorUpdate(nextState: DestinationState) {
    setIsOperatorUpdating(true);
    setOperatorErrorMessage(null);

    try {
      if (hasFirebaseConfig) {
        const nextStates = operatorStates.map((state) =>
          state.nodeId === nextState.nodeId ? nextState : state,
        );
        await setFirebaseOperatorStates(nextStates);
      } else {
        const payload = await updateOperatorState(nextState);
        setOperatorStates(payload.states);

        if (activeIntent) {
          await requestRecommendation(activeIntent, {
            announceUser: false,
            assistantPrefix: "Live update:",
          });
        }
      }
    } catch (error) {
      setOperatorErrorMessage(
        error instanceof Error
          ? error.message
          : "Operator update failed. Try again.",
      );
    } finally {
      setIsOperatorUpdating(false);
    }
  }

  async function handleOperatorReset() {
    setIsOperatorUpdating(true);
    setOperatorErrorMessage(null);

    try {
      if (hasFirebaseConfig) {
        const payload = await resetOperatorState();
        await setFirebaseOperatorStates(payload.states);
      } else {
        const payload = await resetOperatorState();
        setOperatorStates(payload.states);

        if (activeIntent) {
          await requestRecommendation(activeIntent, {
            announceUser: false,
            assistantPrefix: "Live update:",
          });
        }
      }
    } catch (error) {
      setOperatorErrorMessage(
        error instanceof Error
          ? error.message
          : "Operator reset failed. Try again.",
      );
    } finally {
      setIsOperatorUpdating(false);
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
                onClick={() => void handleIntent(intent)}
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
        <OperatorPanel
          errorMessage={operatorErrorMessage}
          isUpdating={isOperatorUpdating}
          onReset={() => void handleOperatorReset()}
          onUpdate={(state) => void handleOperatorUpdate(state)}
          states={operatorStates}
        />
      </section>
    </main>
  );
}
