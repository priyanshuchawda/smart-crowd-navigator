import type { ChatMessage } from "../types";

interface ConversationPanelProps {
  errorMessage: string | null;
  isLoading: boolean;
  messages: ChatMessage[];
}

const messageRoleLabels: Record<ChatMessage["role"], string> = {
  assistant: "Assistant",
  user: "You",
};

export function ConversationPanel({
  errorMessage,
  isLoading,
  messages,
}: ConversationPanelProps) {
  return (
    <section
      className="conversation panel-card"
      aria-label="Assistant conversation"
    >
      <div className="panel-heading-row">
        <div>
          <span className="section-title">Live Assistant</span>
          <p className="section-supporting-text">
            Your latest routing guidance appears here in plain language.
          </p>
        </div>
        <span className="status-pill">{isLoading ? "Thinking…" : "Live"}</span>
      </div>

      <div className="message-list" aria-live="polite">
        {messages.length === 0 ? (
          <div className="empty-state-card">
            <p className="empty-state-title">Ready for the next question</p>
            <p className="empty-state">
              Tap a quick action to get a live recommendation based on your
              section, party size, and venue conditions.
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <article
              key={`${message.role}-${index}`}
              className={`message-bubble ${message.role}`}
            >
              <p className="message-role">{messageRoleLabels[message.role]}</p>
              <p>{message.text}</p>
            </article>
          ))
        )}
      </div>

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
    </section>
  );
}
