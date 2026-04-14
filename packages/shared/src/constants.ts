export const APP_NAME = "Smart Crowd Navigator";

export const APP_TAGLINE =
  "A Gemini-powered assistant for real-time movement decisions inside sporting venues.";

export const CORE_INTENTS = ["food", "washroom", "entry-gate", "exit"] as const;

export const EVENT_PHASES = [
  "pre-event",
  "in-play",
  "break",
  "post-event",
] as const;

export const MOBILITY_MODES = ["standard", "accessible"] as const;
export const GROUP_WORKFLOWS = [
  "auto",
  "runner-pickup",
  "meet-up",
  "return-before-play",
] as const;

export const TIMING_DECISIONS = ["go_now", "wait"] as const;

export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
