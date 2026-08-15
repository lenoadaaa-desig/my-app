import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Only modules/ and lib/ — never node_modules or .next.
    include: ["modules/**/*.test.ts", "lib/**/*.test.ts"],
  },
});
