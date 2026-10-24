import { fallbackResponse } from "@/domain/recommendations/ranking";
import { simulatedTokens } from "@/domain/recommendations/orchestrator";
import type { RecommendationProvider } from "@/domain/recommendations/contracts";
export type MockRankingScenario =
  "normal" | "invalid" | "failure" | "timeout" | "cost-denied" | "repair";
/** No SDK, credential, fetch, model knowledge or live service. */
export function getMockRankingProvider(
  scenario: MockRankingScenario = "normal",
): RecommendationProvider {
  return {
    id: "synthetic-mock-ranker-v1",
    admit: () => scenario !== "cost-denied",
    async rank(request, context) {
      const output = fallbackResponse(request);
      // A deterministic personalization fixture favors an exact culinary tag match.
      if (request.preferences.foodPreference !== "neutral")
        output.rankings.sort((a, b) => {
          const exact = (id: string) => {
            const c = request.candidates.find((c) => c.placeId === id)!;
            return c.kind === "food" &&
              c.foodTags.length === 1 &&
              c.foodTags[0] === request.preferences.foodPreference
              ? 1
              : 0;
          };
          return exact(b.placeId) - exact(a.placeId);
        });
      const usage = {
        inputTokens: simulatedTokens(request),
        outputTokens: simulatedTokens(output),
        simulatedCostMicroUsd: 1000,
      };
      if (scenario === "failure")
        return {
          status: "error",
          code: "UNAVAILABLE",
          retryable: false,
          usage,
        };
      if (scenario === "timeout")
        return { status: "error", code: "TIMEOUT", retryable: true, usage };
      if (
        scenario === "invalid" ||
        (scenario === "repair" && context.attempt === 1)
      ) {
        if (output.rankings[0])
          output.rankings[0].placeId = "unknown-injected-place";
      }
      return { status: "ok", output, usage };
    },
  };
}
