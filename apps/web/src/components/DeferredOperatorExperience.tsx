import { Suspense, lazy, useState } from "react";

import type { CoreIntent } from "@smart-crowd-navigator/shared";

const OperatorExperience = lazy(async () => {
  const module = await import("./OperatorExperience");

  return {
    default: module.OperatorExperience,
  };
});

interface DeferredOperatorExperienceProps {
  activeIntent: CoreIntent | null;
  onRequestRecommendation: (
    intent: CoreIntent,
    options?: {
      announceUser?: boolean;
      assistantPrefix?: string;
    },
  ) => Promise<void>;
}

export function DeferredOperatorExperience({
  activeIntent,
  onRequestRecommendation,
}: DeferredOperatorExperienceProps) {
  const [hasOpened, setHasOpened] = useState(false);

  return (
    <details
      className="operator-disclosure"
      onToggle={(event) => {
        if (event.currentTarget.open) {
          setHasOpened(true);
        }
      }}
    >
      <summary className="operator-disclosure-summary">
        <span>
          <strong>Demo Controls</strong>
          <span className="operator-disclosure-copy">
            Expand only if you are operating the live venue demo.
          </span>
        </span>
      </summary>

      {hasOpened ? (
        <Suspense
          fallback={
            <section
              className="recommendation-card panel-card"
              aria-label="Demo controls"
            >
              <div className="status-row">
                <span className="section-title">Demo Controls</span>
                <span className="status-pill">Loading…</span>
              </div>
              <p className="empty-state">
                Loading live venue controls in a separate optimized bundle.
              </p>
            </section>
          }
        >
          <OperatorExperience
            activeIntent={activeIntent}
            onRequestRecommendation={onRequestRecommendation}
          />
        </Suspense>
      ) : null}
    </details>
  );
}
