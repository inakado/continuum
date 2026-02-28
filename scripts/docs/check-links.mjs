import {
  collectHeadingAnchors,
  collectMarkdownTargets,
  failWithErrors,
  fileExists,
  listDocMarkdownFiles,
  parseMarkdownTarget,
  readFile,
  repoRoot,
  resolveFromFile,
  statPath,
  toPosixPath,
} from "./_shared.mjs";
import path from "node:path";

const sourceFiles = [
  "AGENTS.md",
  "deploy/README.md",
  ...listDocMarkdownFiles(),
];

const anchorCache = new Map();
const errors = [];

function getAnchors(relativePath) {
  if (!anchorCache.has(relativePath)) {
    anchorCache.set(relativePath, collectHeadingAnchors(readFile(relativePath)));
  }

  return anchorCache.get(relativePath);
}

for (const sourceFile of sourceFiles) {
  const fileContent = readFile(sourceFile);
  const rawTargets = collectMarkdownTargets(fileContent);

  for (const rawTarget of rawTargets) {
    const { target, pathPart, fragment } = parseMarkdownTarget(rawTarget);

    if (!target || /^(mailto:|https?:)/i.test(target)) {
      continue;
    }

    const resolvedPath = pathPart
      ? resolveFromFile(sourceFile, pathPart)
      : sourceFile;

    if (!fileExists(resolvedPath)) {
      errors.push(
        `[docs:check:links] broken path in ${sourceFile}: ${rawTarget} -> ${resolvedPath}`,
      );
      continue;
    }

    const targetStats = statPath(resolvedPath);
    if (targetStats.isDirectory()) {
      if (fragment) {
        errors.push(
          `[docs:check:links] anchor target is a directory in ${sourceFile}: ${rawTarget}`,
        );
      }
      continue;
    }

    if (!fragment) {
      continue;
    }

    if (!resolvedPath.endsWith(".md")) {
      errors.push(
        `[docs:check:links] anchor used for non-markdown target in ${sourceFile}: ${rawTarget}`,
      );
      continue;
    }

    const anchors = getAnchors(resolvedPath);
    if (!anchors.has(fragment)) {
      const absoluteTarget = toPosixPath(path.join(repoRoot, resolvedPath));
      errors.push(
        `[docs:check:links] missing anchor in ${sourceFile}: ${rawTarget} -> ${absoluteTarget}#${fragment}`,
      );
    }
  }
}

if (errors.length === 0) {
  console.log("docs:check:links ok");
}

failWithErrors(errors);
