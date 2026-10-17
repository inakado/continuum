import { cpSync, existsSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const currentDir = dirname(fileURLToPath(import.meta.url));
const webRoot = dirname(currentDir);
const sourceDir = join(webRoot, "node_modules", "mathjax");
const targetDir = join(webRoot, "public", "vendor", "mathjax");

if (!existsSync(sourceDir)) {
  throw new Error(`MathJax package is not installed at ${sourceDir}`);
}

mkdirSync(dirname(targetDir), { recursive: true });
rmSync(targetDir, { recursive: true, force: true });
cpSync(sourceDir, targetDir, {
  recursive: true,
  filter: (path) => !path.endsWith(".md"),
});

// MathJax 4 loads font data separately. Keep those requests local too.
const require = createRequire(join(realpathSync(sourceDir), "package.json"));
const fontRoot = dirname(require.resolve("@mathjax/mathjax-newcm-font/package.json"));
const fontTarget = join(targetDir, "fonts", "mathjax-newcm-font");
mkdirSync(fontTarget, { recursive: true });
for (const entry of ["chtml.js", "chtml", "svg.js", "svg"]) {
  cpSync(join(fontRoot, entry), join(fontTarget, entry), { recursive: true });
}
