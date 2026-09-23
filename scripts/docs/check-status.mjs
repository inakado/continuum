import { failWithErrors, readFile } from "./_shared.mjs";

const DOCUMENT_RULES = {
  "README.md": {
    requiredPatterns: [
      /Континуум/,
      /documents\/DOCS-INDEX\.md/,
      /documents\/DEVELOPMENT\.md/,
      /pnpm dev:infra/,
      /pnpm dev:backend/,
      /pnpm dev:web/,
    ],
    forbiddenPatterns: [
      /bootstrap/i,
      /код будут добавляться/i,
      /Статус: draft/i,
    ],
  },
  "AGENTS.md": {
    requiredPatterns: [
      /documents\/DOCS-INDEX\.md/,
      /documents\/ARCHITECTURE-PRINCIPLES\.md/,
      /documents\/PLANS\.md/,
      /## 4\) Границы документов/,
      /## 5\) Обязательное соблюдение архитектурных принципов/,
    ],
    forbiddenPatterns: [
      /## 1\.1\) Workflow/,
      /## 6\) Структура execution plans/,
      /## 9\) Быстрый чеклист перед merge/,
      /\bImplemented\b/,
      /\bPlanned\b/,
    ],
  },
  "documents/DOCS-INDEX.md": {
    requiredPatterns: [
      /## Корневая карта/,
      /## System of Record \(SoR\)/,
      /## Каталоги/,
      /AGENTS\.md/,
      /documents\/PLANS\.md/,
      /documents\/DEVELOPMENT\.md/,
      /documents\/ops\/TROUBLESHOOTING\.md/,
      /documents\/ARCHITECTURE-PRINCIPLES\.md/,
      /documents\/exec-plans\/deferred-roadmap\.md/,
    ],
    forbiddenPatterns: [
      /\bImplemented\b/,
      /\bPlanned\b/,
      /## Границы документов/,
      /stable rule → SoR/i,
      /governance/i,
    ],
  },
  "documents/ARCHITECTURE.md": {
    requiredPatterns: [
      /## 1\. Архитектурная форма/,
      /## 2\. Модули/,
      /### Interactive Delivery/,
      /## 8\. Production после cutover/,
    ],
    forbiddenPatterns: [
      /\bPlanned\b/,
      /## Planned/i,
      /Search \(Concepts/i,
      /### BC8 — Analytics/i,
    ],
  },
  "documents/PLANS.md": {
    requiredPatterns: [
      /## Что считается execution plan/,
      /## Когда нужен active plan/,
      /## Lifecycle/,
      /documents\/exec-plans\/active\//,
      /documents\/exec-plans\/completed\//,
      /documents\/exec-plans\/deferred-roadmap\.md/,
      /documents\/exec-plans\/tech-debt-tracker\.md/,
    ],
    forbiddenPatterns: [
      /\bImplemented\b/,
      /\bPlanned\b/,
      /Scaffold/i,
    ],
  },
  "documents/ARCHITECTURE-PRINCIPLES.md": {
    requiredPatterns: [
      /## Архитектурные принципы/,
      /## Current Guardrails/,
      /## Approved Stack/,
      /## Anti-Gaming Rules/,
    ],
    forbiddenPatterns: [
      /\bPhase\b/i,
      /\bWave\b/i,
      /\bprogress\b/i,
      /\bNext:\b/i,
      /remaining-?screens/i,
      /coverage expansion/i,
      /migration backlog/i,
      /nestjs-zod/i,
      /dependency-cruiser/i,
      /\bImplemented\b/,
      /\bPlanned\b/,
      /## Границы документа/,
      /## Статус-модель/,
    ],
  },
  "documents/DEVELOPMENT.md": {
    requiredPatterns: [
      /## Prerequisites \/ Env/,
      /## Dev Runbook/,
      /## Verification Commands/,
      /## Troubleshooting/,
      /documents\/ops\/TROUBLESHOOTING\.md/,
    ],
    forbiddenPatterns: [
      /\bImplemented\b/,
      /\bPlanned\b/,
      /## Границы документа/,
      /## Статус-модель/,
      /\bPhase\b/i,
      /\bWave\b/i,
      /\bprogress\b/i,
    ],
  },
  "documents/ops/TROUBLESHOOTING.md": {
    requiredPatterns: [
      /## Troubleshooting/,
      /повторяемые dev\/run\/build\/test\/deploy сбои/,
      /deploy\/README\.md/,
    ],
    forbiddenPatterns: [
      /\bImplemented\b/,
      /\bPlanned\b/,
      /## Границы документа/,
      /## Статус-модель/,
    ],
  },
  "documents/FRONTEND.md": {
    requiredPatterns: [
      /## Structure/,
      /## Routes Map/,
      /## API Client Behavior/,
      /## Server-State Rules/,
      /## Related Source Links/,
    ],
    forbiddenPatterns: [
      /\bPhase\b/i,
      /\bWave\b/i,
      /migration/i,
      /remaining screens/i,
      /## Planned \/ TODO/,
      /\bImplemented\b/,
      /\bPlanned\b/,
    ],
  },
  "documents/CONTENT.md": {
    requiredPatterns: [/## Scope/, /## Source Links/],
    forbiddenPatterns: [/## Planned \/ TODO/, /\bTODO\b/],
  },
  "documents/SECURITY.md": {
    requiredPatterns: [/## Scope/, /## Source Links/],
    forbiddenPatterns: [/## Planned \/ TODO/, /\bTODO\b/],
  },
  "documents/DESIGN.md": {
    requiredPatterns: [/## Назначение/, /## Source Links/],
    forbiddenPatterns: [/## Planned \/ TODO/, /\bTODO\b/],
  },
  "documents/DECISIONS.md": {
    requiredPatterns: [/## DEC-01/, /## DEC-02/, /## DEC-06/],
    forbiddenPatterns: [/\bPlanned\b/, /\bTODO\b/, /Mini-gap-check/i, /пока не зафиксирован/i],
  },
};

const errors = [];

for (const [filePath, rules] of Object.entries(DOCUMENT_RULES)) {
  const fileContent = readFile(filePath);

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
