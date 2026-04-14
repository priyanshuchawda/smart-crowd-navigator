import {
  type RefObject,
  createElement,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { AssistantApiResponse } from "../types";

interface RecommendationPanelProps {
  headingRef?: RefObject<HTMLHeadingElement | null>;
  response: AssistantApiResponse | null;
}

let googleMapsScriptPromise: Promise<void> | null = null;

function ensureGoogleMapsPlacesScript(apiKey: string) {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.customElements.get("gmp-place-contextual")) {
    return Promise.resolve();
  }

  if (!googleMapsScriptPromise) {
    googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-google-maps-contextual="true"]',
      );

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), {
          once: true,
        });
        existingScript.addEventListener(
          "error",
          () => reject(new Error("Google Maps script failed to load.")),
          {
            once: true,
          },
        );
        return;
      }

      const script = document.createElement("script");
      script.async = true;
      script.dataset.googleMapsContextual = "true";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=beta`;
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener(
        "error",
        () => reject(new Error("Google Maps script failed to load.")),
        {
          once: true,
        },
      );
      document.head.append(script);
    }).catch((error) => {
      googleMapsScriptPromise = null;
      throw error;
    });
  }

  return googleMapsScriptPromise;
}

function GroundingSection({
  response,
}: {
  response: AssistantApiResponse;
}) {
  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  const widgetToken = response.grounding?.widgetContextToken?.trim();
  const places = response.grounding?.places ?? [];
  const [widgetStatus, setWidgetStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");

  const widgetMarkup = useMemo(() => {
    if (!widgetToken || widgetStatus !== "ready") {
      return null;
    }

    return createElement("gmp-place-contextual", {
      "context-token": widgetToken,
    });
  }, [widgetStatus, widgetToken]);

  useEffect(() => {
    if (!widgetToken || !mapsApiKey) {
      setWidgetStatus("idle");
      return;
    }

    let ignore = false;
    setWidgetStatus("loading");

    void ensureGoogleMapsPlacesScript(mapsApiKey)
      .then(() => {
        if (!ignore) {
          setWidgetStatus("ready");
        }
      })
      .catch(() => {
        if (!ignore) {
          setWidgetStatus("error");
        }
      });

    return () => {
      ignore = true;
    };
  }, [widgetToken]);

  if (places.length === 0 && !widgetToken) {
    return null;
  }

  return (
    <section
      className="grounding-panel detail-card"
      aria-label="Google Maps sources"
    >
      <div className="grounding-header">
        <div>
          <span className="summary-label">Google Maps grounding</span>
          <p className="section-supporting-text">
            These nearby-place details came from Google Maps, while the indoor
            venue recommendation above still comes from the venue engine.
          </p>
        </div>
        <span className="status-pill status-pill-muted">Google Maps</span>
      </div>

      {places.length > 0 ? (
        <ul className="grounding-list">
          {places.map((place) => (
            <li key={`${place.uri}-${place.title}`} className="grounding-item">
              <a
                className="grounding-link"
                href={place.uri}
                rel="noreferrer"
                target="_blank"
              >
                <span className="grounding-link-title">{place.title}</span>
                <span className="grounding-link-copy">Open in Google Maps</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {widgetToken ? (
        <div className="widget-shell">
          <div className="grounding-widget-header">
            <span className="summary-label">Contextual place widget</span>
            <span className="status-pill status-pill-muted">
              {widgetStatus === "loading"
                ? "Loading…"
                : widgetStatus === "ready"
                  ? "Ready"
                  : "Optional"}
            </span>
          </div>
          {mapsApiKey ? (
            widgetStatus === "error" ? (
              <p className="field-help-text">
                Google Maps widget loading failed in this environment, but the
                citation links above remain available.
              </p>
            ) : widgetMarkup ? (
              <div className="grounding-widget">{widgetMarkup}</div>
            ) : (
              <p className="field-help-text">
                Loading the contextual Google Maps widget…
              </p>
            )
          ) : (
            <p className="field-help-text">
              Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to render the optional
              contextual Places widget. Citation links are still available
              without it.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
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

        <GroundingSection response={response} />
      </div>
    </section>
  );
}
