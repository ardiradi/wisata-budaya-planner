import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);
const listOnly = args.includes("--list");
const outputFlag = args.indexOf("--output");
const outputArgument = outputFlag < 0 ? undefined : args[outputFlag + 1];
const recognized = new Set([
  ...(listOnly ? ["--list"] : []),
  ...(outputFlag < 0 ? [] : ["--output", outputArgument]),
]);
if (
  args.some((argument) => !recognized.has(argument)) ||
  (outputFlag >= 0 && (!outputArgument || outputArgument.startsWith("--")))
)
  throw new Error(
    "Use profile:planner [-- --output relative/file.json] or --list.",
  );

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const output = path.resolve(
  root,
  outputArgument ?? `.submission-build/e1/planner-profile-${stamp}.json`,
);
const relative = path.relative(root, output);
if (
  relative.startsWith("..") ||
  path.isAbsolute(relative) ||
  path.extname(output) !== ".json"
)
  throw new Error("The report must be a JSON file inside this workspace.");

// This command imports only deterministic synthetic adapters. Even inherited live
// configuration cannot enable the separate server-only Gemini boundary here.
const result = spawnSync(
  process.execPath,
  [
    path.join(root, "node_modules/vitest/vitest.mjs"),
    listOnly ? "list" : "run",
    "--config",
    path.join(root, "scripts/quality/vitest.profile.config.ts"),
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      GEMINI_DEMO_SMOKE_ENABLED: "false",
      WISATA_PROFILE_OUTPUT: output,
    },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
