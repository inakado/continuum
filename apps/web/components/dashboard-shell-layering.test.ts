import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readCss = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

describe("dashboard shell layering", () => {
  it.each([
    "./student-dashboard-shell.module.css",
    "./teacher-dashboard-shell.module.css",
  ])("keeps %s above embedded tools", (stylesheet) => {
    expect(readCss(stylesheet)).toMatch(
      /\.sidebar\s*{[\s\S]*?z-index:\s*var\(--z-shell-sidebar\)/,
    );
  });

  it.each([
    [
      "../features/student-content/units/student-unit-detail.module.css",
      ["boardCanvasShell", "feedbackBoardCanvasShell"],
    ],
    [
      "../features/teacher-review/teacher-review-submission-detail-panel.module.css",
      ["boardReviewCanvasShell"],
    ],
  ])("isolates embedded Excalidraw layers in %s", (stylesheet, classNames) => {
    const css = readCss(stylesheet);

    for (const className of classNames) {
      expect(css).toMatch(
        new RegExp(`\\.${className}\\s*\\{[^}]*isolation:\\s*isolate`),
      );
    }
  });
});
