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
    <section className="recommendation-card" aria-label="Operator access">
      <div className="status-row">
        <span className="section-title">Operator access</span>
        <span className="status-pill">
          {isSubmitting ? "Signing in…" : "Restricted"}
        </span>
      </div>

      <p className="empty-state">
        Sign in with an approved operator account to change live venue state.
      </p>

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

      <div className="control-stack">
        <label className="field">
          <span>Email</span>
          <input
            autoComplete="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
          />
        </label>
      </div>

      <button
        className="chip"
        disabled={isSubmitting}
        type="button"
        onClick={onSubmit}
      >
        Sign in as operator
      </button>
    </section>
  );
}
