import { mkdir, open, stat } from "node:fs/promises";
import path from "node:path";

export type SmokePermit = (model: string) => Promise<boolean>;

/** One irreversible local reservation, including uncertain failures. No request or secret is saved. */
export function createFileSmokePermit(
  directory = path.join(process.cwd(), ".local-demo"),
  now: () => string = () => new Date().toISOString(),
): SmokePermit {
  return async (model) => {
    let handle;
    try {
      await mkdir(directory, { recursive: true });
      handle = await open(
        path.join(directory, "gemini-smoke-consumed.json"),
        "wx",
        0o600,
      );
      await handle.writeFile(
        JSON.stringify({
          schemaVersion: "gemini-smoke-permit-v1",
          model,
          reservedAt: now(),
          status: "reserved-no-automatic-retry",
        }),
      );
      await handle.sync();
      return true;
    } catch {
      // Existing reservation and all filesystem uncertainty fail closed.
      return false;
    } finally {
      await handle?.close();
    }
  };
}

/** Test injection only. Production endpoint always uses the exclusive file reservation. */
export function createMemorySmokePermit(): SmokePermit {
  let used = false;
  return async () => {
    if (used) return false;
    used = true;
    return true;
  };
}

/** Read-only fail-closed status, including unreadable/uncertain receipt paths. */
export async function isFileSmokeConsumed(
  directory = path.join(process.cwd(), ".local-demo"),
): Promise<boolean> {
  try {
    await stat(path.join(directory, "gemini-smoke-consumed.json"));
    return true;
  } catch (caught) {
    return !(
      caught &&
      typeof caught === "object" &&
      "code" in caught &&
      caught.code === "ENOENT"
    );
  }
}
