import { spawnSync } from "node:child_process";

const shouldUpdateBaselines = process.argv.includes("--update-baselines");

const env = {
  ...process.env,
};

if (shouldUpdateBaselines) {
  env.UPDATE_ASSISTANT_BEHAVIOR_BASELINES = "true";
}

const commands = [
  "pnpm --filter @smart-crowd-navigator/shared build",
  "pnpm --filter @smart-crowd-navigator/venue-engine build",
  "pnpm exec vitest run src/assistant-behavior.baseline.test.ts",
];

for (const command of commands) {
  const result = spawnSync(command, {
    env,
    shell: true,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
