import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import {
  createVenueEngine,
  localDevelopmentVenueDataSource,
  parseVenueDataSource,
} from "./index";

type PerfBaselineEntry = {
  iterations: number;
  maxDurationMs: number;
};

type PerfBaselines = {
  parseVenueDataSource: PerfBaselineEntry;
  rankDestinations: PerfBaselineEntry;
  timingAdvice: PerfBaselineEntry;
};

const currentDir = dirname(fileURLToPath(import.meta.url));
const baselinePath = resolve(currentDir, "perf-baselines.json");
const shouldUpdateBaselines =
  process.env.UPDATE_VENUE_ENGINE_PERF_BASELINES === "true";

const DEFAULT_PERF_BASELINES: PerfBaselines = {
  rankDestinations: {
    iterations: 1200,
    maxDurationMs: 2000,
  },
  timingAdvice: {
    iterations: 800,
    maxDurationMs: 2300,
  },
  parseVenueDataSource: {
    iterations: 600,
    maxDurationMs: 2000,
  },
};

function cloneDefaults(): PerfBaselines {
  return JSON.parse(JSON.stringify(DEFAULT_PERF_BASELINES)) as PerfBaselines;
}

function loadPerfBaselines() {
  if (!existsSync(baselinePath)) {
    if (shouldUpdateBaselines) {
      return cloneDefaults();
    }

    throw new Error(
      `Missing perf baseline file at ${baselinePath}. Run test:perf:update-baselines to create it.`,
    );
  }

  return JSON.parse(readFileSync(baselinePath, "utf8")) as PerfBaselines;
}

function writePerfBaselines(baselines: PerfBaselines) {
  mkdirSync(dirname(baselinePath), { recursive: true });
  writeFileSync(
    baselinePath,
    `${JSON.stringify(baselines, null, 2)}\n`,
    "utf8",
  );
}

function measureDurationMs(iterations: number, execute: () => void) {
  const start = performance.now();

  for (let index = 0; index < iterations; index += 1) {
    execute();
  }

  return Number((performance.now() - start).toFixed(2));
}

function warmUp(execute: () => void) {
  for (let index = 0; index < 100; index += 1) {
    execute();
  }
}

const baselines = loadPerfBaselines();
const observedDurations: Partial<Record<keyof PerfBaselines, number>> = {};

describe("venue-engine performance baselines", () => {
  it("keeps rankDestinations within baseline threshold", () => {
    const engine = createVenueEngine();
    const scenario = baselines.rankDestinations;
    let checksum = 0;

    const run = () => {
      const rankings = engine.rankDestinations({
        sectionId: "section-a12",
        intent: "food",
        eventPhase: "break",
        partySize: 3,
        mobilityMode: "standard",
      });

      checksum += rankings[0]?.score.totalScore ?? 0;
    };

    warmUp(run);
    const durationMs = measureDurationMs(scenario.iterations, run);
    observedDurations.rankDestinations = durationMs;

    expect(checksum).toBeGreaterThan(0);
    expect(durationMs).toBeLessThanOrEqual(scenario.maxDurationMs);
  });

  it("keeps getTimingAdvice within baseline threshold", () => {
    const engine = createVenueEngine();
    const scenario = baselines.timingAdvice;
    let checksum = 0;

    const run = () => {
      const advice = engine.getTimingAdvice({
        sectionId: "section-a12",
        intent: "food",
        eventPhase: "break",
        partySize: 3,
        waitWindowMinutes: 5,
      });

      checksum += advice.currentBest.score.totalScore;
    };

    warmUp(run);
    const durationMs = measureDurationMs(scenario.iterations, run);
    observedDurations.timingAdvice = durationMs;

    expect(checksum).toBeGreaterThan(0);
    expect(durationMs).toBeLessThanOrEqual(scenario.maxDurationMs);
  });

  it("keeps parseVenueDataSource within baseline threshold", () => {
    const scenario = baselines.parseVenueDataSource;
    const serializedDataSource = JSON.stringify(
      localDevelopmentVenueDataSource,
    );
    let checksum = 0;

    const run = () => {
      const parsed = parseVenueDataSource(JSON.parse(serializedDataSource));

      checksum += parsed.state.destinationStates.length;
    };

    warmUp(run);
    const durationMs = measureDurationMs(scenario.iterations, run);
    observedDurations.parseVenueDataSource = durationMs;

    expect(checksum).toBeGreaterThan(0);
    expect(durationMs).toBeLessThanOrEqual(scenario.maxDurationMs);
  });

  afterAll(() => {
    if (!shouldUpdateBaselines) {
      return;
    }

    const nextBaselines = cloneDefaults();

    for (const [scenarioName, observedDuration] of Object.entries(
      observedDurations,
    ) as Array<[keyof PerfBaselines, number]>) {
      nextBaselines[scenarioName] = {
        iterations: baselines[scenarioName].iterations,
        maxDurationMs: Math.max(
          DEFAULT_PERF_BASELINES[scenarioName].maxDurationMs,
          Math.ceil(observedDuration * 1.5),
        ),
      };
    }

    writePerfBaselines(nextBaselines);
  });
});
