import {
  failWithErrors,
  fileExists,
  listDocMarkdownFiles,
  readFile,
} from "./_shared.mjs";

const indexFile = "documents/DOCS-INDEX.md";
const indexText = readFile(indexFile);
const errors = [];

const referencedPaths = new Set(
  [
    ...indexText.matchAll(/\b(?:AGENTS\.md|deploy\/README\.md|documents\/[A-Za-z0-9._/-]+\.md)\b/g),
  ].map((match) => match[0]),
);

for (const referencedPath of referencedPaths) {
  if (!fileExists(referencedPath)) {
    errors.push(`[docs:check:index] missing on disk: ${referencedPath}`);
  }
}

function isAllowedOrphan(relativePath) {
  return (
    relativePath === "documents/DOCS-INDEX.md" ||
    relativePath.startsWith("documents/generated/") ||
    relativePath.startsWith("documents/references/") ||
    relativePath.startsWith("documents/exec-plans/completed/")
  );
}

for (const markdownFile of listDocMarkdownFiles()) {
  if (isAllowedOrphan(markdownFile)) {
    continue;
  }

  if (!referencedPaths.has(markdownFile)) {
    errors.push(`[docs:check:index] missing in DOCS-INDEX: ${markdownFile}`);
  }
}

if (errors.length === 0) {
  console.log("docs:check:index ok");
}

failWithErrors(errors);
