import { describe, expect, it, vi } from "vitest";
import { createLocalEditingSession } from "@/application/editing/local-session";
import { buildRecommendationProfile } from "@/application/planning/preview-planner";
import { getSyntheticRouting } from "@/infrastructure/synthetic/routing";
import { getMockRankingProvider } from "@/infrastructure/synthetic/mock-ranking";
import type {
  CatalogueRepository,
  NormalizedPreferences,
  RouteRequest,
  RoutingProvider,
} from "../contracts";
import { addCalendarDays, normalizePreferences } from "../normalization";
import { planItinerary, type PlannerDependencies } from "../planner";
import { PlanResultSchema } from "../planner/result-schema";
import type { RecommendationProvider, RankingRequest } from "./contracts";
import {
  TEST_AS_OF,
  TEST_TODAY,
  instrumentedRepository,
  testCatalogue,
  testPreferences,
} from "./adversarial.fixtures";
import { fallbackResponse } from "./ranking";
import { simulatedTokens } from "./orchestrator";

function profileInput(profile: "history" | "craft" | "architecture") {
  const submission = buildRecommendationProfile(profile, TEST_TODAY);
  const parsed = normalizePreferences(
    { ...submission.input, cityId: "palembang", days: submission.days },
    { today: TEST_TODAY },
  );
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return parsed.value;
}
function deps(options: Partial<PlannerDependencies> = {}): PlannerDependencies {
  return {
    repository: instrumentedRepository(),
    routing: getSyntheticRouting(),
    evaluatedAt: TEST_AS_OF,
    now: () => 0,
    recommendationProvider: getMockRankingProvider(),
    ...options,
  };
}
function ok(request: RankingRequest) {
  const output = fallbackResponse(request);
  return {
    status: "ok",
    output,
    usage: {
      inputTokens: simulatedTokens(request),
      outputTokens: simulatedTokens(output),
      simulatedCostMicroUsd: 1000,
    },
  };
}

