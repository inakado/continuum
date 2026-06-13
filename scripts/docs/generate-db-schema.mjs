import fs from "node:fs";
import path from "node:path";
import { fileExists, readFile, repoRoot } from "./_shared.mjs";

const sourcePath = "apps/api/prisma/schema.prisma";
const outputPath = "documents/generated/db-schema.md";
const checkOnly = process.argv.includes("--check");

function parseBlocks(schemaText, kind) {
  const regex = new RegExp(`^${kind}\\s+(\\w+)\\s+\\{([\\s\\S]*?)^\\}`, "gm");
  return [...schemaText.matchAll(regex)].map((match) => ({
    name: match[1],
    body: match[2],
  }));
}

function parseEnums(schemaText) {
  return parseBlocks(schemaText, "enum").map((block) => ({
    name: block.name,
    values: block.body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("//"))
      .map((line) => line.split(/\s+/)[0]),
  }));
}

function parseModels(schemaText) {
  return parseBlocks(schemaText, "model").map((block) => {
    const fields = [];
    const modelAttributes = [];
    let tableName = block.name;

    for (const rawLine of block.body.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("//")) {
        continue;
      }

      if (line.startsWith("@@")) {
        modelAttributes.push(line);
        const mapMatch = /@@map\("([^"]+)"\)/.exec(line);
        if (mapMatch) {
          tableName = mapMatch[1];
        }
        continue;
      }

      const fieldMatch = /^(\w+)\s+([^\s]+)\s*(.*)$/.exec(line);
      if (!fieldMatch) {
        continue;
      }

      fields.push({
        name: fieldMatch[1],
        type: fieldMatch[2],
        attributes: fieldMatch[3].trim(),
      });
    }

    return {
      name: block.name,
      tableName,
      fields,
      modelAttributes,
    };
  });
}

function escapeTableCell(value) {
  return value.replace(/\|/g, "\\|");
}

function render(schemaText) {
  const enums = parseEnums(schemaText);
  const models = parseModels(schemaText);
  const lines = [
    "# generated/db-schema",
    "",
    "Статус: сгенерированный срез текущей Prisma schema. Не редактировать вручную.",
    "",
    "## Source of truth",
    "",
    `- \`${sourcePath}\``,
    "- Regenerate: `pnpm docs:generate`",
    "- Drift check: `pnpm docs:check:generated`",
    "",
    "## Enums",
    "",
  ];

  for (const item of enums) {
    lines.push(`- \`${item.name}\`: ${item.values.map((value) => `\`${value}\``).join(" | ")}`);
  }

  lines.push("", "## Models", "");

  for (const model of models) {
    lines.push(`### ${model.name}`, "");
    lines.push(`- Таблица: \`${model.tableName}\``);
    if (model.modelAttributes.length > 0) {
      lines.push(`- Model attributes: ${model.modelAttributes.map((value) => `\`${value}\``).join(", ")}`);
    }
    lines.push("", "| Field | Type | Attributes |", "| --- | --- | --- |");
    for (const field of model.fields) {
      const attributes = field.attributes ? `\`${escapeTableCell(field.attributes)}\`` : "";
      lines.push(`| \`${field.name}\` | \`${field.type}\` | ${attributes} |`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function writeOrCheck(content) {
  const outputAbsolutePath = path.join(repoRoot, outputPath);
  if (!checkOnly) {
    fs.writeFileSync(outputAbsolutePath, content);
    return;
  }

  const current = fileExists(outputPath) ? readFile(outputPath) : "";
  if (current === content) {
    return;
  }

  console.error(`${outputPath} не синхронизирован с ${sourcePath}. Запусти pnpm docs:generate.`);
  process.exitCode = 1;
}

writeOrCheck(render(readFile(sourcePath)));
