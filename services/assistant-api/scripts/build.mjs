import { spawn } from "node:child_process";
import { copyFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const compiledSourceRoot = resolve(projectRoot, "dist/services/assistant-api/src");
const outputRoot = resolve(projectRoot, "dist");
const tscCliPath = resolve(projectRoot, "../../node_modules/typescript/bin/tsc");
const compiledModules = [
  "app-check",
  "env",
  "gemini",
  "index",
  "operator-auth",
  "recommendation",
  "request-utils",
];

function runTypeScriptBuild() {
  return new Promise((resolveBuild, rejectBuild) => {
    const child = spawn(process.execPath, [tscCliPath, "-p", "tsconfig.json"], {
      cwd: projectRoot,
      stdio: "inherit",
    });

    child.on("error", rejectBuild);
    child.on("exit", (code) => {
      if (code === 0) {
        resolveBuild();
        return;
      }

      rejectBuild(new Error(`TypeScript build failed with exit code ${code ?? "unknown"}.`));
    });
  });
}

async function flattenAssistantApiDist() {
  for (const moduleName of compiledModules) {
    for (const extension of ["js", "d.ts"]) {
      const sourceFile = resolve(compiledSourceRoot, `${moduleName}.${extension}`);
      const targetFile = resolve(outputRoot, `${moduleName}.${extension}`);
      await copyFile(sourceFile, targetFile);
    }
  }
}

async function main() {
  await rm(outputRoot, { recursive: true, force: true });
  await runTypeScriptBuild();
  await flattenAssistantApiDist();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
