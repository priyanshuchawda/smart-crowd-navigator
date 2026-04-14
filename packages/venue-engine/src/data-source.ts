import {
  DESTINATION_STATUS,
  SUPPORTED_EVENT_PHASES,
  TELEMETRY_CONFIDENCE,
  VENUE_NODE_KINDS,
  VENUE_PATH_TYPES,
  VENUE_SOURCE_KINDS,
} from "./types.js";
import type {
  DestinationState,
  DestinationStatus,
  EventPhase,
  TelemetryConfidence,
  VenueDataSource,
  VenueEdge,
  VenueFixture,
  VenueNode,
  VenueNodeKind,
  VenueOperationalState,
  VenuePathType,
  VenueSourceKind,
  VenueTopology,
} from "./types.js";

const destinationStatuses = new Set<string>(DESTINATION_STATUS);
const telemetryConfidenceLevels = new Set<string>(TELEMETRY_CONFIDENCE);
const venueSourceKinds = new Set<string>(VENUE_SOURCE_KINDS);
const venueNodeKinds = new Set<string>(VENUE_NODE_KINDS);
const venuePathTypes = new Set<string>(VENUE_PATH_TYPES);
const supportedEventPhases = new Set<string>(SUPPORTED_EVENT_PHASES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStringField(
  value: unknown,
  fieldName: string,
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
) {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }

  if (!allowEmpty && value.trim().length === 0) {
    throw new Error(`${fieldName} must not be empty`);
  }

  return value;
}

