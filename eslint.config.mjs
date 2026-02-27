import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import boundaries from "eslint-plugin-boundaries";

const tsGlobs = ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"];

const boundariesSettings = {
  "boundaries/include": tsGlobs,
  "boundaries/elements": [
    { type: "api", pattern: "apps/api/src/**/*", mode: "full" },
    { type: "worker", pattern: "apps/worker/src/**/*", mode: "full" },
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
            { from: "web", allow: ["web", "shared"] },
            { from: "shared", allow: ["shared"] },
          ],
        },
      ],
    },
  },
];
