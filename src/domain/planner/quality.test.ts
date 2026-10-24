import { describe, expect, it } from "vitest";
import { buildSyntheticScenario } from "@/application/planning/preview-planner";
import { getLocalRepository } from "@/infrastructure/synthetic/catalogue";
import { getSyntheticRouting } from "@/infrastructure/synthetic/routing";
import type { RoutingProvider } from "../contracts";
import { normalizePreferences } from "../normalization";
import { planItinerary } from ".";
import { summarizeCost } from "./cost";
import { summarizeDayMeals, summarizeDayTiming } from "./day-summary";
import { PlanResultSchema } from "./result-schema";
import type { PlanResult } from "./types";

const today = "2026-10-23";
const evaluatedAt = "2026-10-23T00:00:00.000Z";
function preferences() {
  const scenario = buildSyntheticScenario("feasible", today);
  const parsed = normalizePreferences(
    { ...scenario.input, cityId: "palembang", days: scenario.days },
    { today },
  );
  if (!parsed.ok) throw new Error("Invalid test preferences");
  return parsed.value;
}
function run(
  input = preferences(),
  routing: RoutingProvider = getSyntheticRouting(),
) {
  return planItinerary(input, {
    repository: getLocalRepository(),
    routing,
    evaluatedAt,
    now: () => 0,
  });
}

describe("E1 daily schedule transparency", () => {
  it("describes a short schedule without filling unused time or calling a culinary visit lunch", async () => {
    const result = await run();
    const frozenDay = result.days[0];
    const before = JSON.stringify(frozenDay);
    expect(summarizeDayTiming(frozenDay)).toEqual({
      status: "known",
      availableMinutes: 600,
      visitMinutes: 105,
      travelMinutes: 23,
      bufferMinutes: 30,
      waitingMinutes: 0,
      modelledMinutes: 158,
      returnArrivalMinute: 628,
      returnReadyMinute: 638,
      unallocatedMinutes: 442,
      overrunMinutes: 0,
    });
    expect(summarizeDayMeals(frozenDay)).toMatchObject({
      necessaryPortions: 6,
      providedPortions: 2,
      prepaidPortions: 0,
      purchasedPortions: 4,
      budgetStatus: "accounted",
      timingStatus: "unassigned",
    });
    expect(
      summarizeDayMeals(frozenDay).untimedOccasions.map((meal) => meal.id),
    ).toEqual(["breakfast", "lunch", "dinner"]);
    expect(JSON.stringify(frozenDay)).toBe(before);
    expect(result.cost.totalUpperIdr).toBe(280500);
  });

  it("separates opening-window waiting from route, visit and buffer time", async () => {
    const input = preferences();
    input.interests = ["history-example", "architecture-example"];
    input.mandatoryInterests = ["history-example", "architecture-example"];
    const result = await run(input);
    const day = result.days[0];
    const summary = summarizeDayTiming(day);
    expect(summary.status).toBe("known");
    expect(summary.waitingMinutes).toBeGreaterThan(0);
    expect(summary.modelledMinutes).toBe(
      summary.visitMinutes +
        summary.travelMinutes! +
        summary.bufferMinutes! +
        summary.waitingMinutes!,
    );
  });

  it("keeps unknown routes unknown instead of reporting free usable time", async () => {
    const routing: RoutingProvider = {
      id: "missing-return",
      async resolve(request) {
        if (request.toId === "anchor-a")
          return { status: "unknown", reason: "No route", retryable: false };
        return getSyntheticRouting().resolve(request);
      },
    };
    const result = await run(preferences(), routing);
    expect(result.status).toBe("draft");
    expect(summarizeDayTiming(result.days[0])).toMatchObject({
      status: "unknown",
      availableMinutes: 600,
      visitMinutes: 105,
      modelledMinutes: null,
      returnReadyMinute: null,
      unallocatedMinutes: null,
    });
  });

  it("describes an explicit free day and confirmed zero meals without inventing travel", async () => {
    const input = preferences();
    input.days[0].coverage = "free";
    input.mandatoryInterests = [];
    input.days[0].meals.forEach((meal) => {
      meal.necessary = 0;
      meal.provided = 0;
      meal.prepaid = 0;
      meal.purchased = 0;
      meal.confirmedZero = true;
    });
    const result = await run(input);
    expect(result.status).toBe("validated");
    expect(summarizeDayTiming(result.days[0])).toMatchObject({
      status: "known",
      modelledMinutes: 0,
      unallocatedMinutes: 600,
      returnReadyMinute: 480,
    });
    expect(summarizeDayMeals(result.days[0])).toMatchObject({
      necessaryPortions: 0,
      timingStatus: "not-needed",
      untimedOccasions: [],
    });
  });

  it("preserves exact partial-day meal accounting and reports unknown meal costs explicitly", async () => {
    const result = structuredClone(await run());
    const day = result.days[0];
    day.startMinute = 780;
    day.meals[0] = {
      ...day.meals[0],
      necessary: 0,
      provided: 0,
      purchased: 0,
    };
    day.meals[1] = {
      ...day.meals[1],
      necessary: 2,
      provided: 1,
      prepaid: 1,
      purchased: 0,
      lowerIdr: 0,
      upperIdr: 0,
    };
    day.meals[2].lowerIdr = null;
    day.meals[2].upperIdr = null;
    expect(summarizeDayMeals(day)).toMatchObject({
      necessaryPortions: 4,
      providedPortions: 1,
      prepaidPortions: 1,
      purchasedPortions: 2,
      budgetStatus: "unknown",
      timingStatus: "unassigned",
    });
    expect(summarizeDayMeals(day).untimedOccasions).toHaveLength(2);
  });
});

