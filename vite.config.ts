import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    ignorePatterns: ["dist/**"],
    options: {
      denyWarnings: true,
    },
  },
  test: {
    coverage: {
      exclude: ["test/**"],
      reporter: ["text", "lcov"],
    },
    include: ["test/**/*.test.ts"],
  },
});
