const supportedIntents = ["food", "washroom", "entry-gate", "exit"] as const;

export function createVenueEngine() {
  return {
    version: "0.1.0",
    supportedIntents,
  };
}
