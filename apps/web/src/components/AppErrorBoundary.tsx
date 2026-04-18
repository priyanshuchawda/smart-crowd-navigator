import { Component, type ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  override state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return {
      hasError: true,
    } satisfies AppErrorBoundaryState;
  }

  override componentDidCatch(error: unknown) {
    console.error("Unhandled web rendering error", error);
  }

  private handleTryAgain = () => {
    this.setState({
      hasError: false,
    });
  };

  private handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="app-shell" role="alert" aria-live="assertive">
        <section className="hero-card">
          <div className="panel-card recommendation-card">
            <div className="panel-heading-row">
              <div>
                <p className="section-title">Something went wrong</p>
                <p className="section-supporting-text">
                  The app hit an unexpected rendering error. You can retry the
                  current screen or reload the app.
                </p>
              </div>
              <span className="status-pill status-pill-warning">Recovered</span>
            </div>

            <div className="chat-composer-footer">
              <button
                className="hero-action-button"
                type="button"
                onClick={this.handleTryAgain}
              >
                Try again
              </button>
              <button
                className="hero-action-button hero-action-primary"
                type="button"
                onClick={this.handleReload}
              >
                Reload app
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }
}
