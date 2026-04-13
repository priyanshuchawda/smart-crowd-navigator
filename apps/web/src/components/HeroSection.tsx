import {
  APP_NAME,
  APP_TAGLINE,
  type CoreIntent,
} from "@smart-crowd-navigator/shared";

import { intentLabels } from "../intent-metadata";

const productBenefits = [
  {
    description:
      "Combines venue context, timing, and crowd pressure so attendees know what to do next without second-guessing.",
    title: "Decision support under pressure",
  },
  {
    description:
      "Tells people whether they should move now or wait a few minutes for a better outcome — not just where to go.",
    title: "Wait-vs-go intelligence",
  },
  {
    description:
      "Operator updates can change attendee guidance live, which makes the demo feel like a real venue product instead of static mock data.",
    title: "Live operational awareness",
  },
];

interface HeroSectionProps {
  activeIntent: CoreIntent | null;
  onRequestFoodDemo: () => void;
  onScrollToDemo: () => void;
  onScrollToDemoControls: () => void;
  summary: string;
}

export function HeroSection({
  activeIntent,
  onRequestFoodDemo,
  onScrollToDemo,
  onScrollToDemoControls,
  summary,
}: HeroSectionProps) {
  const heroHighlights = [
    {
      label: "Current context",
      value: summary,
    },
    {
      label: "Decision mode",
      value: activeIntent ? intentLabels[activeIntent] : "Choose an action",
    },
    {
      label: "Response model",
      value: "Live Gemini + deterministic fallback",
    },
  ];

  return (
    <header className="hero-header">
      <nav className="top-nav" aria-label="Page sections">
        <span className="top-nav-brand">{APP_NAME}</span>
        <div className="top-nav-links">
          <button
            className="top-nav-link"
            type="button"
            onClick={onScrollToDemo}
          >
            Try Demo
          </button>
          <button
            className="top-nav-link"
            type="button"
            onClick={onScrollToDemoControls}
          >
            Demo Controls
          </button>
        </div>
      </nav>

      <div className="hero-layout">
        <div className="hero-copy">
          <p className="eyebrow">Live Venue Flow Assistant</p>
          <h1>{APP_NAME}</h1>
          <p className="lede">{APP_TAGLINE}</p>
          <p className="supporting-copy">
            A real-time event assistant that tells attendees where to go,
            whether to move now or wait, and how to avoid the worst venue
            congestion with clear, confident guidance.
          </p>

          <div className="hero-action-row">
            <button
              className="hero-action-button hero-action-primary"
              type="button"
              onClick={onRequestFoodDemo}
            >
              Try the Food Demo
            </button>
            <button
              className="hero-action-button"
              type="button"
              onClick={onScrollToDemo}
            >
              See How It Works
            </button>
            <p className="hero-action-supporting-text">
              New here? Start with <strong>Food</strong> to see the clearest
              end-to-end recommendation flow.
            </p>
          </div>
        </div>

        <aside className="hero-visual-card" aria-label="Product preview">
          <div className="hero-visual-copy">
            <span className="summary-label">Product snapshot</span>
            <strong className="summary-value">
              Built for chaotic venue moments
            </strong>
            <p className="section-supporting-text">
              The assistant balances route length, queues, and timing changes so
              the next move feels obvious.
            </p>
          </div>

          <svg
            aria-hidden="true"
            className="route-illustration"
            viewBox="0 0 320 200"
          >
            <defs>
              <linearGradient
                id="routeGradient"
                x1="0%"
                x2="100%"
                y1="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#22D3EE" />
                <stop offset="100%" stopColor="#38BDF8" />
              </linearGradient>
            </defs>
            <path
              d="M32 154C76 148 95 102 135 102C165 102 177 130 206 130C241 130 254 74 290 62"
              fill="none"
              stroke="url(#routeGradient)"
              strokeDasharray="8 6"
              strokeLinecap="round"
              strokeWidth="6"
            />
            <circle cx="32" cy="154" fill="#22D3EE" r="10" />
            <circle cx="135" cy="102" fill="#38BDF8" r="10" />
            <circle cx="206" cy="130" fill="#F97316" r="10" />
            <circle cx="290" cy="62" fill="#34D399" r="12" />
            <rect
              fill="rgba(34, 211, 238, 0.12)"
              height="44"
              rx="16"
              width="112"
              x="168"
              y="12"
            />
            <text
              fill="#F1F5F9"
              fontFamily="DM Sans, sans-serif"
              fontSize="13"
              x="184"
              y="30"
            >
              Best route
            </text>
            <text
              fill="#94A3B8"
              fontFamily="DM Sans, sans-serif"
              fontSize="12"
              x="184"
              y="46"
            >
              3 min saved
            </text>
          </svg>
        </aside>
      </div>

      <div className="summary-strip" aria-label="Current operating summary">
        {heroHighlights.map((highlight) => (
          <article key={highlight.label} className="summary-card">
            <span className="summary-label">{highlight.label}</span>
            <strong className="summary-value">{highlight.value}</strong>
          </article>
        ))}
      </div>

      <section className="benefit-grid" aria-label="Why this product matters">
        {productBenefits.map((benefit) => (
          <article key={benefit.title} className="benefit-card">
            <strong className="benefit-title">{benefit.title}</strong>
            <p className="benefit-description">{benefit.description}</p>
          </article>
        ))}
      </section>
    </header>
  );
}
