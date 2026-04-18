import { Component, type ReactNode } from "react";

interface PanelErrorBoundaryProps {
  children: ReactNode;
  /** Label displayed in the fallback card when the panel crashes. */
  panelName: string;
}

interface PanelErrorBoundaryState {
  hasError: boolean;
}

/**
 * A lightweight error boundary scoped to a single UI panel.
 * Prevents a crash in one panel (e.g. venue map, recommendation,
 * or conversation) from tearing down the entire application.
 */
export class PanelErrorBoundary extends Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  override state: PanelErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true } satisfies PanelErrorBoundaryState;
  }

  override componentDidCatch(error: unknown) {
    console.error(
      `[PanelErrorBoundary] ${this.props.panelName} crashed:`,
      error,
    );
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <section
        className="panel-card recommendation-card"
        aria-label={`${this.props.panelName} error`}
        role="alert"
      >
        <div className="panel-heading-row">
          <div>
            <span className="section-title">{this.props.panelName}</span>
            <p className="section-supporting-text">
              This panel encountered an unexpected error and was isolated to
              protect the rest of the page.
            </p>
          </div>
          <span className="status-pill status-pill-warning">Error</span>
        </div>
        <button
          className="hero-action-button"
          type="button"
          onClick={this.handleRetry}
        >
          Retry this panel
        </button>
      </section>
    );
  }
}
