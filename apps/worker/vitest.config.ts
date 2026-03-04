import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@continuum/latex-runtime": path.resolve(
        __dirname,
        "../../packages/latex-runtime/src/index.ts",
      ),
      "@continuum/shared": path.resolve(
        __dirname,
        "../../packages/shared/src/index.ts",
      ),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
