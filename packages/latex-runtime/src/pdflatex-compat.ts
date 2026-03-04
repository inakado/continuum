import { LatexRuntimeError } from "./errors";
import { latexRuntimePolicy } from "./policy";
import { ensurePdflatexDocumentEnvelope } from "./pdflatex-template";
import { type PdflatexIncompatibility } from "./types";

const DISALLOWED_PACKAGES = new Map<string, string>([
  ["fontspec", 'package "fontspec" is unsupported in pdflatex runtime'],
  ["unicode-math", 'package "unicode-math" is unsupported in pdflatex runtime'],
  ["polyglossia", 'package "polyglossia" is unsupported in pdflatex runtime'],
  ["minted", 'package "minted" requires shell-escape and is unsupported'],
  ["svg", 'package "svg" requires external conversion tooling and is unsupported'],
]);

const DISALLOWED_COMMANDS: Array<{ token: string; pattern: RegExp; message: string }> = [
  { token: "\\defaultfontfeatures", pattern: /\\defaultfontfeatures(?:\[[^\]]*])?\{/i, message: 'command "\\defaultfontfeatures" is unsupported in pdflatex runtime' },
  { token: "\\setmainfont", pattern: /\\setmainfont(?:\[[^\]]*])?\{/i, message: 'command "\\setmainfont" is unsupported in pdflatex runtime' },
  { token: "\\setsansfont", pattern: /\\setsansfont(?:\[[^\]]*])?\{/i, message: 'command "\\setsansfont" is unsupported in pdflatex runtime' },
  { token: "\\setmonofont", pattern: /\\setmonofont(?:\[[^\]]*])?\{/i, message: 'command "\\setmonofont" is unsupported in pdflatex runtime' },
  { token: "\\setmathfont", pattern: /\\setmathfont(?:\[[^\]]*])?\{/i, message: 'command "\\setmathfont" is unsupported in pdflatex runtime' },
  { token: "\\newfontfamily", pattern: /\\newfontfamily(?:\[[^\]]*])?\{/i, message: 'command "\\newfontfamily" is unsupported in pdflatex runtime' },
  { token: "\\directlua", pattern: /\\directlua\b/i, message: 'LuaTeX-only command "\\directlua" is unsupported' },
  { token: "\\write18", pattern: /\\write18\b/i, message: 'command "\\write18" is unsupported by no-shell-escape policy' },
  { token: "\\tikzexternalize", pattern: /\\tikzexternalize\b/i, message: 'command "\\tikzexternalize" requires externalization tooling and is unsupported' },
  { token: "\\includesvg", pattern: /\\includesvg(?:\[[^\]]*])?\{/i, message: 'command "\\includesvg" requires external conversion tooling and is unsupported' },
  { token: "\\bibliography", pattern: /\\bibliography(?:\[[^\]]*])?\{/i, message: 'command "\\bibliography" is out of scope for current pdflatex runtime policy' },
  { token: "\\addbibresource", pattern: /\\addbibresource(?:\[[^\]]*])?\{/i, message: 'command "\\addbibresource" is out of scope for current pdflatex runtime policy' },
  { token: "\\printbibliography", pattern: /\\printbibliography\b/i, message: 'command "\\printbibliography" is out of scope for current pdflatex runtime policy' },
  { token: "\\makeindex", pattern: /\\makeindex\b/i, message: 'command "\\makeindex" is out of scope for current pdflatex runtime policy' },
  { token: "\\printindex", pattern: /\\printindex\b/i, message: 'command "\\printindex" is out of scope for current pdflatex runtime policy' },
];

export const normalizeLatexSource = (texSource: string): string => {
  if (typeof texSource !== "string" || !texSource.trim()) {
    throw new LatexRuntimeError("INVALID_LATEX_INPUT", "tex must be a non-empty string");
  }

  if (texSource.length > latexRuntimePolicy.LATEX_MAX_SOURCE_LENGTH) {
    throw new LatexRuntimeError(
      "LATEX_TOO_LARGE",
      `tex exceeds max length (${latexRuntimePolicy.LATEX_MAX_SOURCE_LENGTH})`,
    );
  }

  return texSource;
};

export const findPdflatexIncompatibility = (
  texSource: string,
): PdflatexIncompatibility | null => {
  const tex = ensurePdflatexDocumentEnvelope(normalizeLatexSource(texSource));
  const packagePattern = /\\usepackage(?:\[[^\]]*])?\{([^}]+)\}/g;

  for (const match of tex.matchAll(packagePattern)) {
    const packages = match[1]
      .split(",")
      .map((pkg) => pkg.trim().toLowerCase())
      .filter(Boolean);
    for (const pkg of packages) {
      const message = DISALLOWED_PACKAGES.get(pkg);
      if (message) {
        return { kind: "package", token: pkg, message };
      }
    }
  }

  for (const command of DISALLOWED_COMMANDS) {
    if (command.pattern.test(tex)) {
      return {
        kind: command.token.startsWith("\\print") || command.token.startsWith("\\bibli")
          ? "toolchain"
          : "command",
        token: command.token,
        message: command.message,
      };
    }
  }

  return null;
};

export const assertPdflatexCompatible = (texSource: string): void => {
  const incompatibility = findPdflatexIncompatibility(texSource);
  if (!incompatibility) return;

  throw new LatexRuntimeError(
    "LATEX_COMPILE_FAILED",
    `LaTeX source is not compatible with pdflatex runtime policy: ${incompatibility.message}`,
  );
};

export const isUnknownTikzColorError = (log?: string): boolean => {
  if (!log) return false;
  return (
    /Package\s+pgfkeys\s+Error:\s+I\s+do\s+not\s+know\s+the\s+key\s+'\/tikz\/[^']+'/i.test(log) ||
    /Package\s+xcolor\s+Error:\s+Undefined\s+color/i.test(log)
  );
};

export const buildXcolorNamesFallback = (tex: string): string => {
  const requiredNames = ["dvipsnames", "svgnames", "x11names"];
  const passOptionsPattern = /\\PassOptionsToPackage\{([^}]*)\}\{xcolor\}/;
  const existingPassOptions = tex.match(passOptionsPattern);

  if (existingPassOptions) {
    const existing = existingPassOptions[1]
      .split(",")
      .map((option) => option.trim())
      .filter(Boolean);
    const normalized = new Set(existing.map((option) => option.toLowerCase()));
    const missing = requiredNames.filter((option) => !normalized.has(option));
    if (missing.length === 0) return tex;

    const merged = [...existing, ...missing].join(",");
    return tex.replace(passOptionsPattern, `\\PassOptionsToPackage{${merged}}{xcolor}`);
  }

  const line = `\\PassOptionsToPackage{${requiredNames.join(",")}}{xcolor}\n`;
  const documentclassPattern = /(\\documentclass(?:\[[^\]]*])?\{[^}]+\}\s*)/;
  if (documentclassPattern.test(tex)) {
    return tex.replace(documentclassPattern, `$1\n${line}`);
  }
  return `${line}\n${tex}`;
};
