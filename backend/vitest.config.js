// Chạy tuần tự các test API để không tranh chấp collection trong database test.
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 15000,
    pool: "forks",
  },
});
