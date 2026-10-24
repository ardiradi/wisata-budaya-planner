import path from "node:path";
import { defineConfig } from "vitest/config";

const root = path.resolve(import.meta.dirname, "../..");
if (!process.env.WISATA_PROFILE_OUTPUT)
  throw new Error("Run the explicit npm run profile:planner command.");
export default defineConfig({
  root,
  resolve: { alias: { "@": path.join(root, "src") } },
  test: {
    environment: "node",
    include: ["scripts/quality/planner-profile.test.ts"],
    provide: { profileOutput: process.env.WISATA_PROFILE_OUTPUT },
    maxWorkers: 1,
    testTimeout: 10000,
  },
});
