import fs from "node:fs";
import path from "node:path";
import { fileExists, readFile, repoRoot, walkFiles } from "./_shared.mjs";

const sourceRoot = "apps/api/src";
const outputPath = "documents/generated/api-routes.md";
const checkOnly = process.argv.includes("--check");
const httpMethods = new Map([
  ["Get", "GET"],
  ["Post", "POST"],
  ["Put", "PUT"],
  ["Patch", "PATCH"],
  ["Delete", "DELETE"],
]);

function extractStringArgument(rawArguments) {
  const trimmed = rawArguments.trim();
  if (!trimmed) {
    return "";
  }

  const stringMatch = /^['"`]([^'"`]*)['"`]/.exec(trimmed);
  return stringMatch ? stringMatch[1] : trimmed;
}

function normalizeRoute(prefix, suffix) {
  const parts = [prefix, suffix]
    .map((part) => part.trim().replace(/^\/+|\/+$/g, ""))
    .filter(Boolean);
  return `/${parts.join("/")}`;
}

function parseController(filePath) {
  const text = readFile(filePath);
  const controllerMatch = /@Controller\s*\(([^)]*)\)/.exec(text);
  if (!controllerMatch) {
    return [];
  }

  const prefix = extractStringArgument(controllerMatch[1]);
  const routes = [];
  const lines = text.split(/\r?\n/);
  let pendingRoute = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const routeMatch = /^@(Get|Post|Put|Patch|Delete)\s*\(([^)]*)\)/.exec(line);
    if (routeMatch) {
      pendingRoute = {
        method: httpMethods.get(routeMatch[1]),
        path: normalizeRoute(prefix, extractStringArgument(routeMatch[2])),
        line: index + 1,
      };
      continue;
    }

    if (!pendingRoute) {
      continue;
    }

    if (line.startsWith("@")) {
      continue;
    }

    const methodMatch = /^(?:public\s+|private\s+|protected\s+)?(?:async\s+)?(\w+)\s*\(/.exec(line);
    if (!methodMatch) {
      continue;
    }

    routes.push({
      ...pendingRoute,
      handler: methodMatch[1],
      filePath,
    });
    pendingRoute = null;
  }

  return routes;
}

function escapeTableCell(value) {
  return value.replace(/\|/g, "\\|");
}

function render() {
  const controllerFiles = walkFiles(sourceRoot, (relativePath) => relativePath.endsWith("controller.ts"));
  const routes = controllerFiles.flatMap(parseController).sort((a, b) => {
    const pathCompare = a.path.localeCompare(b.path);
    if (pathCompare !== 0) {
      return pathCompare;
    }
    return a.method.localeCompare(b.method);
  });
  const routeGroups = new Map();

  const lines = [
    "# generated/api-routes",
    "",
    "Статус: сгенерированный каталог HTTP routes из Nest controllers. Не редактировать вручную.",
    "",
    "## Source of truth",
    "",
    `- \`${sourceRoot}/**/*controller.ts\``,
    "- Regenerate: `pnpm docs:generate`",
    "- Drift check: `pnpm docs:check:generated`",
    "",
    "## Routes",
    "",
    "| Method | Path | Handler | Source |",
    "| --- | --- | --- | --- |",
  ];

  for (const route of routes) {
    const routeKey = `${route.method} ${route.path}`;
    const routeGroup = routeGroups.get(routeKey) ?? [];
    routeGroup.push(route);
    routeGroups.set(routeKey, routeGroup);

    const source = `${route.filePath}:${route.line}`;
    lines.push(
      `| \`${route.method}\` | \`${escapeTableCell(route.path)}\` | \`${route.handler}\` | \`${source}\` |`,
    );
  }

  const collisions = [...routeGroups.entries()]
    .filter(([, group]) => group.length > 1)
    .sort(([left], [right]) => left.localeCompare(right));

  if (collisions.length > 0) {
    lines.push("", "## Route collisions", "");
    lines.push("Эти пары требуют ручной проверки: Nest обработает только один из конкурирующих handlers для одинакового HTTP method + path.", "");
    for (const [routeKey, group] of collisions) {
      const sources = group.map((route) => `\`${route.filePath}:${route.line}#${route.handler}\``).join(", ");
      lines.push(`- \`${routeKey}\`: ${sources}`);
    }
  }

  lines.push("");
  return lines.join("\n");
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

  console.error(`${outputPath} не синхронизирован с ${sourceRoot}. Запусти pnpm docs:generate.`);
  process.exitCode = 1;
}

writeOrCheck(render());
