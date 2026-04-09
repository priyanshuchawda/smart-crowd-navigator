import { demoVenueFixture } from "./fixture.js";
import { rankDestinations } from "./ranking.js";
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
  };
}

export { demoVenueFixture, rankDestinations };
export * from "./types.js";
