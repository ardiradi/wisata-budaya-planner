import { describe, expect, it, vi } from "vitest";
import { createEditorialSession } from "@/application/editorial/session";
import { buildRecommendationProfile } from "@/application/planning/preview-planner";
import { normalizePreferences } from "@/domain/normalization";
import { buildRankingRequest } from "@/domain/recommendations/ranking";
import { getLocalRepository } from "@/infrastructure/synthetic/catalogue";
import { createMemorySmokePermit } from "./permit";
import { handleGeminiRecommendation, isSameOriginLoopback } from "./service";
import { approvedRequest, sdkResponse } from "./test-fixtures";

const AS_OF = "2026-10-23T10:00:00.000Z";
const env = {
  GEMINI_API_KEY: "synthetic-unit-test-placeholder-no-live-key",
  GEMINI_FREE_TIER_CONFIRMED: "true",
  GEMINI_DEMO_SMOKE_ENABLED: "true",
  GEMINI_MODEL: "gemini-2.5-flash",
};

describe("browser/editorial to server preflight binding reproductions, SDK injected only", () => {
  it.each(["history", "craft", "architecture"] as const)(
    "initial editorial %s profile exactly matches server baseline and can reach an injected SDK",
    async (profile) => {
      const submission = buildRecommendationProfile(profile, "2026-10-23");
      const normalized = normalizePreferences(
        { ...submission.input, cityId: "palembang", days: submission.days },
        { today: "2026-10-23" },
      );
      if (!normalized.ok)
        throw new Error("Invalid synthetic test preferences.");
      const editorial = createEditorialSession({
        now: () => AS_OF,
      }).getRepository();
      const baseline = getLocalRepository();
      const client = buildRankingRequest(
        normalized.value,
        await editorial.list("palembang"),
        AS_OF,
        editorial.isCurrent.bind(editorial),
      ).request;
      const server = buildRankingRequest(
        normalized.value,
        await baseline.list("palembang"),
        AS_OF,
        baseline.isCurrent.bind(baseline),
      ).request;
      expect(client.snapshotId).toBe(server.snapshotId);
      expect(JSON.stringify(client)).toBe(JSON.stringify(server));
      const generate = vi.fn(async () => sdkResponse(client));
      const response = await handleGeminiRecommendation(
        new Request("http://127.0.0.1:3000/api/recommendations/gemini", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://127.0.0.1:3000",
            "x-wisata-gemini-confirm": "one-free-tier-smoke",
          },
          body: JSON.stringify(client),
        }),
        {
          env,
          generateContent: generate,
          consumePermit: createMemorySmokePermit(),
          now: () => AS_OF,
        },
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        status: "ok",
        usage: { modelCalls: 1 },
      });
      expect(generate).toHaveBeenCalledTimes(1);
    },
  );

  it("accepts the equivalent localhost internal URL and browser 127.0.0.1 Origin on the same port", async () => {
    const request = new Request(
      "http://localhost:3000/api/recommendations/gemini",
      {
        method: "POST",
        headers: {
          host: "127.0.0.1:3000",
          origin: "http://127.0.0.1:3000",
          "content-type": "application/json",
          "x-wisata-gemini-confirm": "one-free-tier-smoke",
        },
        body: JSON.stringify(approvedRequest()),
      },
    );
    expect(isSameOriginLoopback(request)).toBe(true);
    const generate = vi.fn(async () => sdkResponse());
    const consume = vi.fn(createMemorySmokePermit());
    const response = await handleGeminiRecommendation(request, {
      env,
      generateContent: generate,
      consumePermit: consume,
      now: () => AS_OF,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      usage: { modelCalls: 1 },
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(consume).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["http://127.0.0.1:3000", "http://127.0.0.1:3001"],
    ["http://127.0.0.1:3000", "https://127.0.0.1:3000"],
    ["http://127.0.0.1:3000", "http://evil.example:3000"],
    ["http://evil.example:3000", "http://evil.example:3000"],
    ["http://localhost:3000", "http://127.0.0.1:3001"],
    ["http://localhost:3000", "http://127.0.0.1:3000/"],
    ["http://localhost:3000", "http://127.0.0.1:3000?injected=1"],
    ["http://localhost:3000", "http://user@127.0.0.1:3000"],
  ])("continues denying unsafe origin/request pair %s / %s", (url, origin) => {
    expect(
      isSameOriginLoopback(
        new Request(`${url}/api/recommendations/gemini`, {
          headers: { origin },
        }),
      ),
    ).toBe(false);
  });

  it.each(["evil.example:3000", "127.0.0.1:3001", "user@127.0.0.1:3000"])(
    "denies unsafe Host header %s",
    (host) => {
      expect(
        isSameOriginLoopback(
          new Request("http://localhost:3000/api/recommendations/gemini", {
            headers: { host, origin: "http://127.0.0.1:3000" },
          }),
        ),
      ).toBe(false);
    },
  );
});
