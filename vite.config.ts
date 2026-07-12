import { defineConfig } from "vite-plus";

import { socialCalcBuildInput, socialCalcBuildPlugin } from "./build";

export default defineConfig({
  build: {
    emptyOutDir: false,
    minify: false,
    rolldownOptions: {
      input: socialCalcBuildInput,
    },
  },
  lint: {
    ignorePatterns: ["dist/**"],
    options: {
      denyWarnings: true,
      typeAware: true,
      typeCheck: true,
    },
  },
  plugins: [socialCalcBuildPlugin()],
  test: {
    coverage: {
      exclude: ["test/**"],
      reporter: ["text", "lcov"],
    },
    include: ["test/**/*.test.ts"],
  },
});
