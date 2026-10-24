import { describe, expect, it } from "vitest";
import { ADVERSARIAL_CASES } from "./adversarial-corpus";
import {
  HOSTILE_CATALOGUE_TEXT,
  TEST_AS_OF,
  instrumentedRepository,
  testCatalogue,
  testPreferences,
} from "./adversarial.fixtures";
import {
  buildRankingRequest,
  fallbackResponse,
  validateRecommendationOutput,
} from "./ranking";

function baseline() {
  const places = testCatalogue();
  const repository = instrumentedRepository({ places });
  const { request } = buildRankingRequest(
    testPreferences(),
    places,
    TEST_AS_OF,
    repository.isCurrent.bind(repository),
  );
  const valid = fallbackResponse(request);
  return { request, valid, places, repository };
}

describe("120-case synthetic adversarial structured-output corpus", () => {
  it("uses a valid complete response and 120 uniquely identified attacks across twelve failure categories", () => {
    const { request, valid } = baseline();
    expect(validateRecommendationOutput(valid, request).ok).toBe(true);
    expect(ADVERSARIAL_CASES).toHaveLength(120);
    expect(new Set(ADVERSARIAL_CASES.map((entry) => entry.id)).size).toBe(120);
    const categories = new Map<string, number>();
    ADVERSARIAL_CASES.forEach((entry) =>
      categories.set(entry.category, (categories.get(entry.category) ?? 0) + 1),
    );
    expect(categories.size).toBe(12);
    expect([...categories.values()]).toEqual(Array(12).fill(10));
    expect(request.candidates.length).toBeGreaterThanOrEqual(11);
    const rejections: Record<string, number> = {};
    for (const entry of ADVERSARIAL_CASES) {
      const result = validateRecommendationOutput(
        entry.attack(valid, request),
        request,
      );
      expect(result.ok).toBe(false);
      if (!result.ok)
        rejections[result.code] = (rejections[result.code] ?? 0) + 1;
    }
    console.info(
      "Synthetic adversarial evaluation",
      JSON.stringify({
        cases: ADVERSARIAL_CASES.length,
        failureCategories: Object.fromEntries(categories),
        observedRejectionCodes: rejections,
        liveProviderEvaluation: false,
      }),
    );
  });

  it.each(ADVERSARIAL_CASES)("rejects $id ($category)", (entry) => {
    const { request, valid } = baseline();
    const requestBefore = JSON.stringify(request);
    const validBefore = JSON.stringify(valid);
    const output = entry.attack(valid, request);
    const result = validateRecommendationOutput(output, request);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error(`Unexpected acceptance: ${entry.id}`);
    expect(result.code).toBeTruthy();
    expect(JSON.stringify(request)).toBe(requestBefore);
    expect(JSON.stringify(valid)).toBe(validBefore);
    const fallback = fallbackResponse(request);
    expect(validateRecommendationOutput(fallback, request).ok).toBe(true);
    expect(new Set(fallback.rankings.map((entry) => entry.placeId))).toEqual(
      new Set(request.candidates.map((candidate) => candidate.placeId)),
    );
  });
});

describe("untrusted catalogue text boundary", () => {
  it.each(HOSTILE_CATALOGUE_TEXT)(
    "does not put hostile fixture text into the structured ranking request: %s",
    (payload) => {
      const places = testCatalogue();
      places[0].name = payload;
      const repository = instrumentedRepository({ places });
      const { request } = buildRankingRequest(
        testPreferences(),
        places,
        TEST_AS_OF,
        repository.isCurrent.bind(repository),
      );
      expect(JSON.stringify(request)).not.toContain(payload);
      expect(
        request.candidates.map((candidate) => candidate.placeId),
      ).toContain(places[0].id);
      expect(
        request.candidates.every((candidate) => !("name" in candidate)),
      ).toBe(true);
      expect(
        validateRecommendationOutput(fallbackResponse(request), request).ok,
      ).toBe(true);
    },
  );
});
