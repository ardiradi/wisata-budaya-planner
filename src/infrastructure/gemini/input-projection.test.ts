import { describe, expect, it } from "vitest";
import {
  buildRecommendationProfile,
  buildSyntheticScenario,
} from "@/application/planning/preview-planner";
import { addCalendarDays, normalizePreferences } from "@/domain/normalization";
import {
  allowedReasons,
  buildRankingRequest,
  fallbackResponse,
  validateRecommendationOutput,
} from "@/domain/recommendations/ranking";
import { RankingRequestSchema } from "@/domain/recommendations/contracts";
import {
  HOSTILE_CATALOGUE_TEXT,
  TEST_AS_OF,
  TEST_TODAY,
} from "@/domain/recommendations/adversarial.fixtures";
import {
  getLocalRepository,
  SYNTHETIC_PLACES,
} from "@/infrastructure/synthetic/catalogue";
import {
  expandGeminiInputV2,
  projectGeminiInputV1,
  projectGeminiInputV2,
} from "./input-projection";
import { approvedRequest } from "./test-fixtures";

describe("versioned lossless Gemini input projection, entirely offline", () => {
  it.each(["history", "craft", "architecture"] as const)(
    "reconstructs every B3 ranking signal and identical fallback for %s",
    (profile) => {
      const submission = buildRecommendationProfile(profile, TEST_TODAY);
      const input = normalizePreferences(
        { ...submission.input, cityId: "palembang", days: submission.days },
        { today: TEST_TODAY },
      );
      if (!input.ok) throw new Error("Invalid synthetic preferences");
      const repository = getLocalRepository();
      const { request } = buildRankingRequest(
        input.value,
        SYNTHETIC_PLACES,
        TEST_AS_OF,
        repository.isCurrent.bind(repository),
      );
      const before = structuredClone(request);
      const expanded = expandGeminiInputV2(projectGeminiInputV2(request));
      expect(expanded).toEqual(projectGeminiInputV1(request));
      expect(expanded.preferences).toEqual(request.preferences);
      expect(expanded.snapshotId).toBe(request.snapshotId);
      expect(expanded.candidates.map((c) => c.placeId)).toEqual(
        request.candidates.map((c) => c.placeId),
      );
      const restored = RankingRequestSchema.parse({
        ...request,
        candidates: expanded.candidates.map(
          ({ allowedReasonCodes, ...candidate }) => {
            const original = request.candidates.find(
              (entry) => entry.placeId === candidate.placeId,
            )!;
            expect(allowedReasonCodes).toEqual(
              allowedReasons(original, request),
            );
            return {
              ...candidate,
              // Evidence authority is restored only from the original local set.
              assertionIds: original.assertionIds,
            };
          },
        ),
      });
      expect(restored).toEqual(request);
      const fallback = fallbackResponse(restored);
      expect(fallback).toEqual(fallbackResponse(request));
      expect(validateRecommendationOutput(fallback, request).ok).toBe(true);
      expect(request).toEqual(before);
    },
  );

  it("preserves all seven daily availability, anchor and necessary-meal records", () => {
    const submission = buildSyntheticScenario("feasible", TEST_TODAY);
    submission.input.endDate = addCalendarDays(submission.input.startDate, 6);
    submission.days = Array.from({ length: 7 }, (_, index) => ({
      ...structuredClone(submission.days[0]),
      date: addCalendarDays(submission.input.startDate, index),
    }));
    const normalized = normalizePreferences(
      { ...submission.input, cityId: "palembang", days: submission.days },
      { today: TEST_TODAY },
    );
    if (!normalized.ok) throw new Error("Invalid seven-day synthetic input");
    const repository = getLocalRepository();
    const { request } = buildRankingRequest(
      normalized.value,
      SYNTHETIC_PLACES,
      TEST_AS_OF,
      repository.isCurrent.bind(repository),
    );
    const expanded = expandGeminiInputV2(projectGeminiInputV2(request));
    expect(request.preferences.days).toHaveLength(7);
    expect(expanded.preferences).toEqual(request.preferences);
    expect(expanded).toEqual(projectGeminiInputV1(request));
  });

  it("preserves dietary, budget, walking and current-evidence hard filtering before projection", () => {
    const request = approvedRequest();
    const preferences = {
      ...request.preferences,
      walkingLimit: 500,
      budgetIdr: 10000,
      dietaryRequirement: "halal" as const,
    };
    const repository = getLocalRepository();
    const expected = buildRankingRequest(
      preferences,
      SYNTHETIC_PLACES,
      TEST_AS_OF,
      repository.isCurrent.bind(repository),
    ).request;
    const revoked = buildRankingRequest(
      preferences,
      SYNTHETIC_PLACES,
      TEST_AS_OF,
      () => false,
    ).request;
    expect(expandGeminiInputV2(projectGeminiInputV2(expected))).toEqual(
      projectGeminiInputV1(expected),
    );
    expect(expected.candidates.length).toBeLessThan(request.candidates.length);
    expect(revoked.candidates).toHaveLength(0);
    expect(
      expandGeminiInputV2(projectGeminiInputV2(revoked)).candidates,
    ).toEqual([]);
  });

  it("omits hostile catalogue prose and immutable assertion IDs without losing local authority", () => {
    const repository = getLocalRepository();
    const places = structuredClone(SYNTHETIC_PLACES);
    places.forEach((place, index) => {
      place.name =
        HOSTILE_CATALOGUE_TEXT[index % HOSTILE_CATALOGUE_TEXT.length];
    });
    const { request } = buildRankingRequest(
      approvedRequest().preferences,
      places,
      TEST_AS_OF,
      repository.isCurrent.bind(repository),
    );
    const encoded = JSON.stringify(projectGeminiInputV2(request));
    for (const hostile of HOSTILE_CATALOGUE_TEXT)
      expect(encoded).not.toContain(hostile);
    for (const candidate of request.candidates)
      for (const assertion of candidate.assertionIds)
        expect(encoded).not.toContain(assertion);
    expect(expandGeminiInputV2(JSON.parse(encoded))).toEqual(
      projectGeminiInputV1(request),
    );
  });

  it.each([
    "unknown-column",
    "extra-property",
    "wrong-version",
    "out-of-bounds",
    "duplicate-index",
    "duplicate-id",
    "duplicate-date",
    "negative-cost",
  ])(
    "rejects corrupted %s projection rather than recovering inferred values",
    (attack) => {
      const projected = projectGeminiInputV2(approvedRequest());
      if (attack === "unknown-column") projected.columns[0] = "facts" as never;
      if (attack === "extra-property")
        Object.assign(projected, { facts: "invented" });
      if (attack === "wrong-version")
        projected.schemaVersion = "unknown" as never;
      if (attack === "out-of-bounds")
        projected.rows[0][7] = [projected.dates.length];
      if (attack === "duplicate-index") projected.rows[0][8] = [0, 0];
      if (attack === "duplicate-id")
        projected.rows[1][0] = projected.rows[0][0];
      if (attack === "duplicate-date") projected.dates.push(projected.dates[0]);
      if (attack === "negative-cost") projected.rows[0][4] = -1;
      expect(() => expandGeminiInputV2(projected)).toThrow();
    },
  );
});
