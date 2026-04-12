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
    <section
      className="recommendation-card panel-card operator-shell"
      aria-label="Operator console"
    >
      <div className="panel-heading-row">
        <div>
          <span className="section-title">Operator Console</span>
          <p className="section-supporting-text">
            Live venue conditions update the attendee guidance immediately.
          </p>
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
              Sign Out
            </button>
          ) : null}
          <button
            className="chip"
            disabled={isUpdating}
            type="button"
            onClick={onReset}
          >
            Reset Live State
          </button>
        </div>
      </div>

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

      <div className="operator-grid">
        {draftStates.map((state) => (
          <article key={state.nodeId} className="operator-card">
            <div className="operator-card-header">
              <h3>{state.nodeId}</h3>
              <span className="summary-label">Live node</span>
            </div>
            <label className="field">
              <span>Queue Minutes</span>
              <input
                inputMode="numeric"
                name={`${state.nodeId}-queueMinutes`}
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
              <span>Crowd Penalty</span>
              <input
                inputMode="numeric"
                name={`${state.nodeId}-crowdPenalty`}
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
              <span>Queue Trend / 5 Min</span>
              <input
                inputMode="numeric"
                name={`${state.nodeId}-queueTrendAfterFiveMinutes`}
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
              className="chip primary-chip"
              disabled={isUpdating}
              type="button"
              onClick={() => onUpdate(state)}
            >
              Apply Change
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
