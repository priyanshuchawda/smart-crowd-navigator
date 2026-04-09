export const APP_NAME = "Smart Crowd Navigator";
export const APP_TAGLINE =
  "A Gemini-powered assistant for real-time movement decisions inside sporting venues.";

export const CORE_INTENTS = ["food", "washroom", "entry-gate", "exit"] as const;

export type CoreIntent = (typeof CORE_INTENTS)[number];
