import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
  },
  webServer: [
    {
      command: "node services/assistant-api/scripts/start-test-server.mjs",
      url: "http://127.0.0.1:8080/health",
      reuseExistingServer: true,
    },
    {
      command:
        "pnpm --filter @smart-crowd-navigator/web preview --host 127.0.0.1 --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: true,
    },
  ],
});
