import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const srcRoot = path.join(packageRoot, "src");

const componentsDir = path.join(srcRoot, "components");
const hooksDir = path.join(srcRoot, "hooks");
const appEntrypoint = path.join(srcRoot, "App.tsx");
const domEntrypoint = path.join(srcRoot, "main.tsx");

const rules = [
  {
    id: "component-no-entrypoint-import",
    summary:
      "Files in src/components cannot import src/App.tsx or src/main.tsx.",
  },
  {
    id: "hook-no-entrypoint-import",
    summary: "Files in src/hooks cannot import src/App.tsx or src/main.tsx.",
  },
  {
    id: "hook-no-component-import",
    summary: "Files in src/hooks cannot import files from src/components.",
  },
  {
    id: "react-dom-client-only-main",
    summary: 'Only src/main.tsx may import the module "react-dom/client".',
  },
];

const importRegexes = [
  /import\s+[\s\S]*?\sfrom\s*["']([^"']+)["']/g,
  /import\s*["']([^"']+)["']/g,
  /import\s*\(\s*["']([^"']+)["']\s*\)/g,
  /export\s+[\s\S]*?\sfrom\s*["']([^"']+)["']/g,
];

function toComparablePath(filePath) {
  return path.normalize(filePath).toLowerCase();
}

function toRelativePath(filePath) {
  return path
    .relative(packageRoot, filePath)
    .split(path.sep)
    .join("/");
}

function isSameFile(a, b) {
  return toComparablePath(a) === toComparablePath(b);
}

function isInsideDirectory(targetPath, parentDir) {
  const normalizedTarget = toComparablePath(targetPath);
  const normalizedParent = toComparablePath(parentDir);
  return (
    normalizedTarget === normalizedParent ||
    normalizedTarget.startsWith(`${normalizedParent}${path.sep}`)
  );
}

function collectSourceFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function lineNumberFromIndex(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function collectImports(fileContent) {
  const imports = [];

  for (const regex of importRegexes) {
    regex.lastIndex = 0;
    let match = regex.exec(fileContent);
    while (match) {
      imports.push({
        specifier: match[1],
        index: match.index,
      });
      match = regex.exec(fileContent);
    }
  }

  return imports;
}

function resolveRelativeImport(fromFile, specifier) {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const baseCandidate = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    baseCandidate,
    `${baseCandidate}.ts`,
    `${baseCandidate}.tsx`,
    `${baseCandidate}.js`,
    `${baseCandidate}.jsx`,
    `${baseCandidate}.mjs`,
    `${baseCandidate}.cjs`,
    path.join(baseCandidate, "index.ts"),
    path.join(baseCandidate, "index.tsx"),
    path.join(baseCandidate, "index.js"),
    path.join(baseCandidate, "index.jsx"),
    path.join(baseCandidate, "index.mjs"),
    path.join(baseCandidate, "index.cjs"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return path.resolve(candidate);
    }
  }

  return null;
}

function buildViolation({ filePath, line, ruleId, detail }) {
  return {
    filePath,
    line,
    ruleId,
    detail,
  };
}

function checkBoundaries() {
  const sourceFiles = collectSourceFiles(srcRoot);
  const violations = [];

  for (const sourceFile of sourceFiles) {
    const content = fs.readFileSync(sourceFile, "utf8");
    const imports = collectImports(content);
    const inComponents = isInsideDirectory(sourceFile, componentsDir);
    const inHooks = isInsideDirectory(sourceFile, hooksDir);

    for (const imported of imports) {
      const line = lineNumberFromIndex(content, imported.index);
      const resolvedTarget = resolveRelativeImport(sourceFile, imported.specifier);

      if (inComponents && resolvedTarget) {
        if (isSameFile(resolvedTarget, appEntrypoint)) {
          violations.push(
            buildViolation({
              filePath: sourceFile,
              line,
              ruleId: "component-no-entrypoint-import",
              detail: `imports ${imported.specifier} -> src/App.tsx`,
            }),
          );
        }

        if (isSameFile(resolvedTarget, domEntrypoint)) {
          violations.push(
            buildViolation({
              filePath: sourceFile,
              line,
              ruleId: "component-no-entrypoint-import",
              detail: `imports ${imported.specifier} -> src/main.tsx`,
            }),
          );
        }
      }

      if (inHooks && resolvedTarget) {
        if (isSameFile(resolvedTarget, appEntrypoint)) {
          violations.push(
            buildViolation({
              filePath: sourceFile,
              line,
              ruleId: "hook-no-entrypoint-import",
              detail: `imports ${imported.specifier} -> src/App.tsx`,
            }),
          );
        }

        if (isSameFile(resolvedTarget, domEntrypoint)) {
          violations.push(
            buildViolation({
              filePath: sourceFile,
              line,
              ruleId: "hook-no-entrypoint-import",
              detail: `imports ${imported.specifier} -> src/main.tsx`,
            }),
          );
        }

        if (isInsideDirectory(resolvedTarget, componentsDir)) {
          violations.push(
            buildViolation({
              filePath: sourceFile,
              line,
              ruleId: "hook-no-component-import",
              detail: `imports ${imported.specifier} -> src/components/**`,
            }),
          );
        }
      }

      if (
        imported.specifier === "react-dom/client" &&
        !isSameFile(sourceFile, domEntrypoint)
      ) {
        violations.push(
          buildViolation({
            filePath: sourceFile,
            line,
            ruleId: "react-dom-client-only-main",
            detail: `imports module ${imported.specifier}`,
          }),
        );
      }
    }
  }

  console.log("Web import boundary check");
  console.log("Expected boundaries:");
  for (const rule of rules) {
    console.log(`- ${rule.id}: ${rule.summary}`);
  }

  if (violations.length === 0) {
    console.log(`\nPASS: ${sourceFiles.length} source files satisfy boundary rules.`);
    process.exit(0);
  }

  console.error(`\nFAIL: Found ${violations.length} boundary violation(s).`);
  for (const violation of violations) {
    const relativePath = toRelativePath(violation.filePath);
    console.error(
      `- ${relativePath}:${violation.line} [${violation.ruleId}] ${violation.detail}`,
    );
  }

  process.exit(1);
}

checkBoundaries();
