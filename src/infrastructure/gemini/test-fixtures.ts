import type { RankingRequest } from "@/domain/recommendations/contracts";
import {
  buildRankingRequest,
  fallbackResponse,
} from "@/domain/recommendations/ranking";
import {
  testPreferences,
  TEST_AS_OF,
} from "@/domain/recommendations/adversarial.fixtures";
import {
  getLocalRepository,
  SYNTHETIC_PLACES,
} from "@/infrastructure/synthetic/catalogue";
import type { GeminiResponse } from "./provider";

export function approvedRequest(): RankingRequest {
  const repository = getLocalRepository();
  return buildRankingRequest(
    testPreferences(),
    SYNTHETIC_PLACES,
    TEST_AS_OF,
    repository.isCurrent.bind(repository),
  ).request;
}
export function compactResponse(request: RankingRequest) {
  return {
    schemaVersion: "gemini-ranking-v1",
    snapshotId: request.snapshotId,
    rankings: fallbackResponse(request).rankings.map(
      ({ placeId, reasonCodes }) => ({
        placeId,
        reasonCodes: reasonCodes.slice(0, 2),
      }),
    ),
  };
}
export function sdkResponse(
  request = approvedRequest(),
  compact: unknown = compactResponse(request),
): GeminiResponse {
  return {
    text: JSON.stringify(compact),
    candidates: [{ finishReason: "STOP" as never }],
    usageMetadata: {
      promptTokenCount: 1500,
      candidatesTokenCount: 400,
      thoughtsTokenCount: 0,
      totalTokenCount: 1900,
    },
  };
}
