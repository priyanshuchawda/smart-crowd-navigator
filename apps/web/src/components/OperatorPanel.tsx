import { useEffect, useState } from "react";

import type { DestinationState } from "@smart-crowd-navigator/venue-engine";

interface OperatorPanelProps {
  currentOperatorEmail?: string | null;
  errorMessage: string | null;
  isUpdating: boolean;
  onReset: () => void;
  onSignOut?: () => void;
  onUpdate: (nextState: DestinationState) => void;
  states: DestinationState[];
}

export function OperatorPanel({
  currentOperatorEmail,
  errorMessage,
  isUpdating,
  onReset,
  onSignOut,
  onUpdate,
  states,
}: OperatorPanelProps) {
  const [draftStates, setDraftStates] = useState<DestinationState[]>(states);

  useEffect(() => {
    setDraftStates(states);
  }, [states]);

  return (
    <section className="recommendation-card" aria-label="Operator console">
      <div className="status-row">
        <div>
          <span className="section-title">Operator console</span>
          {currentOperatorEmail ? (
            <p className="operator-meta">Signed in as {currentOperatorEmail}</p>
          ) : null}
        </div>
        <div className="chip-row">
          <span className="status-pill">
            {isUpdating ? "Updating…" : "Ready"}
          </span>
          {onSignOut ? (
            <button
              className="chip"
              disabled={isUpdating}
              type="button"
              onClick={onSignOut}
            >
              Sign out
            </button>
          ) : null}
          <button
            className="chip"
            disabled={isUpdating}
            type="button"
            onClick={onReset}
          >
            Reset live state
          </button>
        </div>
      </div>

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

      <div className="operator-grid">
        {draftStates.map((state) => (
          <article key={state.nodeId} className="operator-card">
            <h3>{state.nodeId}</h3>
            <label className="field">
              <span>Queue minutes</span>
              <input
                type="number"
                value={state.queueMinutes}
                onChange={(event) =>
                  setDraftStates((current) =>
                    current.map((candidate) =>
                      candidate.nodeId === state.nodeId
                        ? {
                            ...candidate,
                            queueMinutes: Number.parseInt(
                              event.target.value || "0",
                              10,
                            ),
                          }
                        : candidate,
                    ),
                  )
                }
              />
            </label>
            <label className="field">
              <span>Crowd penalty</span>
              <input
                type="number"
                value={state.crowdPenalty}
                onChange={(event) =>
                  setDraftStates((current) =>
                    current.map((candidate) =>
                      candidate.nodeId === state.nodeId
                        ? {
                            ...candidate,
                            crowdPenalty: Number.parseInt(
                              event.target.value || "0",
                              10,
                            ),
                          }
                        : candidate,
                    ),
                  )
                }
              />
            </label>
            <label className="field">
              <span>Queue trend / 5 min</span>
              <input
                type="number"
                value={state.queueTrendAfterFiveMinutes}
                onChange={(event) =>
                  setDraftStates((current) =>
                    current.map((candidate) =>
                      candidate.nodeId === state.nodeId
                        ? {
                            ...candidate,
                            queueTrendAfterFiveMinutes: Number.parseInt(
                              event.target.value || "0",
                              10,
                            ),
                          }
                        : candidate,
                    ),
                  )
                }
              />
            </label>
            <button
              className="chip"
              disabled={isUpdating}
              type="button"
              onClick={() => onUpdate(state)}
            >
              Apply change
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
