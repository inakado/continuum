import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const webRoot = dirname(currentDir);
const sourceDir = join(webRoot, "node_modules", "@excalidraw", "excalidraw", "dist", "prod", "fonts");
const targetDir = join(webRoot, "public", "vendor", "excalidraw", "fonts");

if (!existsSync(sourceDir)) {
  throw new Error(`Excalidraw fonts are not installed at ${sourceDir}`);
}

mkdirSync(dirname(targetDir), { recursive: true });
rmSync(targetDir, { recursive: true, force: true });
cpSync(sourceDir, targetDir, { recursive: true });
