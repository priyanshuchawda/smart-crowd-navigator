import { memo } from "react";

import type { ChatMessage } from "../types";

interface ConversationPanelProps {
  draftQuestion: string;
  errorMessage: string | null;
  isLoading: boolean;
  messages: ChatMessage[];
  onDraftQuestionChange: (value: string) => void;
  onSubmitQuestion: () => void;
}

const messageRoleLabels: Record<ChatMessage["role"], string> = {
  assistant: "Assistant",
  user: "You",
};

const ConversationPanel = memo(function ConversationPanel({
  draftQuestion,
  errorMessage,
  isLoading,
  messages,
  onDraftQuestionChange,
  onSubmitQuestion,
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

      <div
        className="message-list"
        aria-atomic="false"
        aria-busy={isLoading}
        aria-label="Conversation transcript"
        aria-live="polite"
        aria-relevant="additions text"
        role="log"
      >
        {messages.length === 0 ? (
          <div className="empty-state-card">
            <p className="empty-state-title">Ready for the next question</p>
            <p className="empty-state">
              Type a question or tap a quick action to get live guidance based
              on your section, party size, and venue conditions.
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <article
              key={`${message.role}-${index}`}
              aria-label={`${messageRoleLabels[message.role]} message`}
              className={`message-bubble ${message.role}`}
            >
              <p className="message-role">{messageRoleLabels[message.role]}</p>
              <p>{message.text}</p>
            </article>
          ))
        )}
      </div>

      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitQuestion();
        }}
      >
        <label className="field" htmlFor="assistant-question">
          <span>Ask the assistant</span>
          <textarea
            id="assistant-question"
            aria-describedby="assistant-question-help"
            disabled={isLoading}
            name="assistantQuestion"
            placeholder="Ask a follow-up like “Why is that better?” or mention food, washroom, entry, or exit."
            rows={3}
            value={draftQuestion}
            onChange={(event) => onDraftQuestionChange(event.target.value)}
          />
        </label>
        <div className="chat-composer-footer">
          <small id="assistant-question-help" className="field-help-text">
            Quick actions seed the same conversation. Typed follow-ups reuse the
            current venue context.
          </small>
          <button
            className="hero-action-button hero-action-primary chat-submit-button"
            disabled={isLoading || draftQuestion.trim().length === 0}
            type="submit"
          >
            {isLoading ? "Sending…" : "Send question"}
          </button>
        </div>
      </form>

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
    </section>
  );
});

export { ConversationPanel };
