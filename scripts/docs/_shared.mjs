import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const repoRoot = path.resolve(__dirname, "..", "..");

export function readFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

export function walkFiles(rootRelativePath, predicate) {
  const rootAbsolutePath = path.join(repoRoot, rootRelativePath);
  const results = [];

  function visit(currentAbsolutePath) {
    const entries = fs.readdirSync(currentAbsolutePath, { withFileTypes: true });

    for (const entry of entries) {
      const nextAbsolutePath = path.join(currentAbsolutePath, entry.name);

      if (entry.isDirectory()) {
        visit(nextAbsolutePath);
        continue;
      }

      const nextRelativePath = toPosixPath(path.relative(repoRoot, nextAbsolutePath));
      if (!predicate || predicate(nextRelativePath)) {
        results.push(nextRelativePath);
      }
    }
  }

  visit(rootAbsolutePath);
  return results.sort();
}

export function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

export function fileExists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

export function statPath(relativePath) {
  return fs.statSync(path.join(repoRoot, relativePath));
}

export function resolveFromFile(sourceRelativePath, targetPath) {
  if (targetPath.startsWith("/")) {
    return toPosixPath(targetPath.slice(1));
  }

  const sourceDirectory = path.dirname(path.join(repoRoot, sourceRelativePath));
  return toPosixPath(path.relative(repoRoot, path.resolve(sourceDirectory, targetPath)));
}

export function listDocMarkdownFiles() {
  return walkFiles("documents", (relativePath) => relativePath.endsWith(".md"));
}

export function collectMarkdownTargets(text) {
  const regex = /!?\[[^\]]*]\(([^)]+)\)/g;
  const targets = [];

  for (const match of text.matchAll(regex)) {
    targets.push(match[1]);
  }

  return targets;
}

export function parseMarkdownTarget(rawTarget) {
  const trimmed = rawTarget.trim();
  const value = trimmed.startsWith("<") && trimmed.endsWith(">")
    ? trimmed.slice(1, -1)
    : trimmed.split(/\s+/)[0];

  const [pathPart, fragment = ""] = value.split("#");
  return {
    raw: rawTarget,
    target: value,
    pathPart,
    fragment,
  };
}

export function isExternalTarget(target) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target);
}

export function collectHeadingAnchors(markdownText) {
  const anchors = new Set();
  const seen = new Map();
  let inCodeBlock = false;

  for (const rawLine of markdownText.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!headingMatch) {
      continue;
    }

    const baseSlug = slugifyHeading(headingMatch[2]);
    if (!baseSlug) {
      continue;
    }

    const duplicateCount = seen.get(baseSlug) ?? 0;
    seen.set(baseSlug, duplicateCount + 1);
    anchors.add(duplicateCount === 0 ? baseSlug : `${baseSlug}-${duplicateCount}`);
  }

  return anchors;
}

export function slugifyHeading(value) {
  return value
    .toLowerCase()
    .replace(/[`*_~()[\]{}<>:;'",.!?]/g, "")
    .replace(/&amp;/g, "and")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function failWithErrors(errors) {
  if (errors.length === 0) {
    return;
  }

  for (const error of errors) {
    console.error(error);
  }

  process.exitCode = 1;
}