function parseNumberField(value: unknown, fieldName: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number`);
  }

  return value;
}

function parseBooleanField(value: unknown, fieldName: string) {
  if (typeof value !== "boolean") {
    throw new Error(`${fieldName} must be a boolean`);
  }

  return value;
}

function parseArrayField<T>(
  value: unknown,
  fieldName: string,
  parser: (entry: unknown, index: number) => T,
) {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }

  return value.map((entry, index) => parser(entry, index));
}

function parseVenueNodeKind(value: unknown, fieldName: string): VenueNodeKind {
  const kind = parseStringField(value, fieldName);

  if (!venueNodeKinds.has(kind)) {
    throw new Error(`${fieldName} must be a supported venue node kind`);
  }

  return kind as VenueNodeKind;
}

function parseVenuePathType(value: unknown, fieldName: string): VenuePathType {
  const pathType = parseStringField(value, fieldName);

  if (!venuePathTypes.has(pathType)) {
    throw new Error(`${fieldName} must be a supported venue path type`);
  }

  return pathType as VenuePathType;
}

function parseDestinationStatus(
  value: unknown,
  fieldName: string,
): DestinationStatus {
  const status = parseStringField(value, fieldName);

  if (!destinationStatuses.has(status)) {
    throw new Error(`${fieldName} must be a supported destination status`);
  }

  return status as DestinationStatus;
}

function parseTelemetryConfidence(
  value: unknown,
  fieldName: string,
): TelemetryConfidence {
  const confidence = parseStringField(value, fieldName);

  if (!telemetryConfidenceLevels.has(confidence)) {
    throw new Error(`${fieldName} must be a supported telemetry confidence`);
  }

  return confidence as TelemetryConfidence;
}

function parseEventPhase(value: unknown, fieldName: string): EventPhase {
  const phase = parseStringField(value, fieldName);

  if (!supportedEventPhases.has(phase)) {
    throw new Error(`${fieldName} must be a supported event phase`);
  }

  return phase as EventPhase;
}

function parseVenueNode(value: unknown, index: number): VenueNode {
  if (!isRecord(value)) {
    throw new Error(`topology.nodes[${index}] must be an object`);
  }

  return {
    id: parseStringField(value.id, `topology.nodes[${index}].id`),
    label: parseStringField(value.label, `topology.nodes[${index}].label`),
    kind: parseVenueNodeKind(value.kind, `topology.nodes[${index}].kind`),
    zone:
      typeof value.zone === "string"
        ? parseStringField(value.zone, `topology.nodes[${index}].zone`)
        : undefined,
  };
}

function parseVenueEdge(value: unknown, index: number): VenueEdge {
  if (!isRecord(value)) {
    throw new Error(`topology.edges[${index}] must be an object`);
  }

  const minutes = parseNumberField(
    value.minutes,
    `topology.edges[${index}].minutes`,
  );
  const congestionPenalty = parseNumberField(
    value.congestionPenalty,
    `topology.edges[${index}].congestionPenalty`,
  );

  if (minutes < 0) {
    throw new Error(`topology.edges[${index}].minutes must be non-negative`);
  }

  if (congestionPenalty < 0) {
    throw new Error(
      `topology.edges[${index}].congestionPenalty must be non-negative`,
    );
  }

  return {
    from: parseStringField(value.from, `topology.edges[${index}].from`),
    to: parseStringField(value.to, `topology.edges[${index}].to`),
    minutes,
    accessible: parseBooleanField(
      value.accessible,
      `topology.edges[${index}].accessible`,
    ),
    congestionPenalty,
    pathType: parseVenuePathType(
      value.pathType,
      `topology.edges[${index}].pathType`,
    ),
  };
}

function parseDestinationState(
  value: unknown,
  index: number,
): DestinationState {
  if (!isRecord(value)) {
    throw new Error(`state.destinationStates[${index}] must be an object`);
  }

  const queueMinutes = parseNumberField(
    value.queueMinutes,
    `state.destinationStates[${index}].queueMinutes`,
  );
  const crowdPenalty = parseNumberField(
    value.crowdPenalty,
    `state.destinationStates[${index}].crowdPenalty`,
  );
  const queueTrendAfterFiveMinutes = parseNumberField(
    value.queueTrendAfterFiveMinutes,
    `state.destinationStates[${index}].queueTrendAfterFiveMinutes`,
  );
  const serviceMinutesPerAdditionalPerson = parseNumberField(
    value.serviceMinutesPerAdditionalPerson,
    `state.destinationStates[${index}].serviceMinutesPerAdditionalPerson`,
  );
  const waitTimeVariability =
    value.waitTimeVariability === undefined
      ? 0
      : parseNumberField(
          value.waitTimeVariability,
          `state.destinationStates[${index}].waitTimeVariability`,
        );

  if (queueMinutes < 0) {
    throw new Error(
      `state.destinationStates[${index}].queueMinutes must be non-negative`,
    );
  }

  if (crowdPenalty < 0) {
    throw new Error(
      `state.destinationStates[${index}].crowdPenalty must be non-negative`,
    );
  }

  if (serviceMinutesPerAdditionalPerson < 0) {
    throw new Error(
      `state.destinationStates[${index}].serviceMinutesPerAdditionalPerson must be non-negative`,
    );
  }

  if (waitTimeVariability < 0) {
    throw new Error(
      `state.destinationStates[${index}].waitTimeVariability must be non-negative`,
    );
  }

  return {
    nodeId: parseStringField(
      value.nodeId,
      `state.destinationStates[${index}].nodeId`,
    ),
    status:
      value.status === undefined
        ? "open"
        : parseDestinationStatus(
            value.status,
            `state.destinationStates[${index}].status`,
          ),
    queueMinutes,
    crowdPenalty,
    queueTrendAfterFiveMinutes,
    serviceMinutesPerAdditionalPerson,
    telemetryConfidence:
      value.telemetryConfidence === undefined
        ? "observed"
        : parseTelemetryConfidence(
            value.telemetryConfidence,
            `state.destinationStates[${index}].telemetryConfidence`,
          ),
    waitTimeVariability,
  };
}

function parseVenueTopology(value: unknown): VenueTopology {
  if (!isRecord(value)) {
    throw new Error("topology must be an object");
  }

  return {
    version: parseStringField(value.version, "topology.version"),
    venueId: parseStringField(value.venueId, "topology.venueId"),
    venueName: parseStringField(value.venueName, "topology.venueName"),
    eventPhases: parseArrayField(
      value.eventPhases,
      "topology.eventPhases",
      (entry, index) =>
        parseEventPhase(entry, `topology.eventPhases[${index}]`),
    ),
    nodes: parseArrayField(value.nodes, "topology.nodes", (entry, index) =>
      parseVenueNode(entry, index),
    ),
    edges: parseArrayField(value.edges, "topology.edges", (entry, index) =>
      parseVenueEdge(entry, index),
    ),
  };
}

function parseVenueOperationalState(value: unknown): VenueOperationalState {
  if (!isRecord(value)) {
    throw new Error("state must be an object");
  }

  return {
    version: parseStringField(value.version, "state.version"),
    destinationStates: parseArrayField(
      value.destinationStates,
      "state.destinationStates",
      (entry, index) => parseDestinationState(entry, index),
    ),
  };
}

function cloneVenueDataSource(
  venueDataSource: VenueDataSource,
): VenueDataSource {
  return {
    source: venueDataSource.source,
    topology: {
      ...venueDataSource.topology,
      eventPhases: [...venueDataSource.topology.eventPhases],
      nodes: venueDataSource.topology.nodes.map((node) => ({ ...node })),
      edges: venueDataSource.topology.edges.map((edge) => ({ ...edge })),
    },
    state: {
      ...venueDataSource.state,
      destinationStates: venueDataSource.state.destinationStates.map(
        (state) => ({
          ...state,
        }),
      ),
    },
  };
}

export function parseVenueDataSource(value: unknown): VenueDataSource {
  if (!isRecord(value)) {
    throw new Error("venue data source must be an object");
  }

  const source = parseStringField(value.source, "source");

  if (!venueSourceKinds.has(source)) {
    throw new Error("source must be a supported venue data source kind");
  }

  const venueDataSource: VenueDataSource = {
    source: source as VenueSourceKind,
    topology: parseVenueTopology(value.topology),
    state: parseVenueOperationalState(value.state),
  };

  return cloneVenueDataSource(venueDataSource);
}

export function createVenueFixtureFromDataSource(
  venueDataSource: VenueDataSource,
): VenueFixture {
  const safeDataSource = cloneVenueDataSource(venueDataSource);

  return {
    version: safeDataSource.topology.version,
    venueId: safeDataSource.topology.venueId,
    venueName: safeDataSource.topology.venueName,
    nodes: safeDataSource.topology.nodes,
    edges: safeDataSource.topology.edges,
    destinationStates: safeDataSource.state.destinationStates,
  };
}

export function replaceDestinationStates(
  venueDataSource: VenueDataSource,
  destinationStates: DestinationState[],
): VenueDataSource {
  return {
    ...cloneVenueDataSource(venueDataSource),
    state: {
      ...venueDataSource.state,
      destinationStates: destinationStates.map((state) => ({ ...state })),
    },
  };
}

export { cloneVenueDataSource };