describe("mock ranking through the deterministic itinerary and B2 revision boundaries", () => {
  it.each([
    [
      "history",
      "syn-history-01",
      "syn-food-01",
      280500,
      620,
      [
        [498, 558],
        [575, 620],
      ],
    ],
    [
      "craft",
      "syn-craft-01",
      "syn-food-01",
      242000,
      1520,
      [
        [500, 560],
        [578, 623],
      ],
    ],
    [
      "architecture",
      "syn-architecture-01",
      "syn-food-02",
      302500,
      620,
      [
        [501, 561],
        [660, 705],
      ],
    ],
  ] as const)(
    "generates a constraint-checked synthetic %s preference profile",
    async (profile, cultureId, foodId, total, walking, slots) => {
      const input = profileInput(profile);
      const result = await planItinerary(input, deps());
      expect(result.status).toBe("validated");
      expect(result.recommendation?.source).toBe("mock_ai");
      expect(result.recommendation?.attempts).toBe(1);
      expect(result.days[0].stops.map((stop) => stop.placeId)).toEqual([
        cultureId,
        foodId,
      ]);
      expect(
        result.days[0].stops.map((stop) => [stop.startMinute, stop.endMinute]),
      ).toEqual(slots);
      expect(result.cost.totalUpperIdr).toBe(total);
      expect(result.days[0].walkingUpperMeters).toBe(walking);
      expect(result.coverage.missingCategoryIds).toEqual([]);
      expect(result.days[0].culturalCovered).toBe(true);
      expect(result.days[0].culinaryCovered).toBe(true);
      expect(result.days[0].walkingUpperMeters).toBeLessThanOrEqual(
        input.walkingLimit,
      );
      expect(result.cost.totalUpperIdr).toBeLessThanOrEqual(input.budgetIdr);
      expect(
        result.days[0].meals.reduce((sum, meal) => sum + meal.purchased, 0),
      ).toBe(4);
      expect(result.work.routeAttempts).toBe(3);
      expect(result.work.modelCalls).toBe(0);
      expect(result.work.apiCostMicroUsd).toBe(0);
      expect(PlanResultSchema.safeParse(result).success).toBe(true);
      const recommendation = result.recommendation!;
      console.info(
        "Synthetic recommendation example",
        JSON.stringify({
          profile,
          input: {
            interests: input.interests,
            mandatoryInterests: input.mandatoryInterests,
            transport: input.transport,
            pace: input.pace,
            walkingLimit: input.walkingLimit,
            party: input.party,
            budgetIdr: input.budgetIdr,
            foodPreference: input.foodPreference,
          },
          status: result.status,
          schedule: result.days[0].stops.map((stop) => ({
            placeId: stop.placeId,
            startMinute: stop.startMinute,
            endMinute: stop.endMinute,
          })),
          routes: result.days[0].legs.map((leg) => ({
            fromId: leg.fromId,
            toId: leg.toId,
            departureMinute: leg.departureMinute,
            arrivalMinute: leg.arrivalMinute,
          })),
          cost: {
            lowerSubtotalIdr: result.cost.lowerSubtotalIdr,
            upperSubtotalIdr: result.cost.upperSubtotalIdr,
            contingencyIdr: result.cost.contingencyIdr,
            totalUpperIdr: result.cost.totalUpperIdr,
          },
          walkingUpperMeters: result.days[0].walkingUpperMeters,
          recommendation: { ...recommendation, rankings: undefined },
          structuredOutputExcerpt: {
            schemaVersion: "ranking-response-v1",
            cityId: input.cityId,
            snapshotId: recommendation.snapshotId,
            rankings: recommendation.rankings.filter((entry) =>
              [cultureId, foodId].some((id) => id === entry.placeId),
            ),
          },
        }),
      );
    },
  );

  it("rejects an injected model ID and produces the same deterministic schedule and full costs", async () => {
    const input = testPreferences();
    const normal = await planItinerary(input, deps());
    const rejected = await planItinerary(
      input,
      deps({ recommendationProvider: getMockRankingProvider("invalid") }),
    );
    expect(rejected.recommendation?.source).toBe("deterministic_fallback");
    expect(rejected.recommendation?.attempts).toBe(2);
    expect(rejected.recommendation?.rejectionCodes).toContain("UNKNOWN_ID");
    expect(rejected.status).toBe("validated");
    expect(rejected.days).toEqual(normal.days);
    expect(rejected.cost).toEqual(normal.cost);
    expect(JSON.stringify(rejected)).not.toContain("unknown-injected-place");
  });

  it("does not let a reordered valid ranking override mandatory interest coverage", async () => {
    const provider: RecommendationProvider = {
      id: "adversarial-order-fixture",
      async rank(request) {
        const response = ok(request);
        response.output.rankings.sort(
          (a, b) =>
            Number(b.placeId === "syn-craft-01") -
            Number(a.placeId === "syn-craft-01"),
        );
        return response;
      },
    };
    const result = await planItinerary(
      testPreferences(),
      deps({ recommendationProvider: provider }),
    );
    expect(result.status).toBe("validated");
    expect(result.days[0].stops[0].categoryIds).toContain("history-example");
    expect(result.coverage.missingCategoryIds).toEqual([]);
  });

  it("keeps full necessary meals and hard budget checks when the recommendation pool cannot afford culture", async () => {
    const input = testPreferences();
    input.budgetIdr = 10000;
    const result = await planItinerary(input, deps());
    expect(result.status).toBe("blocked");
    expect(
      result.issues.some(
        (issue) =>
          issue.code === "BUDGET_EXCEEDED" ||
          issue.code === "BUDGET_KNOWN_FLOOR",
      ),
    ).toBe(true);
    expect(
      result.days[0].meals.reduce((sum, meal) => sum + meal.purchased, 0),
    ).toBe(4);
    expect(input.budgetIdr).toBe(10000);
  });

  it("cannot validate an itinerary chosen outside the current approved ranking pool", async () => {
    const places = testCatalogue();
    for (const place of places.filter((entry) => entry.kind === "culture"))
      place.evidence.dietary.state = "stale";
    const result = await planItinerary(
      testPreferences(),
      deps({ repository: instrumentedRepository({ places }) }),
    );
    const approved = new Set(
      result.recommendation?.rankings.map((entry) => entry.placeId),
    );
    if (result.status === "validated")
      expect(
        result.days.every((day) =>
          day.stops.every((stop) => approved.has(stop.placeId)),
        ),
      ).toBe(true);
    expect(result.status).not.toBe("validated");
  });

  it("withdraws recommendations, schedule and totals if an unused ranked candidate is revoked during routing", async () => {
    let current = true;
    const base = instrumentedRepository();
    const repository: CatalogueRepository = {
      ...base,
      isCurrent(refs) {
        return (
          base.isCurrent(refs) &&
          (current ||
            !refs.some((ref) => ref.fieldHeadId.startsWith("syn-craft-01:")))
        );
      },
    };
    const baseRouter = getSyntheticRouting();
    const routing: RoutingProvider = {
      id: "revoke-unused-during-route",
      async resolve(request) {
        current = false;
        return baseRouter.resolve(request);
      },
    };
    const result = await planItinerary(
      testPreferences(),
      deps({ repository, routing }),
    );
    expect(result.status).toBe("draft");
    expect(result.recommendation?.source).toBe("unavailable");
    expect(result.recommendation?.rankings).toEqual([]);
    expect(result.days).toEqual([]);
    expect(result.cost.totalUpperIdr).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain(
      "EVIDENCE_HEAD_CHANGED",
    );
  });

  it("uses one deadline across ranking and subsequent routing instead of resetting 45 seconds", async () => {
    let elapsed = 0;
    const provider: RecommendationProvider = {
      id: "near-deadline-ranker",
      async rank(request) {
        elapsed = 44999;
        return ok(request);
      },
    };
    const baseRouter = getSyntheticRouting();
    const resolve = vi.fn(async (request: RouteRequest) => {
      elapsed = 45000;
      return baseRouter.resolve(request);
    });
    const result = await planItinerary(
      testPreferences(),
      deps({
        recommendationProvider: provider,
        routing: { id: "deadline-route", resolve },
        now: () => elapsed,
      }),
    );
    expect(result.status).not.toBe("validated");
    expect(result.recommendation?.attempts).toBe(1);
    expect(result.work.elapsedMs).toBe(45000);
    expect(result.work.routeAttempts).toBe(1);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(
      result.issues.some(
        (issue) =>
          issue.code.includes("DEADLINE") || issue.message.includes("DEADLINE"),
      ),
    ).toBe(true);
  });

  it("fits two mock attempts and forty-two retry-inclusive directed route calls into one seven-day operation", async () => {
    const input: NormalizedPreferences = testPreferences();
    input.endDate = addCalendarDays(input.startDate, 6);
    input.dates = Array.from({ length: 7 }, (_, index) =>
      addCalendarDays(input.startDate, index),
    );
    input.days = input.dates.map((date) => ({
      ...structuredClone(input.days[0]),
      date,
    }));
    input.budgetIdr = 5000000;
    const baseRouter = getSyntheticRouting();
    const calls = new Map<string, number>();
    const resolve = vi.fn(async (request: RouteRequest) => {
      const key = JSON.stringify(request);
      const previous = calls.get(key) ?? 0;
      calls.set(key, previous + 1);
      if (!previous)
        return {
          status: "error" as const,
          reason: "Synthetic transient first attempt",
          retryable: true,
        };
      return baseRouter.resolve(request);
    });
    const result = await planItinerary(
      input,
      deps({
        recommendationProvider: getMockRankingProvider("repair"),
        routing: { id: "retry-every-leg", resolve },
      }),
    );
    expect(result.status).toBe("validated");
    expect(result.days).toHaveLength(7);
    expect(
      new Set(
        result.days.flatMap((day) => day.stops.map((stop) => stop.placeId)),
      ).size,
    ).toBe(14);
    expect(result.recommendation?.attempts).toBe(2);
    expect(result.work.routeAttempts).toBe(42);
    expect(resolve).toHaveBeenCalledTimes(42);
    expect(result.cost.totalUpperIdr).toBe(1963500);
  });

  it("does not let AI rank an explicit locked edit or mutate immutable B2 history", async () => {
    const provider = getMockRankingProvider();
    const rank = vi.fn(provider.rank.bind(provider));
    const dependencies = deps({
      recommendationProvider: { ...provider, rank },
    });
    const initial = await planItinerary(testPreferences(), dependencies);
    expect(initial.status).toBe("validated");
    expect(rank).toHaveBeenCalledTimes(1);
    const session = createLocalEditingSession(initial, dependencies);
    const original = session.getSnapshot().current;
    const originalBytes = JSON.stringify(original);
    const stop = original.result.days[0].stops[0];
    await session.previewEdit(original.id, {
      type: "lock",
      stopId: stop.id,
      locked: true,
    });
    const locking = session.getSnapshot().preview!;
    expect(locking.proposed.result.recommendation).toBeUndefined();
    await session.commit(locking.id);
    const locked = session.getSnapshot().current;
    expect(locked.intent.days[0].stops[0].lock).toMatchObject({
      placeId: stop.placeId,
      date: initial.input!.startDate,
      index: 0,
      startMinute: stop.startMinute,
      durationMinutes: stop.durationMinutes,
    });
    await session.previewEdit(locked.id, {
      type: "swap",
      stopId: stop.id,
      placeId: "syn-culture-02",
    });
    expect(session.getSnapshot().current).toBe(locked);
    expect(session.getSnapshot().preview).toBeNull();
    expect(session.getSnapshot().message?.kind).toBe("conflict");
    expect(rank).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot().history).toHaveLength(2);
    expect(JSON.stringify(session.getSnapshot().history[0])).toBe(
      originalBytes,
    );
    expect(Object.isFrozen(session.getSnapshot().history[0])).toBe(true);
    expect(session.getSnapshot().lastValidRevisionId).toBe(locked.id);
    session.dispose();
  });

  it("keeps earlier AI-assisted history available when an ordinary swap creates a deterministic revision and reverts", async () => {
    const dependencies = deps();
    const initial = await planItinerary(testPreferences(), dependencies);
    const session = createLocalEditingSession(initial, dependencies);
    const first = session.getSnapshot().current;
    await session.previewEdit(first.id, {
      type: "swap",
      stopId: first.result.days[0].stops[0].id,
      placeId: "syn-culture-02",
    });
    await session.commit(session.getSnapshot().preview!.id);
    const second = session.getSnapshot().current;
    expect(second.result.cost.totalUpperIdr).toBe(302500);
    expect(second.result.recommendation).toBeUndefined();
    expect(session.getSnapshot().history[0].result.recommendation?.source).toBe(
      "mock_ai",
    );
    await session.previewRevert(second.id, first.id);
    await session.commit(session.getSnapshot().preview!.id);
    const third = session.getSnapshot().current;
    expect(third.id).not.toBe(first.id);
    expect(third.result.cost.totalUpperIdr).toBe(280500);
    expect(session.getSnapshot().history).toHaveLength(3);
    expect(session.getSnapshot().history[0].id).toBe(first.id);
    expect(session.getSnapshot().history[1].id).toBe(second.id);
    expect(third.result.status).toBe("validated");
    session.dispose();
  });
});
