import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const root = path.resolve(import.meta.dirname, "../..");
const buildRoot = path.join(root, ".submission-build");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const stage = path.join(buildRoot, `competition-source-${stamp}`);
const rootFiles = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "next.config.ts",
  "netlify.toml",
  "postcss.config.mjs",
  ".npmrc",
  "scripts/next-local.mjs",
];
const entries = [];
const forbidden =
  /(^|\/)(?:\.env[^/]*|\.local-demo|\.git|node_modules|\.next|docs|experiments|submission|test-results|playwright-report)(?:\/|$)/;

async function collect(relative) {
  const absolute = path.join(root, relative);
  const stat = await fs.lstat(absolute);
  if (stat.isSymbolicLink())
    throw new Error(`Symlink is not an upload input: ${relative}`);
  if (stat.isDirectory()) {
    for (const name of await fs.readdir(absolute))
      await collect(path.join(relative, name));
  } else if (
    !/\.(?:test|spec)\./.test(relative) &&
    !/(?:adversarial\.fixtures|test-fixtures)\.[tj]s$/.test(relative)
  ) {
    entries.push(relative.replaceAll(path.sep, "/"));
  }
}

for (const file of rootFiles) await collect(file);
await collect("src");
await collect("public");
if (!stage.startsWith(buildRoot + path.sep))
  throw new Error(
    "Stage must stay within the private workspace build directory.",
  );
await fs.mkdir(buildRoot, { recursive: true });
if ((await fs.lstat(buildRoot)).isSymbolicLink())
  throw new Error("The private build directory must not be a symlink.");
await fs.mkdir(stage, { recursive: false });
const manifest = [];
for (const file of entries.sort()) {
  if (forbidden.test(file) || /(?:\.log|\.map|\.zip|\.tsbuildinfo)$/.test(file))
    throw new Error(`Forbidden upload input: ${file}`);
  const sourceBytes = await fs.readFile(path.join(root, file));
  // The CLI can infer the parent Git workspace when staging inside this repo.
  // Generate a private absolute base so it finds this stage's server function.
  const bytes =
    file === "netlify.toml"
      ? Buffer.from(
          sourceBytes
            .toString("utf8")
            .replace(
              /\[build\]\r?\n/,
              `[build]\n  base = ${JSON.stringify(stage.replaceAll(path.sep, "/"))}\n`,
            ),
        )
      : sourceBytes;
  if (/AIza[0-9A-Za-z_-]{35}/.test(bytes.toString("utf8")))
    throw new Error(`Credential-shaped content in upload input: ${file}`);
  const target = path.join(stage, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, bytes, { flag: "wx" });
  manifest.push({
    file,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    ...(file === "netlify.toml"
      ? {
          generatedAbsoluteBase: true,
          canonicalSha256: createHash("sha256")
            .update(sourceBytes)
            .digest("hex"),
        }
      : {}),
  });
}
// Kept outside the upload directory; manifests and local paths are not app assets.
await fs.writeFile(
  `${stage}.manifest.json`,
  JSON.stringify(manifest, null, 2),
  { flag: "wx" },
);
console.log(
  JSON.stringify(
    {
      stage,
      files: manifest.length,
      bytes: manifest.reduce((sum, file) => sum + file.bytes, 0),
      includesEnvironmentFiles: false,
      includesResearch: false,
      uploaded: false,
      requiredBuildFlag: "NEXT_PUBLIC_COMPETITION_DEMO=true",
    },
    null,
    2,
  ),
);
