import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/electron/shared-services/**/*.test.ts", "src/renderer/**/*.test.tsx"]
  }
});
