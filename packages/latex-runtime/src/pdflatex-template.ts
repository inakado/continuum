const CANONICAL_PDFLATEX_PREAMBLE = [
  "\\documentclass[a4paper,14pt]{extarticle}",
  "\\usepackage{cmap}",
  "\\usepackage[T2A]{fontenc}",
  "\\usepackage[utf8]{inputenc}",
  "\\usepackage[english,russian]{babel}",
  "\\usepackage{amsmath,amssymb,amsthm,mathtools}",
  "\\usepackage{graphicx}",
  "\\usepackage{xcolor}",
  "\\usepackage{tikz}",
];

export const pdfLatexCanonicalPreamble = CANONICAL_PDFLATEX_PREAMBLE.join("\n");

export const hasDocumentEnvelope = (tex: string): boolean =>
  /\\begin\{document\}/.test(tex) && /\\end\{document\}/.test(tex);

export const wrapLatexFragmentWithCanonicalPreamble = (fragment: string): string =>
  `${pdfLatexCanonicalPreamble}\n\\begin{document}\n${fragment}\n\\end{document}\n`;

export const ensurePdflatexDocumentEnvelope = (tex: string): string =>
  hasDocumentEnvelope(tex) ? tex : wrapLatexFragmentWithCanonicalPreamble(tex);
