import { spawnSync } from "node:child_process";

const shouldUpdateBaselines = process.argv.includes("--update-baselines");
const env = {
  ...process.env,
};

if (shouldUpdateBaselines) {
  env.UPDATE_VENUE_ENGINE_PERF_BASELINES = "true";
}

const result = spawnSync("pnpm exec vitest run src/performance.baseline.test.ts", {
  env,
  shell: true,
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
