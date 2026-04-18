import { type RefObject, memo, useEffect, useState } from "react";

import {
  type PlaceEnrichmentResponse,
  getGroundedPlaceEnrichment,
} from "../api";
import type { AssistantApiResponse } from "../types";

interface RecommendationPanelProps {
  headingRef?: RefObject<HTMLHeadingElement | null>;
  response: AssistantApiResponse | null;
  isLoading?: boolean;
}

const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";

function buildGroundingPreviewUrl(
  place: NonNullable<AssistantApiResponse["grounding"]>["places"][number],
) {
  if (googleMapsApiKey) {
    const query = place.placeId ? `place_id:${place.placeId}` : place.title;

    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(
      googleMapsApiKey,
    )}&q=${encodeURIComponent(query)}`;
  }

  return `https://www.google.com/maps?q=${encodeURIComponent(
    place.title,
  )}&output=embed`;
}

function GroundedPlaceDetails({
  place,
  widgetContextToken,
}: {
  place: NonNullable<AssistantApiResponse["grounding"]>["places"][number];
  widgetContextToken?: string;
}) {
  const [placeEnrichment, setPlaceEnrichment] =
    useState<PlaceEnrichmentResponse | null>(null);
  const [placeEnrichmentError, setPlaceEnrichmentError] = useState<
    string | null
  >(null);
  const [isPlaceEnrichmentLoading, setIsPlaceEnrichmentLoading] =
    useState(false);

  useEffect(() => {
    const placeId = place.placeId;

    if (!placeId) {
      setPlaceEnrichment(null);
      setPlaceEnrichmentError(null);
      setIsPlaceEnrichmentLoading(false);
      return;
    }

    const safePlaceId: string = placeId;

    const controller = new AbortController();
    setIsPlaceEnrichmentLoading(true);
    setPlaceEnrichmentError(null);

    async function loadPlaceEnrichment() {
      try {
        const details = await getGroundedPlaceEnrichment(
          safePlaceId,
          controller.signal,
        );

        if (!controller.signal.aborted) {
          setPlaceEnrichment(details);
        }
      } catch {
        if (!controller.signal.aborted) {
          setPlaceEnrichment(null);
          setPlaceEnrichmentError(
            "Places details unavailable. Showing map preview only.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsPlaceEnrichmentLoading(false);
        }
      }
    }

    void loadPlaceEnrichment();

    return () => controller.abort();
  }, [place.placeId]);

  return (
    <>
      <iframe
        className="grounding-map-preview"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={buildGroundingPreviewUrl(place)}
        title={`Map preview for ${place.title}`}
      />

      {isPlaceEnrichmentLoading ? (
        <output className="field-help-text" aria-live="polite">
          Loading place details…
        </output>
      ) : null}

      {placeEnrichmentError ? (
        <output className="error-banner" aria-live="polite">
          {placeEnrichmentError}
        </output>
      ) : null}

      {placeEnrichment ? (
        <div className="places-enrichment-card">
          <p className="rationale-heading">Places API enrichment</p>
          <div className="places-enrichment-grid">
            {placeEnrichment.displayName ? (
              <span className="places-enrichment-pill">
                {placeEnrichment.displayName}
              </span>
            ) : null}
            {typeof placeEnrichment.rating === "number" ? (
              <span className="places-enrichment-pill">
                {placeEnrichment.rating.toFixed(1)} / 5 rating
              </span>
            ) : null}
            {typeof placeEnrichment.reviewCount === "number" ? (
              <span className="places-enrichment-pill">
                {placeEnrichment.reviewCount} reviews
              </span>
            ) : null}
            {placeEnrichment.openNow !== null ? (
              <span className="places-enrichment-pill">
                {placeEnrichment.openNow ? "Open now" : "Closed now"}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <p className="field-help-text">
        {googleMapsApiKey
          ? "Official Google Maps Embed API preview is active from VITE_GOOGLE_MAPS_API_KEY for this grounded place. Place details are fetched through a secured backend proxy."
          : "Set VITE_GOOGLE_MAPS_API_KEY to upgrade this preview to the official Google Maps Embed API."}{" "}
        {widgetContextToken
          ? "A Gemini widget context token is also available for richer handoff."
          : null}
      </p>
    </>
  );
}

/** Displays the current venue recommendation with timing advice, route, group plan, and Maps grounding. */
const RecommendationPanel = memo(function RecommendationPanel({
  headingRef,
  response,
  isLoading,
}: RecommendationPanelProps) {
  const groundedPlaces = response?.grounding?.places ?? [];
  const primaryGroundedPlace = groundedPlaces[0] ?? null;

  if (isLoading) {
    return (
      <section
        className="recommendation-card panel-card loading-shimmer-card"
        aria-label="Loading recommendation"
      >
        <div className="panel-heading-row">
          <div>
            <div className="skeleton-line recommendation-skeleton-heading" />
            <div className="skeleton-line recommendation-skeleton-copy" />
          </div>
          <div className="status-pill status-pill-muted">Calculating…</div>
        </div>
        <div className="recommendation-skeleton-stack">
          <div className="skeleton-line recommendation-skeleton-hero" />
          <div className="stat-grid">
            <div className="skeleton-line recommendation-skeleton-stat" />
            <div className="skeleton-line recommendation-skeleton-stat" />
            <div className="skeleton-line recommendation-skeleton-stat" />
            <div className="skeleton-line recommendation-skeleton-stat" />
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

  const groupPlan = response.recommendation.groupPlan;
  const operationalAdvisory = response.recommendation.operationalAdvisory;

  return (
    <section
      className="recommendation-card panel-card"
      aria-label="Recommendation details"
    >
      <div className="panel-heading-row">
        <div>
          <span className="section-title">Current Recommendation</span>
          <p className="section-supporting-text">
            A live suggestion based on current venue pressure, route timing, and
            optional Google Maps grounding.
          </p>
        </div>
        <span
          className={`status-pill ${
            response.recommendation.timingDecision === "wait"
              ? "status-pill-warning"
              : "status-pill-accent"
          }`}
        >
          {response.recommendation.timingDecision === "wait"
            ? "Wait"
            : "Go Now"}
        </span>
      </div>

      <div aria-atomic="true" aria-live="polite">
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
          <div className="stat-item">
            <dt>ETA</dt>
            <dd>{response.recommendation.etaMinutes} min</dd>
          </div>
          <div className="stat-item">
            <dt>Queue</dt>
            <dd>{response.recommendation.waitMinutes} min</dd>
          </div>
          <div className="stat-item">
            <dt>Time Saved</dt>
            <dd>{response.recommendation.timeSavedMinutes} min</dd>
          </div>
          <div className="stat-item">
            <dt>Decision</dt>
            <dd
              className={
                response.recommendation.timingDecision === "wait"
                  ? "stat-value-warning"
                  : "stat-value-success"
              }
            >
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
            {response.recommendation.crowdWarning}
          </p>
        ) : null}

        {response.recommendation.fallbackOption ? (
          <div className="fallback-card detail-card">
            <span className="summary-label">Backup option</span>
            <p className="fallback-note">
              {response.recommendation.fallbackOption.label}
            </p>
          </div>
        ) : null}

        <section
          className="detail-card rationale-card"
          aria-label="Why this recommendation"
        >
          <div className="panel-heading-row">
            <div>
              <span className="section-title">Why this recommendation</span>
              <p className="section-supporting-text">
                The engine is surfacing the best tradeoff it sees right now.
              </p>
            </div>
          </div>

          <div className="rationale-columns">
            <div>
              <p className="rationale-heading">Strengths</p>
              <ul className="rationale-list">
                {response.recommendation.decisionReasons.strengths.map(
                  (strength) => (
                    <li key={strength} className="rationale-positive">
                      {strength}
                    </li>
                  ),
                )}
              </ul>
            </div>
            <div>
              <p className="rationale-heading">Tradeoffs</p>
              <ul className="rationale-list">
                {response.recommendation.decisionReasons.tradeoffs.length >
                0 ? (
                  response.recommendation.decisionReasons.tradeoffs.map(
                    (tradeoff) => (
                      <li key={tradeoff} className="rationale-negative">
                        {tradeoff}
                      </li>
                    ),
                  )
                ) : (
                  <li className="rationale-neutral">
                    No major downside is dominating the current route.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </section>

        {operationalAdvisory ? (
          <section
            className={`detail-card operational-advisory-card operational-advisory-${operationalAdvisory.severity}`}
            aria-label="Operational advisory"
          >
            <div className="panel-heading-row">
              <div>
                <span className="section-title">
                  {operationalAdvisory.headline}
                </span>
                <p className="section-supporting-text">
                  {operationalAdvisory.detail}
                </p>
              </div>
              <span className="status-pill status-pill-warning">
                {operationalAdvisory.severity === "warning"
                  ? "Failure mode"
                  : "Hold guidance"}
              </span>
            </div>
            <p className="operational-advisory-action">
              {operationalAdvisory.recommendedAction}
            </p>
          </section>
        ) : null}

        {groupPlan ? (
          <section
            className="detail-card group-plan-card"
            aria-label="Group coordinator plan"
          >
            <div className="panel-heading-row">
              <div>
                <span className="section-title">Group coordinator plan</span>
                <p className="section-supporting-text">{groupPlan.headline}</p>
              </div>
              <span className="status-pill status-pill-muted">
                {groupPlan.workflowType}
              </span>
            </div>
            <div className="group-plan-meta">
              <p>
                <strong>Regroup at</strong> {groupPlan.regroupSpot}
              </p>
              <p>
                <strong>Meet-up ETA</strong> {groupPlan.regroupEtaMinutes} min
              </p>
              <p>
                <strong>Split recommended</strong>{" "}
                {groupPlan.splitRecommended ? "Yes" : "No"}
              </p>
            </div>
            <ul className="group-plan-steps">
              {groupPlan.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {groundedPlaces.length > 0 ? (
          <section
            className="detail-card grounding-card"
            aria-label="Google Maps grounding"
          >
            <div className="panel-heading-row">
              <div>
                <span className="section-title">Google Maps grounding</span>
                <p className="section-supporting-text">
                  Nearby-place guidance grounded outside the venue perimeter.
                </p>
              </div>
              <span className="status-pill status-pill-accent">
                {groundedPlaces.length} cited place
                {groundedPlaces.length === 1 ? "" : "s"}
              </span>
            </div>

            <ul
              className="grounding-place-list"
              aria-label="Grounded nearby places"
            >
              {groundedPlaces.map((place) => (
                <li key={place.uri}>
                  <a href={place.uri} rel="noreferrer" target="_blank">
                    {place.title}
                  </a>
                </li>
              ))}
            </ul>

            {primaryGroundedPlace ? (
              <GroundedPlaceDetails
                place={primaryGroundedPlace}
                widgetContextToken={response.grounding?.widgetContextToken}
              />
            ) : null}
          </section>
        ) : null}
      </div>
    </section>
  );
});

export { RecommendationPanel };
