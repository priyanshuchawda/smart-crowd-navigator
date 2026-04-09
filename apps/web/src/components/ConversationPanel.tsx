import type { ChatMessage } from "../types";

interface ConversationPanelProps {
  errorMessage: string | null;
  isLoading: boolean;
  messages: ChatMessage[];
}

export function ConversationPanel({
  errorMessage,
  isLoading,
  messages,
}: ConversationPanelProps) {
  return (
    <section className="conversation" aria-label="Assistant conversation">
      <div className="status-row">
        <span className="section-title">Live assistant</span>
        <span className="status-pill">{isLoading ? "Thinking…" : "Ready"}</span>
      </div>

      <div className="message-list" aria-live="polite">
        {messages.length === 0 ? (
          <p className="empty-state">
            Tap a quick action to get a live recommendation.
          </p>
        ) : (
          messages.map((message, index) => (
            <article
              key={`${message.role}-${index}`}
              className={`message-bubble ${message.role}`}
            >
              <p className="message-role">{message.role}</p>
              <p>{message.text}</p>
            </article>
          ))
        )}
      </div>

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
    </section>
  );
}
