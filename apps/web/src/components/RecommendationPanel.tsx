import type { AssistantApiResponse } from "../types";

interface RecommendationPanelProps {
  response: AssistantApiResponse | null;
  isLoading?: boolean;
}

/** Displays the current venue recommendation with timing advice, route, and fallback. */
export function RecommendationPanel({ response, isLoading }: RecommendationPanelProps) {
  if (isLoading) {
    return (
      <section
        className="recommendation-card panel-card loading-shimmer-card"
        aria-label="Loading recommendation"
      >
        <div className="panel-heading-row">
          <div>
            <div className="skeleton-line" style={{ width: "200px", marginBottom: "8px" }} />
            <div className="skeleton-line" style={{ width: "300px" }} />
          </div>
          <div className="status-pill status-pill-muted">Calculating…</div>
        </div>
        <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
          <div className="skeleton-line" style={{ height: "100px", borderRadius: "var(--radius-xl)" }} />
          <div className="stat-grid">
            <div className="skeleton-line" style={{ height: "60px" }} />
            <div className="skeleton-line" style={{ height: "60px" }} />
            <div className="skeleton-line" style={{ height: "60px" }} />
            <div className="skeleton-line" style={{ height: "60px" }} />
          </div>
        </div>
      </section>
    );
  }

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
        <span className={`status-pill ${response.recommendation.timingDecision === "wait" ? "status-pill-warning" : "status-pill-accent"}`}>
          {response.recommendation.timingDecision === "wait"
            ? "Wait"
            : "Go Now"}
        </span>
      </div>

      <div aria-live="polite" aria-atomic="true">
        <div className="recommendation-hero">
          <div>
            <p className="recommendation-kicker">Best next move</p>
            <h2>{response.recommendation.primaryOption.label}</h2>
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
          <div className="stat-item">
            <dt>
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              ETA
            </dt>
            <dd>{response.recommendation.etaMinutes} min</dd>
          </div>
          <div className="stat-item">
            <dt>
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Queue
            </dt>
            <dd>{response.recommendation.waitMinutes} min</dd>
          </div>
          <div className="stat-item">
            <dt>
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              Time Saved
            </dt>
            <dd>{response.recommendation.timeSavedMinutes} min</dd>
          </div>
          <div className="stat-item">
            <dt>
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Decision
            </dt>
            <dd style={{ color: response.recommendation.timingDecision === 'wait' ? 'var(--accent-warning)' : 'var(--accent-success)' }}>
              {response.recommendation.timingDecision}
            </dd>
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
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', verticalAlign: 'text-bottom' }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
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
