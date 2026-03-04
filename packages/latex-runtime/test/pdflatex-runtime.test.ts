import { describe, expect, it } from "vitest";
import {
  buildXcolorNamesFallback,
  ensurePdflatexDocumentEnvelope,
  findPdflatexIncompatibility,
  shouldRunPdflatexThirdPass,
} from "../src";

describe("pdflatex runtime helpers", () => {
  it("wraps fragment with canonical pdflatex preamble", () => {
    const wrapped = ensurePdflatexDocumentEnvelope("Привет");

    expect(wrapped).toContain("\\documentclass[a4paper,14pt]{extarticle}");
    expect(wrapped).toContain("\\usepackage[T2A]{fontenc}");
    expect(wrapped).toContain("\\usepackage[utf8]{inputenc}");
    expect(wrapped).toContain("\\begin{document}");
    expect(wrapped).toContain("Привет");
    expect(wrapped).toContain("\\end{document}");
  });

  it("keeps full document unchanged", () => {
    const source = "\\documentclass{article}\n\\begin{document}ok\\end{document}";
    expect(ensurePdflatexDocumentEnvelope(source)).toBe(source);
  });

  it("rejects XeTeX-only package", () => {
    expect(
      findPdflatexIncompatibility(
        "\\documentclass{article}\n\\usepackage{fontspec}\n\\begin{document}ok\\end{document}",
      ),
    ).toMatchObject({
      kind: "package",
      token: "fontspec",
    });
  });

  it("rejects unsupported commands and toolchain markers", () => {
    expect(findPdflatexIncompatibility("\\includesvg{demo}")).toMatchObject({
      token: "\\includesvg",
    });
    expect(findPdflatexIncompatibility("\\printbibliography")).toMatchObject({
      token: "\\printbibliography",
    });
  });

  it("adds xcolor named options only once", () => {
    const firstPass = buildXcolorNamesFallback(
      "\\documentclass{article}\n\\begin{document}ok\\end{document}",
    );
    const secondPass = buildXcolorNamesFallback(firstPass);

    expect(firstPass).toContain(
      "\\PassOptionsToPackage{dvipsnames,svgnames,x11names}{xcolor}",
    );
    expect(secondPass).toBe(firstPass);
  });

  it("detects when pdflatex needs third pass", () => {
    expect(shouldRunPdflatexThirdPass("LaTeX Warning: Label(s) may have changed.")).toBe(true);
    expect(shouldRunPdflatexThirdPass("Compilation completed successfully.")).toBe(false);
  });
});
