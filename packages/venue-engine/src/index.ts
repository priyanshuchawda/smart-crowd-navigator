import { demoVenueFixture } from "./fixture.js";
import {
  getFallbackDestination,
  getTimingAdvice,
  rankDestinations,
} from "./ranking.js";
import {
  SUPPORTED_EVENT_PHASES,
  SUPPORTED_INTENTS,
  SUPPORTED_MOBILITY_MODES,
} from "./types.js";

export function createVenueEngine() {
  return {
    version: "0.2.0",
    supportedIntents: SUPPORTED_INTENTS,
    supportedEventPhases: SUPPORTED_EVENT_PHASES,
    supportedMobilityModes: SUPPORTED_MOBILITY_MODES,
    fixture: demoVenueFixture,
    rankDestinations,
    getFallbackDestination,
    getTimingAdvice,
  };
}

export {
  demoVenueFixture,
  getFallbackDestination,
  getTimingAdvice,
  rankDestinations,
};
export * from "./types.js";
