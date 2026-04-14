# Gemini Conversation Architecture

## Decision

For the current backend iteration, Smart Crowd Navigator uses the Gemini JS
**chat** surface (`ai.chats.create(...)`) as the primary multi-turn conversation
entry point.

## Why chats instead of interactions right now

Official Gemini docs support both:
- `ai.chats.create(...)` for stateful multi-turn chat in JavaScript
- `client.interactions.create(...)` for interaction-centric flows, including
  `previous_interaction_id`

We chose **chats** for this step because:
1. the JavaScript chat examples are the clearest fit for the attendee
   question/follow-up flow we already ship
2. the current app already sends `conversationHistory` with each request, so we
   can reconstruct chat history cleanly without storing server-side interaction
   IDs yet
3. the Gemini function-calling docs explicitly show chat-based function calling,
   which matches the current recommendation-tool architecture

## Current architecture

1. The web app sends:
   - structured venue context
   - the latest attendee question
   - prior assistant/user conversation history

2. The backend:
   - converts prior conversation turns into Gemini chat history
   - creates a chat session with `systemInstruction` + tool declarations
   - sends only the latest attendee question as the next chat message

3. If Gemini requests a tool call:
   - the backend computes the deterministic recommendation payload locally
   - the tool result remains the source of truth
   - the backend sends the function response back in a final `generateContent`
     round to obtain the grounded assistant reply

## Why this is a hybrid flow

The current implementation uses:
- **chat** for stateful user/model conversation setup
- a final **manual function-response roundtrip** for tool-result grounding

This is intentional.

It gives us:
- cleaner multi-turn state handling than a purely prompt-concatenated
  `generateContent` flow
- deterministic tool-result control
- a good stepping stone for future work like Maps grounding and richer
  citations

## Source-of-truth rule

Gemini is never allowed to invent:
- routes
- queue times
- crowd levels
- timing decisions

Those values come from the deterministic recommendation layer.

## Follow-up direction

Later roadmap issues can build on this by:
- evaluating whether stored Gemini interaction IDs are worth the added server
  state
- adding Maps grounding / citations on top of the same conversation contract
- expanding tool handling without changing the frontend request shape again
