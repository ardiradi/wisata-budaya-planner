import { mkdtemp, readFile, rmdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createFileSmokePermit, isFileSmokeConsumed } from "./permit";

describe("single-dispatch durable local smoke permit", () => {
  it("uses atomic exclusive creation and survives a new factory without storing prompts or credentials", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "wisata-gemini-permit-test-"),
    );
    const receipt = path.join(directory, "gemini-smoke-consumed.json");
    try {
      expect(await isFileSmokeConsumed(directory)).toBe(false);
      const permit = createFileSmokePermit(
        directory,
        () => "2026-10-23T10:00:00.000Z",
      );
      const attempts = await Promise.all(
        Array.from({ length: 12 }, () => permit("gemini-3.8-flash")),
      );
      expect(attempts.filter(Boolean)).toHaveLength(1);
      expect(await isFileSmokeConsumed(directory)).toBe(true);
      expect(await createFileSmokePermit(directory)("gemini-2.5-flash")).toBe(
        false,
      );
      expect(JSON.parse(await readFile(receipt, "utf8"))).toEqual({
        schemaVersion: "gemini-smoke-permit-v1",
        model: "gemini-3.8-flash",
        reservedAt: "2026-10-23T10:00:00.000Z",
        status: "reserved-no-automatic-retry",
      });
    } finally {
      await unlink(receipt).catch(() => {});
      await rmdir(directory);
    }
  });
});
