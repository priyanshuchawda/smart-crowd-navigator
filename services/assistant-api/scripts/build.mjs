import { spawn } from "node:child_process";
import { copyFile, readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const compiledSourceRoot = resolve(projectRoot, "dist/services/assistant-api/src");
const outputRoot = resolve(projectRoot, "dist");
const tscCliPath = resolve(projectRoot, "../../node_modules/typescript/bin/tsc");

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
  const compiledEntries = await readdir(compiledSourceRoot, {
    withFileTypes: true,
  });

  for (const entry of compiledEntries) {
    if (!entry.isFile()) {
      continue;
    }

    if (!entry.name.endsWith(".js") && !entry.name.endsWith(".d.ts")) {
      continue;
    }

    const sourceFile = resolve(compiledSourceRoot, entry.name);
    const targetFile = resolve(outputRoot, entry.name);
    await copyFile(sourceFile, targetFile);
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
