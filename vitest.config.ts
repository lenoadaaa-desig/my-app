import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // The real `server-only` package throws unless resolved under Next's
      // "react-server" export condition (its package.json exports map picks
      // index.js — which always throws — for every other condition), a
      // condition Vitest never sets. Its no-op variant (empty.js) isn't a
      // declared subpath export either, so it can't be aliased to directly
      // (Node's exports-map enforcement blocks it) — alias to a local stub
      // instead.
      "server-only": fileURLToPath(new URL("./vitest-server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    // Only modules/ and lib/ — never node_modules or .next.
    include: ["modules/**/*.test.ts", "lib/**/*.test.ts"],
  },
});
