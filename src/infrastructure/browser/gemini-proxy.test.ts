import { describe, expect, it, vi } from "vitest";
import { getGeminiProxy } from "./gemini-proxy";
import { buildRankingRequest } from "@/domain/recommendations/ranking";
import {
  testPreferences,
  testCatalogue,
  TEST_AS_OF,
} from "@/domain/recommendations/adversarial.fixtures";

describe("server-only Gemini browser proxy", () => {
  it("uses a local URL and explicit one-shot header, preserving controlled 429 metadata", async () => {
    const body = {
      status: "error",
      code: "RATE_LIMITED",
      retryable: false,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        simulatedCostMicroUsd: 0,
        modelCalls: 1,
      },
    };
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json(body, { status: 429 }));
    const request = buildRankingRequest(
      testPreferences(),
      testCatalogue(),
      TEST_AS_OF,
      () => true,
    ).request;
    const signal = new AbortController().signal;
    expect(
      await getGeminiProxy("gemini-2.5-flash").rank(request, {
        attempt: 1,
        signal,
      }),
    ).toEqual(body);
    expect(fetcher.mock.calls[0][0]).toBe("/api/recommendations/gemini");
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({
      "x-wisata-gemini-confirm": "one-free-tier-smoke",
    });
    expect(fetcher.mock.calls[0][1]?.signal).toBe(signal);
    expect(getGeminiProxy("gemini-2.5-flash").maxAttempts).toBe(1);
    expect(getGeminiProxy("gemini-2.5-flash").timeoutMs).toBeLessThan(45000);
  });
  it("rejects raw provider error prose instead of presenting it", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ message: "untrusted external prose" }),
    );
    const request = buildRankingRequest(
      testPreferences(),
      testCatalogue(),
      TEST_AS_OF,
      () => true,
    ).request;
    await expect(
      getGeminiProxy("gemini-2.5-flash").rank(request, {
        attempt: 1,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow();
  });
});
