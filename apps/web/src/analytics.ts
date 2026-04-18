import { getAnalytics, isSupported, logEvent } from "firebase/analytics";
import { getApps } from "firebase/app";

import type { CoreIntent } from "@smart-crowd-navigator/shared";

type AnalyticsEventName =
  | "intent_selected"
  | "recommendation_received"
  | "recommendation_error"
  | "follow_up_submitted"
  | "operator_state_updated"
  | "install_prompt_shown"
  | "install_accepted"
  | "offline_mode_entered";

type AnalyticsEventParams = {
  intent_selected: { intent: CoreIntent };
  recommendation_received: {
    intent: CoreIntent;
    source: string;
    timing_decision: string;
    confidence: string;
  };
  recommendation_error: { intent: CoreIntent; error_message: string };
  follow_up_submitted: { intent: CoreIntent; question_length: number };
  operator_state_updated: { node_id: string };
  install_prompt_shown: Record<string, never>;
  install_accepted: Record<string, never>;
  offline_mode_entered: Record<string, never>;
};

let analyticsReady = false;

async function ensureAnalytics() {
  if (analyticsReady) {
    return true;
  }

  if (typeof window === "undefined" || getApps().length === 0) {
    return false;
  }

  try {
    if (await isSupported()) {
      analyticsReady = true;
      return true;
    }
  } catch {
    // Analytics not available in this environment
  }

  return false;
}

/**
 * Logs a custom Firebase Analytics event.
 * Events are silently dropped when Analytics is unavailable
 * (local dev without Firebase config, test environment, etc.).
 */
async function trackEvent<T extends AnalyticsEventName>(
  eventName: T,
  params: AnalyticsEventParams[T],
) {
  if (!(await ensureAnalytics())) {
    return;
  }

  try {
    const analytics = getAnalytics();
    logEvent(analytics, eventName, params);
  } catch {
    // Silently ignore — analytics should never break user flow
  }
}

export { trackEvent };
export type { AnalyticsEventName, AnalyticsEventParams };
