import type { RefObject } from "react";

import type { AssistantApiResponse } from "../types";

interface RecommendationPanelProps {
  headingRef?: RefObject<HTMLHeadingElement | null>;
  response: AssistantApiResponse | null;
}

export function RecommendationPanel({
  headingRef,
  response,
}: RecommendationPanelProps) {
  if (!response) {
    return (
      <section
        className="recommendation-card panel-card"
        aria-label="Recommendation details"
      >
        <div className="panel-heading-row">
          <div>
            <span className="section-title">Current Recommendation</span>
            <p className="section-supporting-text">
              Your live route, wait/go guidance, and fallback option will appear
              here after you choose a goal.
            </p>
          </div>
          <span className="status-pill status-pill-muted">
            Waiting for input
          </span>
        </div>

        <div className="empty-state-card recommendation-placeholder">
          <p className="empty-state-title">No recommendation yet</p>
          <p className="empty-state">
            Complete the attendee context, choose one quick action, and the page
            will immediately explain where to go next.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="recommendation-card panel-card"
      aria-label="Recommendation details"
    >
      <div className="panel-heading-row">
        <div>
          <span className="section-title">Current Recommendation</span>
          <p className="section-supporting-text">
            A live suggestion based on current venue pressure and route timing.
          </p>
        </div>
        <span className="status-pill status-pill-accent">
          {response.recommendation.timingDecision === "wait"
            ? "Wait"
            : "Go Now"}
        </span>
      </div>

      <div aria-live="polite" aria-atomic="true">
        <div className="recommendation-hero">
          <div>
            <p className="recommendation-kicker">Best next move</p>
            <h2 ref={headingRef} tabIndex={-1}>
              {response.recommendation.primaryOption.label}
            </h2>
            <p className="recommendation-copy">
              {response.recommendation.waitOrGoReason}
            </p>
          </div>
          <div className="recommendation-badge-card">
            <span className="summary-label">Confidence</span>
            <strong className="summary-value">
              {response.recommendation.confidence}
            </strong>
          </div>
        </div>

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
            <dt>Time Saved</dt>
            <dd>{response.recommendation.timeSavedMinutes} min</dd>
          </div>
          <div>
            <dt>Decision</dt>
            <dd>{response.recommendation.timingDecision}</dd>
          </div>
        </dl>
      </div>

      <div className="detail-stack">
        <div className="detail-card">
          <span className="summary-label">Recommended route</span>
          <p className="route-summary">
            {response.recommendation.routeSummary}
          </p>
        </div>

        {response.recommendation.crowdWarning ? (
          <p className="warning-banner" role="alert">
            {response.recommendation.crowdWarning}
          </p>
        ) : null}

        {response.recommendation.fallbackOption ? (
          <div className="fallback-card">
            <span className="summary-label">Backup option</span>
            <p className="fallback-note">
              {response.recommendation.fallbackOption.label}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
