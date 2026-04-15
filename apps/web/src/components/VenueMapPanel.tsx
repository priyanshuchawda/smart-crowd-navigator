import type { AssistantApiResponse } from "../types";

interface VenueMapPanelProps {
  response: AssistantApiResponse | null;
}

/**
 * Renders an inline SVG venue layout showing sections, food stalls,
 * washrooms, gates, and exits. Highlights the recommended destination
 * when a recommendation is active.
 */
export function VenueMapPanel({ response }: VenueMapPanelProps) {
  const activeId = response?.recommendation?.primaryOption?.id ?? null;

  function nodeColor(id: string, defaultColor: string) {
    return id === activeId ? "#22D3EE" : defaultColor;
  }

  function nodeStroke(id: string) {
    return id === activeId ? "#22D3EE" : "none";
  }

  function nodeStrokeWidth(id: string) {
    return id === activeId ? 3 : 0;
  }

  return (
    <section
      className="panel-card venue-map-panel"
      aria-label="Venue layout map"
    >
      <div className="panel-heading-row">
        <div>
          <span className="section-title">Venue Layout</span>
          <p className="section-supporting-text">
            A live view of the stadium concourse. The highlighted node is the
            current recommendation.
          </p>
        </div>
        <span className="status-pill status-pill-muted">
          {activeId ? `Active: ${activeId}` : "No selection"}
        </span>
      </div>

      <svg
        viewBox="0 0 600 360"
        className="venue-map-svg"
        role="img"
        aria-label="Stadium venue map showing sections, food stalls, washrooms, gates, and exits"
      >
        {/* Stadium outline */}
        <ellipse
          cx="300"
          cy="180"
          rx="270"
          ry="155"
          fill="none"
          stroke="#1E293B"
          strokeWidth="2"
        />
        <ellipse
          cx="300"
          cy="180"
          rx="160"
          ry="85"
          fill="rgba(34,211,238,0.03)"
          stroke="#1E293B"
          strokeWidth="1.5"
          strokeDasharray="6 4"
        />
        <text
          x="270"
          y="185"
          fill="#334155"
          fontSize="14"
          fontFamily="DM Sans, sans-serif"
          fontWeight="600"
        >
          PITCH
        </text>

        {/* Sections */}
        <rect
          x="96"
          y="84"
          width="60"
          height="36"
          rx="6"
          fill="#1E293B"
          stroke={nodeStroke("section-a12")}
          strokeWidth={nodeStrokeWidth("section-a12")}
        />
        <text
          x="108"
          y="107"
          fill="#94A3B8"
          fontSize="10"
          fontFamily="DM Sans, sans-serif"
        >
          A-12
        </text>

        <rect
          x="444"
          y="84"
          width="60"
          height="36"
          rx="6"
          fill="#1E293B"
          stroke={nodeStroke("section-c04")}
          strokeWidth={nodeStrokeWidth("section-c04")}
        />
        <text
          x="456"
          y="107"
          fill="#94A3B8"
          fontSize="10"
          fontFamily="DM Sans, sans-serif"
        >
          C-04
        </text>

        {/* Food Stalls */}
        <circle
          cx="180"
          cy="52"
          r="18"
          fill={nodeColor("stall-b", "#1E293B")}
          stroke={nodeStroke("stall-b")}
          strokeWidth={nodeStrokeWidth("stall-b")}
          opacity={activeId === "stall-b" ? 1 : 0.85}
        />
        <text
          x="168"
          y="56"
          fill={activeId === "stall-b" ? "#0F172A" : "#F97316"}
          fontSize="9"
          fontWeight="700"
          fontFamily="DM Sans, sans-serif"
        >
          STL-B
        </text>

        <circle
          cx="420"
          cy="52"
          r="18"
          fill={nodeColor("stall-d", "#1E293B")}
          stroke={nodeStroke("stall-d")}
          strokeWidth={nodeStrokeWidth("stall-d")}
          opacity={activeId === "stall-d" ? 1 : 0.85}
        />
        <text
          x="408"
          y="56"
          fill={activeId === "stall-d" ? "#0F172A" : "#F97316"}
          fontSize="9"
          fontWeight="700"
          fontFamily="DM Sans, sans-serif"
        >
          STL-D
        </text>

        {/* Washrooms */}
        <rect
          x="85"
          y="200"
          width="36"
          height="28"
          rx="6"
          fill={nodeColor("washroom-east", "#1E293B")}
          stroke={nodeStroke("washroom-east")}
          strokeWidth={nodeStrokeWidth("washroom-east")}
        />
        <text
          x="89"
          y="218"
          fill={activeId === "washroom-east" ? "#0F172A" : "#38BDF8"}
          fontSize="8"
          fontWeight="700"
          fontFamily="DM Sans, sans-serif"
        >
          WC-E
        </text>

        <rect
          x="479"
          y="200"
          width="36"
          height="28"
          rx="6"
          fill={nodeColor("washroom-west", "#1E293B")}
          stroke={nodeStroke("washroom-west")}
          strokeWidth={nodeStrokeWidth("washroom-west")}
        />
        <text
          x="483"
          y="218"
          fill={activeId === "washroom-west" ? "#0F172A" : "#38BDF8"}
          fontSize="8"
          fontWeight="700"
          fontFamily="DM Sans, sans-serif"
        >
          WC-W
        </text>

        {/* Gates */}
        <polygon
          points="300,8 314,28 286,28"
          fill={nodeColor("gate-north", "#1E293B")}
          stroke={nodeStroke("gate-north")}
          strokeWidth={nodeStrokeWidth("gate-north")}
        />
        <text
          x="280"
          y="44"
          fill={activeId === "gate-north" ? "#0F172A" : "#34D399"}
          fontSize="9"
          fontWeight="700"
          fontFamily="DM Sans, sans-serif"
        >
          GATE-N
        </text>

        {/* Exits */}
        <polygon
          points="300,352 314,332 286,332"
          fill={nodeColor("exit-south", "#1E293B")}
          stroke={nodeStroke("exit-south")}
          strokeWidth={nodeStrokeWidth("exit-south")}
        />
        <text
          x="278"
          y="328"
          fill={activeId === "exit-south" ? "#0F172A" : "#34D399"}
          fontSize="9"
          fontWeight="700"
          fontFamily="DM Sans, sans-serif"
        >
          EXIT-S
        </text>

        <polygon
          points="560,180 540,194 540,166"
          fill={nodeColor("exit-east", "#1E293B")}
          stroke={nodeStroke("exit-east")}
          strokeWidth={nodeStrokeWidth("exit-east")}
        />
        <text
          x="519"
          y="158"
          fill={activeId === "exit-east" ? "#0F172A" : "#34D399"}
          fontSize="9"
          fontWeight="700"
          fontFamily="DM Sans, sans-serif"
        >
          EXIT-E
        </text>

        {/* Concourse ring path */}
        <ellipse
          cx="300"
          cy="180"
          rx="220"
          ry="125"
          fill="none"
          stroke="rgba(34,211,238,0.12)"
          strokeWidth="1"
          strokeDasharray="4 6"
        />

        {/* Legend */}
        <rect x="16" y="310" width="10" height="10" rx="2" fill="#F97316" />
        <text
          x="30"
          y="319"
          fill="#64748B"
          fontSize="9"
          fontFamily="DM Sans, sans-serif"
        >
          Food
        </text>
        <rect x="66" y="310" width="10" height="10" rx="2" fill="#38BDF8" />
        <text
          x="80"
          y="319"
          fill="#64748B"
          fontSize="9"
          fontFamily="DM Sans, sans-serif"
        >
          WC
        </text>
        <rect x="104" y="310" width="10" height="10" rx="2" fill="#34D399" />
        <text
          x="118"
          y="319"
          fill="#64748B"
          fontSize="9"
          fontFamily="DM Sans, sans-serif"
        >
          Gate/Exit
        </text>
        <rect x="184" y="310" width="10" height="10" rx="2" fill="#22D3EE" />
        <text
          x="198"
          y="319"
          fill="#64748B"
          fontSize="9"
          fontFamily="DM Sans, sans-serif"
        >
          Recommended
        </text>
      </svg>

      {response?.recommendation?.routeSummary ? (
        <p className="venue-map-route-label">
          <strong>Route:</strong> {response.recommendation.routeSummary}
        </p>
      ) : null}
    </section>
  );
}
