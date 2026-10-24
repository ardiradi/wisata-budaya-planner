import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const [command, ...args] = process.argv.slice(2);
if (!["dev", "build", "start", "typegen"].includes(command))
  throw new Error("Unsupported local Next command");

// No account setup. Bind preview servers to loopback and disable framework telemetry.
const child = spawn(
  process.execPath,
  [
    require.resolve("next/dist/bin/next"),
    command,
    ...args,
    ...(["dev", "start"].includes(command) ? ["--hostname", "127.0.0.1"] : []),
  ],
  {
    stdio: "inherit",
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  },
);
child.on("error", () => {
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
