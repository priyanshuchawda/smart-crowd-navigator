import { spawnSync } from "node:child_process";

const env = {
  ...process.env,
  OPERATOR_AUTH_REQUIRED: "false",
  FIREBASE_PROJECT_ID: "",
  FIREBASE_PROJECT_NUMBER: "",
  APP_CHECK_REQUIRED: "false",
  VITE_FIREBASE_API_KEY: "",
  VITE_FIREBASE_AUTH_DOMAIN: "",
  VITE_FIREBASE_PROJECT_ID: "",
  VITE_FIREBASE_STORAGE_BUCKET: "",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "",
  VITE_FIREBASE_APP_ID: "",
  VITE_FIREBASE_MEASUREMENT_ID: "",
  VITE_FIREBASE_APPCHECK_SITE_KEY: "",
  VITE_FIREBASE_APPCHECK_DEBUG_TOKEN: "",
};

const commands = ["pnpm build", "pnpm exec playwright test"];

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
