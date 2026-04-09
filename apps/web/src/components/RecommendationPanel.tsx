import type { AssistantApiResponse } from "../types";

interface RecommendationPanelProps {
  response: AssistantApiResponse | null;
}

export function RecommendationPanel({ response }: RecommendationPanelProps) {
  if (!response) {
    return null;
  }

  return (
    <section
      className="recommendation-card"
      aria-label="Recommendation details"
    >
      <div className="status-row">
        <span className="section-title">Current recommendation</span>
        <span className="status-pill">
          {response.recommendation.timingDecision === "wait"
            ? "Wait"
            : "Go now"}
        </span>
      </div>

      <h2>{response.recommendation.primaryOption.label}</h2>
      <p>{response.recommendation.waitOrGoReason}</p>

      <dl className="stat-grid">
        <div>
          <dt>ETA</dt>
          <dd>{response.recommendation.etaMinutes} min</dd>
        </div>
        <div>
          <dt>Queue</dt>
          <dd>{response.recommendation.waitMinutes} min</dd>
        </div>
        <div>
          <dt>Time saved</dt>
          <dd>{response.recommendation.timeSavedMinutes} min</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{response.recommendation.confidence}</dd>
        </div>
      </dl>

      <p className="route-summary">{response.recommendation.routeSummary}</p>
      {response.recommendation.crowdWarning ? (
        <p className="warning-banner">{response.recommendation.crowdWarning}</p>
      ) : null}
      {response.recommendation.fallbackOption ? (
        <p className="fallback-note">
          Fallback: {response.recommendation.fallbackOption.label}
        </p>
      ) : null}
    </section>
  );
}
