interface OperatorAccessPanelProps {
  email: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  password: string;
}

export function OperatorAccessPanel({
  email,
  errorMessage,
  isSubmitting,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  password,
}: OperatorAccessPanelProps) {
  return (
    <section
      className="recommendation-card panel-card"
      aria-label="Operator access"
    >
      <div className="panel-heading-row">
        <div>
          <span className="section-title">Operator Access</span>
          <p className="section-supporting-text">
            Restricted controls for authenticated venue operators only.
          </p>
        </div>
        <span className="status-pill">
          {isSubmitting ? "Signing in…" : "Restricted"}
        </span>
      </div>

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

      <div className="control-stack compact-controls">
        <label className="field">
          <span>Email</span>
          <input
            autoComplete="email"
            name="operatorEmail"
            spellCheck={false}
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            autoComplete="current-password"
            name="operatorPassword"
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
          />
        </label>
      </div>

      <button
        className="chip primary-chip"
        disabled={isSubmitting}
        type="button"
        onClick={onSubmit}
      >
        Sign In as Operator
      </button>
    </section>
  );
}
