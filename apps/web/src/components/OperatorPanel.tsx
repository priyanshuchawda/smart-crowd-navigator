import type { DestinationState } from "@smart-crowd-navigator/venue-engine";

interface OperatorPanelProps {
  onReset: () => void;
  onUpdate: (nextState: DestinationState) => void;
  states: DestinationState[];
}

export function OperatorPanel({
  onReset,
  onUpdate,
  states,
}: OperatorPanelProps) {
  return (
    <section className="recommendation-card" aria-label="Operator console">
      <div className="status-row">
        <span className="section-title">Operator console</span>
        <button className="chip" type="button" onClick={onReset}>
          Reset live state
        </button>
      </div>

      <div className="operator-grid">
        {states.map((state) => (
          <article key={state.nodeId} className="operator-card">
            <h3>{state.nodeId}</h3>
            <label className="field">
              <span>Queue minutes</span>
              <input
                type="number"
                value={state.queueMinutes}
                onChange={(event) =>
                  onUpdate({
                    ...state,
                    queueMinutes: Number.parseInt(
                      event.target.value || "0",
                      10,
                    ),
                  })
                }
              />
            </label>
            <label className="field">
              <span>Crowd penalty</span>
              <input
                type="number"
                value={state.crowdPenalty}
                onChange={(event) =>
                  onUpdate({
                    ...state,
                    crowdPenalty: Number.parseInt(
                      event.target.value || "0",
                      10,
                    ),
                  })
                }
              />
            </label>
            <label className="field">
              <span>Queue trend / 5 min</span>
              <input
                type="number"
                value={state.queueTrendAfterFiveMinutes}
                onChange={(event) =>
                  onUpdate({
                    ...state,
                    queueTrendAfterFiveMinutes: Number.parseInt(
                      event.target.value || "0",
                      10,
                    ),
                  })
                }
              />
            </label>
          </article>
        ))}
      </div>
    </section>
  );
}
