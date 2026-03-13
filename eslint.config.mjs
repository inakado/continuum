import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import boundaries from "eslint-plugin-boundaries";

const tsGlobs = ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"];

const boundariesSettings = {
  "boundaries/include": tsGlobs,
  "boundaries/elements": [
    { type: "api", pattern: "apps/api/src/**/*", mode: "full" },
    { type: "worker", pattern: "apps/worker/src/**/*", mode: "full" },
    {
      type: "web-student-feature",
      pattern: "apps/web/features/student-*/**/*",
      mode: "full",
    },
    {
      type: "web-teacher-feature",
      pattern: "apps/web/features/teacher-*/**/*",
      mode: "full",
    },
    { type: "web", pattern: "apps/web/**/*", mode: "full" },
    { type: "shared", pattern: "packages/shared/src/**/*", mode: "full" },
  ],
};

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/*.d.ts",
    ],
  },
  {
    files: tsGlobs,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      boundaries,
    },
    settings: boundariesSettings,
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      complexity: ["warn", 20],
      "max-lines": [
        "warn",
        { max: 1200, skipBlankLines: true, skipComments: true },
      ],
      "boundaries/element-types": [
        "error",
        {
          default: "allow",
          rules: [
            { from: "api", allow: ["api", "shared"] },
            { from: "worker", allow: ["worker", "shared"] },
            { from: "web-student-feature", disallow: ["web-teacher-feature"] },
            { from: "web-teacher-feature", disallow: ["web-student-feature"] },
            { from: "web", allow: ["web", "shared"] },
            { from: "shared", allow: ["shared"] },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/web/features/student-*/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/components/DashboardShell",
              message:
                "Используйте StudentDashboardShell вместо общего DashboardShell в student feature-коде.",
            },
            {
              name: "@/components/TeacherDashboardShell",
              message:
                "Student feature-код не должен зависеть от teacher dashboard shell.",
            },
            {
              name: "@/components/TeacherShell",
              message: "Student feature-код не должен зависеть от teacher shell.",
            },
          ],
          patterns: [
            {
              group: ["@/features/teacher-*"],
              message:
                "Student feature-код не должен импортировать teacher feature-модули напрямую.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/web/features/teacher-*/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/components/DashboardShell",
              message:
                "Используйте TeacherDashboardShell вместо общего DashboardShell в teacher feature-коде.",
            },
            {
              name: "@/components/StudentDashboardShell",
              message:
                "Teacher feature-код не должен зависеть от student dashboard shell.",
            },
            {
              name: "@/components/StudentShell",
              message: "Teacher feature-код не должен зависеть от student shell.",
            },
          ],
          patterns: [
            {
              group: ["@/features/student-*"],
              message:
                "Teacher feature-код не должен импортировать student feature-модули напрямую.",
            },
          ],
        },
      ],
    },
  },
];
