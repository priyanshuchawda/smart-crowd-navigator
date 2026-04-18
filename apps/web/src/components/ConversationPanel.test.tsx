import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChatMessage } from "../types";
import { ConversationPanel } from "./ConversationPanel";

afterEach(() => {
  cleanup();
});

function renderConversation(
  overrides: Partial<Parameters<typeof ConversationPanel>[0]> = {},
) {
  const defaults = {
    draftQuestion: "",
    errorMessage: null,
    isLoading: false,
    messages: [] as ChatMessage[],
    onDraftQuestionChange: vi.fn(),
    onSubmitQuestion: vi.fn(),
  };

  return render(<ConversationPanel {...defaults} {...overrides} />);
}

describe("ConversationPanel", () => {
  it("renders the empty state when no messages are present", () => {
    renderConversation();

    expect(screen.getByText("Ready for the next question")).toBeVisible();
    expect(
      screen.getByText(/Type a question or tap a quick action/),
    ).toBeVisible();
  });

  it("renders user and assistant messages", () => {
    const messages: ChatMessage[] = [
      { role: "user", text: "Where is the nearest food stall?" },
      { role: "assistant", text: "Head to Stall B on the East Concourse." },
    ];

    renderConversation({ messages });

    const transcript = screen.getByRole("log", {
      name: "Conversation transcript",
    });
    expect(
      within(transcript).getByText("Where is the nearest food stall?"),
    ).toBeVisible();
    expect(
      within(transcript).getByText(
        "Head to Stall B on the East Concourse.",
      ),
    ).toBeVisible();
    expect(within(transcript).getByText("You")).toBeVisible();
    expect(within(transcript).getByText("Assistant")).toBeVisible();
  });

  it("disables the textarea and shows Thinking state while loading", () => {
    renderConversation({ isLoading: true });

    expect(screen.getByLabelText("Ask the assistant")).toBeDisabled();
    expect(screen.getByText("Thinking…")).toBeVisible();
    expect(screen.getByText("Sending…")).toBeVisible();
  });

  it("disables submit when draft question is empty", () => {
    renderConversation({ draftQuestion: "" });

    expect(
      screen.getByRole("button", { name: "Send question" }),
    ).toBeDisabled();
  });

  it("enables submit when draft question has content", () => {
    renderConversation({ draftQuestion: "Why this route?" });

    expect(
      screen.getByRole("button", { name: "Send question" }),
    ).toBeEnabled();
  });

  it("calls onDraftQuestionChange when the user types", async () => {
    const onDraftQuestionChange = vi.fn();
    renderConversation({ onDraftQuestionChange });

    await userEvent.type(
      screen.getByLabelText("Ask the assistant"),
      "food",
    );

    expect(onDraftQuestionChange).toHaveBeenCalled();
  });

  it("calls onSubmitQuestion when the form is submitted", async () => {
    const onSubmitQuestion = vi.fn();
    renderConversation({
      draftQuestion: "Which exit is best?",
      onSubmitQuestion,
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Send question" }),
    );

    expect(onSubmitQuestion).toHaveBeenCalledTimes(1);
  });

  it("shows error banner when errorMessage is set", () => {
    renderConversation({ errorMessage: "Request failed with status 500" });

    expect(
      screen.getByText("Request failed with status 500"),
    ).toBeVisible();
  });

  it("uses polite aria-live on the conversation transcript", () => {
    renderConversation();

    const transcript = screen.getByRole("log", {
      name: "Conversation transcript",
    });
    expect(transcript).toHaveAttribute("aria-live", "polite");
    expect(transcript).toHaveAttribute("aria-relevant", "additions text");
  });
});
