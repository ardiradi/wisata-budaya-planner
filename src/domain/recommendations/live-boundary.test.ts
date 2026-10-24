import { describe, expect, it, vi } from "vitest";
import { planItinerary } from "@/domain/planner";
import { getSyntheticRouting } from "@/infrastructure/synthetic/routing";
import { fallbackResponse } from "./ranking";
import type { RecommendationProvider } from "./contracts";
import {
  testPreferences,
  instrumentedRepository,
  TEST_AS_OF,
} from "./adversarial.fixtures";

function provider(calls: 0 | 1): RecommendationProvider {
  return {
    id: "gemini-test-fake",
    kind: "live",
    modelId: "gemini-3.8-flash",
    maxAttempts: 1,
    timeoutMs: 1000,
    async rank(request) {
      return {
        status: "ok",
        output: fallbackResponse(request),
        usage: {
          inputTokens: 3000,
          outputTokens: 500,
          simulatedCostMicroUsd: 0,
          modelCalls: calls,
          inputBoundTokens: 11000,
        },
      };
    },
  };
}
const deps = (recommendationProvider: RecommendationProvider) => ({
  repository: instrumentedRepository(),
  routing: getSyntheticRouting(),
  evaluatedAt: TEST_AS_OF,
  now: () => 0,
  recommendationProvider,
});
describe("live-kind boundary using mock responses, never actual inference", () => {
  it("labels only validated dispatched output as Gemini while retaining budget, meals and schedule authority", async () => {
    const result = await planItinerary(testPreferences(), deps(provider(1)));
    expect(result.status).toBe("validated");
    expect(result.recommendation?.source).toBe("gemini_live");
    expect(result.work.modelCalls).toBe(1);
    expect(result.recommendation?.actualApiCostMicroUsd).toBeNull();
    expect(result.work.routeAttempts).toBe(3);
    expect(result.cost.totalUpperIdr).toBe(280500);
    expect(result.days[0].meals.reduce((n, m) => n + m.purchased, 0)).toBe(4);
    expect(result.coverage.missingCategoryIds).toEqual([]);
  });
  it("does not claim a real model response when dispatch metadata is absent", async () => {
    const result = await planItinerary(testPreferences(), deps(provider(0)));
    expect(result.recommendation?.source).toBe("deterministic_fallback");
    expect(result.recommendation?.rejectionCodes).toContain("SCHEMA_INVALID");
    expect(result.work.modelCalls).toBe(0);
    expect(result.cost.totalUpperIdr).toBe(280500);
  });
  it("uses one bounded attempt and fallback on a controlled rate-limit response", async () => {
    const p = provider(1);
    const rank = vi.fn(async () => ({
      status: "error",
      code: "RATE_LIMITED",
      retryable: false,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        simulatedCostMicroUsd: 0,
        modelCalls: 1,
      },
    }));
    const result = await planItinerary(testPreferences(), deps({ ...p, rank }));
    expect(rank).toHaveBeenCalledTimes(1);
    expect(result.recommendation?.source).toBe("deterministic_fallback");
    expect(result.recommendation?.rejectionCodes).toContain("RATE_LIMITED");
    expect(result.work.modelCalls).toBe(1);
    expect(result.status).toBe("validated");
  });
});
