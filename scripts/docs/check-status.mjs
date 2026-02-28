import { failWithErrors, readFile } from "./_shared.mjs";

const KEY_SOR_DOCS = [
  "documents/ARCHITECTURE.md",
  "documents/ARCHITECTURE-PRINCIPLES.md",
  "documents/FRONTEND.md",
  "documents/CONTENT.md",
  "documents/LEARNING.md",
  "documents/SECURITY.md",
  "documents/RELIABILITY.md",
  "documents/DEVELOPMENT.md",
  "documents/DOCS-INDEX.md",
];

const DOCUMENT_RULES = {
  "documents/ARCHITECTURE-PRINCIPLES.md": {
    requiredPatterns: [
      /## Границы документа/,
      /## Статус-модель/,
      /## Архитектурные принципы/,
      /## Current Guardrails/,
      /## Recommended Stack/,
    ],
    forbiddenPatterns: [
      /\bPhase\b/i,
      /\bWave\b/i,
      /\bprogress\b/i,
      /\bNext:\b/i,
      /remaining-?screens/i,
      /coverage expansion/i,
      /migration backlog/i,
    ],
  },
  "documents/DEVELOPMENT.md": {
    requiredPatterns: [
      /## Границы документа/,
      /## Prerequisites \/ Env/,
      /## Dev Runbook/,
      /## Verification Commands/,
      /## Troubleshooting/,
    ],
    forbiddenPatterns: [
      /^## Planned$/m,
      /\bPhase\b/i,
      /\bWave\b/i,
      /\bprogress\b/i,
      /migration-slice/i,
      /feature-level/i,
    ],
  },
  "documents/DOCS-INDEX.md": {
    requiredPatterns: [
      /## Границы документов/,
      /ARCHITECTURE-PRINCIPLES\.md/,
      /DEVELOPMENT\.md/,
      /stable rule → SoR/i,
    ],
    forbiddenPatterns: [],
  },
};

const errors = [];

for (const filePath of KEY_SOR_DOCS) {
  const fileContent = readFile(filePath);

  if (!/\bImplemented\b/.test(fileContent) && !/\bPlanned\b/.test(fileContent)) {
    errors.push(`[docs:check:status] missing status marker in ${filePath}`);
  }

  const rules = DOCUMENT_RULES[filePath];
  if (!rules) {
    continue;
  }

  for (const pattern of rules.requiredPatterns) {
    if (!pattern.test(fileContent)) {
      errors.push(
        `[docs:check:status] required pattern ${pattern} not found in ${filePath}`,
      );
    }
  }

  for (const pattern of rules.forbiddenPatterns) {
    if (pattern.test(fileContent)) {
      errors.push(
        `[docs:check:status] forbidden pattern ${pattern} found in ${filePath}`,
      );
    }
  }
}

if (errors.length === 0) {
  console.log("docs:check:status ok");
}

failWithErrors(errors);
