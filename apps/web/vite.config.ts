import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  envDir: "../..",
  plugins: [react()],
  resolve: {
    alias: {
      "@smart-crowd-navigator/shared": path.resolve(
        __dirname,
        "../../packages/shared/src/index.ts",
      ),
    },
  },
  server: {
    port: 5173,
  },
  test: {
    clearMocks: true,
    coverage: {
      include: ["src/**/*.{ts,tsx}"],
      reporter: ["text", "json-summary", "html", "lcov"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    environment: "jsdom",
    restoreMocks: true,
    setupFiles: "./src/test/setup.ts",
    testTimeout: 15_000,
  },
});