describe("E1 initial generation evidence and output guard", () => {
  it("withdraws the initial schedule when route evidence is revoked after resolution", async () => {
    const fixture = getSyntheticRouting();
    let revoked = false;
    const checkedRefs: string[][] = [];
    const routing: RoutingProvider = {
      id: "revoked-during-generation",
      async resolve(request) {
        const outcome = await fixture.resolve(request);
        if (request.toId === "anchor-a") revoked = true;
        return outcome;
      },
      isCurrent(refs) {
        checkedRefs.push(refs.map((ref) => ref.assertionId));
        return !revoked;
      },
    };
    const result = await run(preferences(), routing);
    expect(result.status).toBe("draft");
    expect(result.issues.map((issue) => issue.code)).toContain(
      "ROUTE_EVIDENCE_CHANGED",
    );
    expect(checkedRefs).toHaveLength(1);
    expect(checkedRefs[0]).toHaveLength(3);
    expect(result.days).toEqual([]);
    expect(result.evidenceRefs).toEqual([]);
    expect(result.cost.totalUpperIdr).toBeNull();
    expect(result.work.routeAttempts).toBe(3);
  });

  const mutations: [string, (result: PlanResult) => void][] = [
    [
      "omitted necessary meal line with recomputed totals",
      (result) => {
        result.cost.lines = result.cost.lines.filter(
          (line) => !line.id.endsWith("-dinner"),
        );
      },
    ],
    [
      "duplicate meal line with recomputed totals",
      (result) => {
        result.cost.lines.push(structuredClone(result.cost.lines[0]));
      },
    ],
    [
      "understated return travel line with recomputed totals",
      (result) => {
        const line = result.cost.lines.find(
          (line) => line.id === `route-${result.days[0].date}-3`,
        )!;
        line.lowerIdr = 0;
        line.upperIdr = 0;
      },
    ],
    [
      "per-person admission charged as one traveler",
      (result) => {
        const line = result.cost.lines.find((line) =>
          line.id.startsWith("visit-"),
        )!;
        line.quantity = 1;
      },
    ],
    [
      "changed route mode",
      (result) => {
        result.days[0].legs[0].mode = "walk";
      },
    ],
    [
      "untrue mandatory coverage projection",
      (result) => {
        result.coverage.fulfilledCategoryIds = [];
      },
    ],
  ];
  it.each(mutations)("rejects %s", async (_label, mutate) => {
    const result = structuredClone(await run());
    expect(PlanResultSchema.safeParse(result).success).toBe(true);
    mutate(result);
    result.cost = summarizeCost(result.cost.lines, result.input!.budgetIdr);
    expect(PlanResultSchema.safeParse(result).success).toBe(false);
  });
});
