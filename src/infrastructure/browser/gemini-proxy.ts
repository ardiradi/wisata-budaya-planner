import {
  RankingOutcomeSchema,
  RankingRequestSchema,
  type RecommendationProvider,
} from "@/domain/recommendations/contracts";
import { COMPETITION_DEMO } from "@/config/demo";

/** Only the loopback server imports the SDK or reads GEMINI_API_KEY. */
export function getGeminiProxy(
  modelId: "gemini-3.8-flash" | "gemini-2.5-flash",
): RecommendationProvider {
  return {
    id: modelId.replaceAll(".", "-"),
    kind: "live",
    modelId,
    maxAttempts: 1,
    timeoutMs: 14000,
    async rank(input, context) {
      if (COMPETITION_DEMO)
        return {
          status: "error",
          code: "LIVE_DISABLED",
          retryable: false,
          usage: {
            inputTokens: 0,
            outputTokens: 0,
            simulatedCostMicroUsd: 0,
            modelCalls: 0,
          },
        };
      const request = RankingRequestSchema.parse(input);
      const response = await fetch("/api/recommendations/gemini", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-wisata-gemini-confirm": "one-free-tier-smoke",
        },
        body: JSON.stringify(request),
        signal: context.signal,
      });
      // Only controlled outcome metadata is accepted; raw provider error prose is discarded.
      return RankingOutcomeSchema.parse(await response.json());
    },
  };
}
