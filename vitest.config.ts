import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Next.js `server-only` throws outside RSC; stub it for Vitest.
      "server-only": path.resolve(__dirname, "./tests/shims/server-only.ts"),
    },
  },
});
