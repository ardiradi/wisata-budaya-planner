import { afterAll, describe, expect, inject, it } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import {
  buildRecommendationProfile,
  buildSyntheticScenario,
} from "@/application/planning/preview-planner";
import {
  getLocalRepository,
  SYNTHETIC_PLACES,
} from "@/infrastructure/synthetic/catalogue";
import { getSyntheticRouting } from "@/infrastructure/synthetic/routing";
import { getMockRankingProvider } from "@/infrastructure/synthetic/mock-ranking";
import type {
  CatalogueRepository,
  NormalizedPreferences,
  RoutingProvider,
  SyntheticPlace,
} from "@/domain/contracts";
import { addCalendarDays, normalizePreferences } from "@/domain/normalization";
import { planItinerary } from "@/domain/planner";
import {
  summarizeDayMeals,
  summarizeDayTiming,
} from "@/domain/planner/day-summary";
import type { PlanResult } from "@/domain/planner/types";

const today = "2026-10-23";
const evaluatedAt = "2026-10-23T00:00:00.000Z";
declare module "vitest" {
  export interface ProvidedContext {
    profileOutput: string;
  }
}
type Fixture = {
  id: string;
  input: () => NormalizedPreferences;
  repository?: () => CatalogueRepository;
  routing?: () => RoutingProvider;
  expected: PlanResult["status"];
  check: (result: PlanResult) => void;
};
function preferences(
  profile: "history" | "craft" | "architecture" = "history",
) {
  const scenario = buildRecommendationProfile(profile, today);
  const normalized = normalizePreferences(
    { ...scenario.input, cityId: "palembang", days: scenario.days },
    { today },
  );
  if (!normalized.ok) throw new Error("Invalid fixture");
  return normalized.value;
}
const cases: Fixture[] = [
  {
    id: "first-time-history",
    input: () => preferences(),
    expected: "validated",
    check(result) {
      expect(result.days[0].stops.map((stop) => stop.placeId)).toEqual([
        "syn-history-01",
        "syn-food-01",
      ]);
      expect(result.cost.totalUpperIdr).toBe(280500);
      expect(summarizeDayTiming(result.days[0]).unallocatedMinutes).toBe(442);
    },
  },
  {
    id: "craft-walking-relaxed",
    input: () => preferences("craft"),
    expected: "validated",
    check(result) {
      expect(result.days[0].stops[0].placeId).toBe("syn-craft-01");
      expect(result.days[0].walkingUpperMeters).toBe(1520);
      expect(result.cost.totalUpperIdr).toBe(242000);
    },
  },
  {
    id: "architecture-taxi-savory",
    input: () => preferences("architecture"),
    expected: "validated",
    check(result) {
      expect(result.days[0].stops.map((stop) => stop.placeId)).toEqual([
        "syn-architecture-01",
        "syn-food-02",
      ]);
      expect(result.cost.totalUpperIdr).toBe(302500);
      expect(summarizeDayTiming(result.days[0]).waitingMinutes).toBeGreaterThan(
        0,
      );
    },
  },
  {
    id: "low-budget-group-eight",
    input() {
      const input = preferences();
      input.party = 8;
      input.budgetIdr = 200000;
      input.days[0].meals.forEach((meal) => {
        meal.necessary = 8;
        meal.provided = meal.id === "breakfast" ? 8 : 0;
        meal.purchased = meal.necessary - meal.provided;
      });
      return input;
    },
    expected: "blocked",
    check(result) {
      expect(result.issues.map((issue) => issue.code)).toContain(
        "MEAL_BUDGET_FLOOR",
      );
      expect(summarizeDayMeals(result.days[0]).purchasedPortions).toBe(16);
      expect(result.input!.budgetIdr).toBe(200000);
    },
  },
  {
    id: "seven-day-distinct-venues",
    input() {
      const input = preferences();
      input.dates = Array.from({ length: 7 }, (_, i) =>
        addCalendarDays(input.startDate, i),
      );
      input.endDate = input.dates[6];
      const first = structuredClone(input.days[0]);
      input.days = input.dates.map((date) => ({
        ...structuredClone(first),
        date,
      }));
      input.budgetIdr = 5000000;
      return input;
    },
    expected: "validated",
    check(result) {
      expect(result.work.routeAttempts).toBe(21);
      expect(result.cost.totalUpperIdr).toBe(1963500);
      expect(
        new Set(
          result.days.flatMap((day) => day.stops.map((stop) => stop.placeId)),
        ).size,
      ).toBe(14);
      expect(
        result.days.every((day) => day.culturalCovered && day.culinaryCovered),
      ).toBe(true);
    },
  },
  {
    id: "missing-culture-hours",
    input: () => preferences(),
    repository() {
      const places = structuredClone(SYNTHETIC_PLACES) as SyntheticPlace[];
      places
        .filter((place) => place.kind === "culture")
        .forEach((place) => {
          place.evidence.hours.state = "unknown";
        });
      return getLocalRepository({ places });
    },
    expected: "draft",
    check(result) {
      expect(result.coverage.missingCategoryIds).toContain("history-example");
      expect(result.days[0].culturalCovered).toBe(false);
      expect(result.cost.totalUpperIdr).toBeNull();
      expect(summarizeDayMeals(result.days[0]).purchasedPortions).toBe(4);
    },
  },
  {
    id: "missing-transport-cost-evidence",
    input: () => preferences(),
    routing: () => ({
      id: "unknown-transport-price",
      async resolve() {
        return {
          status: "unknown",
          reason: "No active transport cost evidence",
          retryable: false,
        };
      },
    }),
    expected: "draft",
    check(result) {
      expect(result.cost.totalUpperIdr).toBeNull();
      expect(result.days[0].legs[0].costIdr).toBeNull();
      expect(summarizeDayTiming(result.days[0]).unallocatedMinutes).toBeNull();
    },
  },
  {
    id: "restrictive-walking-one-hundred-meters",
    input() {
      const input = preferences();
      input.walkingLimit = 100;
      return input;
    },
    expected: "blocked",
    check(result) {
      expect(result.input!.walkingLimit).toBe(100);
      expect(result.status).not.toBe("validated");
    },
  },
  {
    id: "partial-day-exact-meal-portions",
    input() {
      const scenario = buildSyntheticScenario("feasible", today);
      scenario.days[0].start = "13:00";
      scenario.days[0].meals.breakfast = {
        necessary: 0,
        provided: 0,
        prepaid: 0,
        confirmedZero: true,
      };
      scenario.days[0].meals.lunch = {
        necessary: 2,
        provided: 1,
        prepaid: 1,
        confirmedZero: false,
      };
      scenario.days[0].meals.dinner.prepaid = 1;
      scenario.days[0].extraMeals.push({
        id: "extra-1",
        label: "Tambahan sintetis",
        portions: {
          necessary: 2,
          provided: 1,
          prepaid: 0,
          confirmedZero: false,
        },
      });
      const normalized = normalizePreferences(
        { ...scenario.input, cityId: "palembang", days: scenario.days },
        { today },
      );
      if (!normalized.ok) throw new Error("Invalid partial fixture");
      return normalized.value;
    },
    expected: "validated",
    check(result) {
      expect(summarizeDayMeals(result.days[0])).toMatchObject({
        necessaryPortions: 6,
        providedPortions: 2,
        prepaidPortions: 2,
        purchasedPortions: 2,
        timingStatus: "unassigned",
      });
      expect(result.cost.totalUpperIdr).toBe(192500);
    },
  },
];
const reports: unknown[] = [];
const round = (value: number) => Math.round(value * 1000) / 1000;
describe("E1 finite local acceptance and timing diagnostic", () => {
  it.each(cases)("$id", async (fixture) => {
    const durations: number[] = [];
    let last: PlanResult | undefined;
    for (let sample = 0; sample < 11; sample++) {
      const input = fixture.input();
      const dependencies = {
        repository: fixture.repository?.() ?? getLocalRepository(),
        routing: fixture.routing?.() ?? getSyntheticRouting(),
        recommendationProvider: getMockRankingProvider(),
        evaluatedAt,
      };
      const started = performance.now();
      const result = await planItinerary(input, dependencies);
      durations.push(performance.now() - started);
      expect(result.status).toBe(fixture.expected);
      fixture.check(result);
      last = result;
    }
    const subsequent = durations.slice(1).sort((a, b) => a - b);
    reports.push({
      id: fixture.id,
      status: last!.status,
      firstMeasuredMs: round(durations[0]),
      subsequentMedianMs: round((subsequent[4] + subsequent[5]) / 2),
      subsequentP95Ms: round(subsequent[9]),
      rawElapsedMs: durations.map(round),
      routeAttempts: last!.work.routeAttempts,
      mockAttempts: last!.recommendation?.attempts,
      modelCalls: last!.work.modelCalls,
      totalUpperIdr: last!.cost.totalUpperIdr,
      issueCodes: [...new Set(last!.issues.map((issue) => issue.code))],
      days: last!.days.map((day) => ({
        date: day.date,
        stopIds: day.stops.map((stop) => stop.placeId),
        timing: summarizeDayTiming(day),
        meals: summarizeDayMeals(day),
      })),
    });
  });
});
afterAll(async () => {
  const output = inject("profileOutput");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(
    output,
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        node: process.version,
        method:
          "One Node Vitest worker; fixed synthetic evaluation date, mock AI and directed routing only. Fresh fixtures per invocation. Fixture construction, assertion overhead and process startup excluded from timings. Eleven runs per scenario; first measured invocation is not a cold-process sample; ten subsequent runs reported separately. No GC control, live provider, network, database, browser or production latency inference.",
        scenariosCompleted: reports.length,
        reports,
      },
      null,
      2,
    ),
    { flag: "wx" },
  );
  console.log(`E1 local profile written: ${output}`);
});
