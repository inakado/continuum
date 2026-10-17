// Local authoring utility for the bundled pilot, not a server importer or Markdown renderer.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(import.meta.url);
const { AssessmentPackageManifestSchema, AssessmentPackageTaskSchema } = require("../../packages/shared/dist/contracts/assessment-package.js");
const source = path.join(root, "examples/assessment-package/pilot-v1");
const manifest = AssessmentPackageManifestSchema.parse(JSON.parse(readFileSync(path.join(source, "manifest.json"), "utf8")));
const temp = mkdtempSync(path.join(tmpdir(), "continuum-assessment-pilot-"));
const keys = [];
const pages = manifest.tasks.map((id, index) => {
  const dir = path.join(source, "tasks", id);
  const task = AssessmentPackageTaskSchema.parse(JSON.parse(readFileSync(path.join(dir, "task.json"), "utf8")));
  if (task.id !== id) throw new Error(`Идентификатор папки не совпадает: ${id}`);
  const content = (md, small = false) => md.replace(/!\[([^\]]*)\]\((images\/[a-z0-9.-]+)\)/g,
    (_, alt, image) => `![${alt}](${path.join(dir, image)}){width=${small ? "5cm" : "12cm"}}`);
  let text = `# ${index + 1}. ${task.title}\n\n${content(readFileSync(path.join(dir, "statement.md"), "utf8"))}\n`;
  if ("rows" in task) text += `\n**Позиции соответствия**\n\n${task.rows.map((row) => content(row.content, true)).join("\n\n")}\n`;
  if ("options" in task) text += `\n${task.options.map((option) => `${option.id}) ${content(option.content)}`).join("\n\n")}\n`;
  if (task.type === "short_number") text += `\nОтвет: __________________ ${task.unit ?? ""}\n`;
  const answer = task.type === "short_number" ? task.grading.answer
    : task.type === "single_choice" ? task.grading.correctOptionId
    : task.type === "multiple_choice" ? task.grading.correctOptionIds.join(", ")
    : task.type === "matching" ? task.rows.map((row) => `${row.id}: ${task.grading.matches[row.id]}`).join("; ")
    : task.grading.acceptedAnswers.join(" / ");
  keys.push(`| ${index + 1} | ${id} | ${answer} | ${task.maxPoints} |`);
  return text;
});
pages.push(`# Ключи для преподавателя\n\nПредпросмотр содержит закрытые ответы. Это не ученический материал.\n\n| № | Идентификатор | Ключ из исходника | Баллы |\n| --- | --- | --- | --- |\n${keys.join("\n")}\n\nОценивание: полное совпадение даёт все баллы, иначе 0. Это правило продукта, не заявление об официальной шкале ЕГЭ.\n`);
const markdown = path.join(temp, "preview.md");
writeFileSync(markdown, pages.join("\n\\newpage\n\n"));
const pdf = path.join(root, "output/pdf/assessment-package-pilot-v1.pdf");
mkdirSync(path.dirname(pdf), { recursive: true });
execFileSync("pandoc", [markdown, "--from=markdown+tex_math_dollars+pipe_tables-implicit_figures", "--pdf-engine=xelatex", "-V", "papersize=a4", "-V", "mainfont=Arial", "-V", "fontsize=11pt", "-V", "geometry:margin=18mm", "-o", path.join(temp, "preview.pdf")], {
  stdio: "inherit", env: { ...process.env, TEXMFVAR: path.join(temp, "texmf-var"), TEXMFCONFIG: path.join(temp, "texmf-config") },
});
copyFileSync(path.join(temp, "preview.pdf"), pdf);
const zip = path.join(temp, "assessment-package-pilot-v1.zip");
execFileSync("zip", ["-X", "-q", "-r", zip, "manifest.json", "tasks"], { cwd: source });
copyFileSync(zip, path.join(root, "output/assessment-package-pilot-v1.zip"));
console.log(`PDF: ${pdf}\nZIP: ${path.join(root, "output/assessment-package-pilot-v1.zip")}`);
