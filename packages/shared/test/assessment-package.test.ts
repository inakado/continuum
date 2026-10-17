import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AssessmentPackageManifestSchema, AssessmentPackageTaskSchema } from "../src/contracts/assessment-package";

const root = fileURLToPath(new URL("../../../examples/assessment-package/pilot-v1/", import.meta.url));
const json = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));
const task = (id: string) => AssessmentPackageTaskSchema.parse(json(path.join(root, "tasks", id, "task.json")));

describe("assessment package candidate v1", () => {
  it("validates all six real tasks and their referenced files", () => {
    const manifest = AssessmentPackageManifestSchema.parse(json(path.join(root, "manifest.json")));
    expect(manifest.tasks).toHaveLength(6);
    for (const id of manifest.tasks) {
      const item = task(id);
      expect(item.id).toBe(id);
      const dir = path.join(root, "tasks", id);
      const statement = readFileSync(path.join(dir, "statement.md"), "utf8");
      expect(statement.trim()).not.toBe("");
      expect(statement).not.toMatch(/\\(?:newpage|begin\{task\}|includegraphics)/);
      const content = [statement, ...("options" in item ? item.options.map((v) => v.content) : []), ...("rows" in item ? item.rows.map((v) => v.content) : [])].join("\n");
      const images = [...content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1]);
      for (const image of images) {
        expect(image).toMatch(/^images\/[a-z0-9-]+\.(png|jpg)$/);
        expect(readFileSync(path.join(dir, image)).length).toBeGreaterThan(100);
      }
      const files = readdirSync(dir, { recursive: true }).filter((entry) => /\.[a-z]+$/.test(String(entry))).map(String);
      expect(files.sort()).toEqual(["task.json", "statement.md", ...images].sort());
    }
  });
  it("keeps repeated matches and image-bearing rows", () => {
    expect(task("shkolkovo-14139").grading).toEqual({ matches: { radius: "2", force: "2" } });
    const item = task("shkolkovo-24187");
    expect(item.type).toBe("matching");
    if (item.type === "matching") expect(item.rows[0].content).toContain("images/graph-a.png");
  });
  it("rejects absent, unknown and duplicate answer references", () => {
    const item = task("shkolkovo-14139");
    for (const matches of [{ radius: "2" }, { radius: "2", force: "4" }, { radius: "2", force: "2", extra: "1" }]) {
      expect(AssessmentPackageTaskSchema.safeParse({ ...item, grading: { matches } }).success).toBe(false);
    }
    const multiple = task("shkolkovo-17846");
    expect(AssessmentPackageTaskSchema.safeParse({ ...multiple, grading: { correctOptionIds: ["2", "2"] } }).success).toBe(false);
    expect(AssessmentPackageTaskSchema.safeParse({ ...multiple, grading: { correctOptionIds: ["6"] } }).success).toBe(false);
    if (multiple.type === "multiple_choice") expect(AssessmentPackageTaskSchema.safeParse({ ...multiple, options: [multiple.options[0], multiple.options[0]] }).success).toBe(false);
  });
  it("requires canonical numeric keys and valid tolerances", () => {
    const item = task("shkolkovo-11121");
    expect(AssessmentPackageTaskSchema.safeParse({ ...item, grading: { answer: "$4{,}83$", absoluteTolerance: 0 } }).success).toBe(false);
    expect(AssessmentPackageTaskSchema.safeParse({ ...item, grading: { answer: "4.83", absoluteTolerance: -1 } }).success).toBe(false);
    expect(AssessmentPackageTaskSchema.safeParse({ ...item, type: "short_text", unit: undefined, grading: { acceptedAnswers: ["Гелий"], caseSensitive: false } }).success).toBe(false); // strict objects reject the numeric-only unit key.
    const { unit: _unit, ...base } = item.type === "short_number" ? item : { ...item, unit: "" };
    expect(AssessmentPackageTaskSchema.safeParse({ ...base, type: "short_text", grading: { acceptedAnswers: ["Гелий"], caseSensitive: false } }).success).toBe(true);
  });
  it("rejects manifest duplicates, unsafe ids and unsupported task types", () => {
    const manifest = json(path.join(root, "manifest.json")) as Record<string, unknown>;
    for (const tasks of [["same", "same"], ["../escape"]]) expect(AssessmentPackageManifestSchema.safeParse({ ...manifest, tasks }).success).toBe(false);
    expect(AssessmentPackageManifestSchema.safeParse({ ...manifest, version: 2 }).success).toBe(false);
    expect(AssessmentPackageTaskSchema.safeParse({ ...task("shkolkovo-11121"), type: "extended" }).success).toBe(false);
  });
});
