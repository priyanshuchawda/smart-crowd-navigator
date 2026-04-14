import { createVenueFixtureFromDataSource } from "./data-source.js";
import {
  demoVenueFixture,
  localDevelopmentVenueDataSource,
} from "./fixture.js";
import {
  getFallbackDestination,
  getTimingAdvice,
  rankDestinations,
} from "./ranking.js";
import {
  SUPPORTED_EVENT_PHASES,
  SUPPORTED_INTENTS,
  SUPPORTED_MOBILITY_MODES,
  type VenueDataSource,
} from "./types.js";

export function createVenueEngine({
  defaultDataSource = localDevelopmentVenueDataSource,
}: {
  defaultDataSource?: VenueDataSource;
} = {}) {
  const fixture = createVenueFixtureFromDataSource(defaultDataSource);

  return {
    version: "0.2.0",
    supportedIntents: SUPPORTED_INTENTS,
    supportedEventPhases: SUPPORTED_EVENT_PHASES,
    supportedMobilityModes: SUPPORTED_MOBILITY_MODES,
    defaultDataSource,
    fixture,
    rankDestinations,
    getFallbackDestination,
    getTimingAdvice,
  };
}

export { createVenueFixtureFromDataSource } from "./data-source.js";
export {
  cloneVenueDataSource,
  parseVenueDataSource,
  replaceDestinationStates,
} from "./data-source.js";
export {
  demoVenueFixture,
  localDevelopmentVenueDataSource,
  getFallbackDestination,
  getTimingAdvice,
  rankDestinations,
};
export * from "./types.js";
