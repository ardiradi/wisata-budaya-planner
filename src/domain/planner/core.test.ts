import { describe, expect, it, vi } from "vitest";
import { buildSyntheticScenario } from "@/application/planning/preview-planner";
import { normalizePreferences } from "../normalization";
import { addCalendarDays } from "../normalization";
import type { RouteRequest } from "../contracts";
import { getLocalRepository } from "@/infrastructure/synthetic/catalogue";
import { SYNTHETIC_PLACES } from "@/infrastructure/synthetic/catalogue";
import { getSyntheticRouting } from "@/infrastructure/synthetic/routing";
import { planItinerary } from ".";
import { charge, summarizeCost } from "./cost";
import { arrivalBuffer } from "./schedule";
import { WorkBudget, WorkLimitError } from "./work";
import type { CostLine } from "./types";
import { PlanResultSchema } from "./result-schema";

const asOf = "2026-10-23T00:00:00.000Z";
function preferences() {
  const scenario = buildSyntheticScenario("feasible", "2026-10-23");
  const normalized = normalizePreferences(
    { ...scenario.input, cityId: "palembang", days: scenario.days },
    { today: "2026-10-23" },
  );
  if (!normalized.ok) throw new Error(JSON.stringify(normalized.issues));
  return normalized.value;
}
describe("deterministic planner safety and operation budgets", () => {
  it("generates the actual sparse schedule, anchor return, complete group costs and immutable refs", async () => {
    const result = await planItinerary(preferences(), {
      repository: getLocalRepository(),
      routing: getSyntheticRouting(),
      evaluatedAt: asOf,
      now: () => 0,
    });
    expect(result.status).toBe("validated");
    expect(result.days[0].stops.map((stop) => stop.placeId)).toEqual([
      "syn-history-01",
      "syn-food-01",
    ]);
    expect(
      result.days[0].legs.map((leg) => [
        leg.departureMinute,
        leg.arrivalMinute,
      ]),
    ).toEqual([
      [480, 488],
      [558, 565],
      [620, 628],
    ]);
    expect(
      result.days[0].stops.map((stop) => [stop.startMinute, stop.endMinute]),
    ).toEqual([
      [498, 558],
      [575, 620],
    ]);
    expect(result.days[0].walkingUpperMeters).toBe(620);
    expect(result.cost).toMatchObject({
      lowerSubtotalIdr: 200000,
      upperSubtotalIdr: 255000,
      contingencyIdr: 25500,
      totalUpperIdr: 280500,
    });
    expect(result.work).toEqual({
      routeAttempts: 3,
      elapsedMs: 0,
      modelCalls: 0,
      matrixElements: 0,
      apiCostMicroUsd: 0,
    });
    expect(result.independentlyReviewed).toBe(false);
    expect(Object.isFrozen(result.days[0].stops[0].evidenceRefs[0])).toBe(true);
    expect(() => {
      result.days[0].stops[0].name = "changed";
    }).toThrow();
  });
  it("produces identical results from the same inputs and evaluation context", async () => {
    const run = () =>
      planItinerary(preferences(), {
        repository: getLocalRepository(),
        routing: getSyntheticRouting(),
        evaluatedAt: asOf,
        now: () => 0,
      });
    expect(await run()).toEqual(await run());
  });
  it("rejects accidental promotion after meal, walking, route, daily coverage or total tampering", async () => {
    const result = await planItinerary(preferences(), {
      repository: getLocalRepository(),
      routing: getSyntheticRouting(),
      evaluatedAt: asOf,
      now: () => 0,
    });
    const mutations = [
      (copy: typeof result) => {
        copy.days[0].meals.pop();
      },
      (copy: typeof result) => {
        copy.days[0].walkingUpperMeters = 1;
      },
      (copy: typeof result) => {
        copy.days[0].legs[1].departureMinute = 600;
        copy.days[0].legs[1].arrivalMinute = 607;
      },
      (copy: typeof result) => {
        copy.days[0].culinaryCovered = false;
      },
      (copy: typeof result) => {
        copy.cost.totalUpperIdr = 1;
      },
    ];
    for (const mutate of mutations) {
      const copy = structuredClone(result);
      mutate(copy);
      expect(PlanResultSchema.safeParse(copy).success).toBe(false);
    }
    const alteredInput = preferences();
    alteredInput.days[0].meals[1].purchased = 0;
    const rejected = await planItinerary(alteredInput, {
      repository: getLocalRepository(),
      routing: getSyntheticRouting(),
      evaluatedAt: asOf,
      now: () => 0,
    });
    expect(rejected.status).toBe("blocked");
    expect(rejected.work.routeAttempts).toBe(0);
  });
  it("keeps simultaneous operations independent", async () => {
    const outputs = await Promise.all(
      Array.from({ length: 12 }, () =>
        planItinerary(preferences(), {
          repository: getLocalRepository(),
          routing: getSyntheticRouting(),
          evaluatedAt: asOf,
          now: () => 0,
        }),
      ),
    );
    expect(
      outputs.every(
        (output) =>
          output.status === "validated" && output.work.routeAttempts === 3,
      ),
    ).toBe(true);
  });
  it("includes direct anchor-to-anchor travel on a free day when the anchors differ", async () => {
    const input = preferences();
    input.mandatoryInterests = [];
    input.days[0].coverage = "free";
    input.days[0].endAnchor = "anchor-b";
    const result = await planItinerary(input, {
      repository: getLocalRepository(),
      routing: getSyntheticRouting(),
      evaluatedAt: asOf,
      now: () => 0,
    });
    expect(result.status).toBe("validated");
    expect(result.days[0].stops).toHaveLength(0);
    expect(result.days[0].legs).toHaveLength(1);
    expect(result.days[0].legs[0]).toMatchObject({
      fromId: "anchor-a",
      toId: "anchor-b",
    });
    expect(result.days[0].walkingUpperMeters).toBe(100);
    expect(result.cost.totalUpperIdr).toBe(192500);
  });
  it("does not infer route or anchor step-free suitability from eligible venues and short walks", async () => {
    const input = preferences();
    input.accessibilityRequirement = "step-free";
    const result = await planItinerary(input, {
      repository: getLocalRepository(),
      routing: getSyntheticRouting(),
      evaluatedAt: asOf,
      now: () => 0,
    });
    expect(result.status).toBe("draft");
    expect(result.issues.map((issue) => issue.code)).toContain(
      "ROUTE_ACCESSIBILITY_UNKNOWN",
    );
    expect(result.input?.accessibilityRequirement).toBe("step-free");
    expect(result.days[0].stops).toHaveLength(2);
    const invalidPromotion = structuredClone(result);
    invalidPromotion.status = "validated";
    invalidPromotion.issues = [];
    expect(PlanResultSchema.safeParse(invalidPromotion).success).toBe(false);
  });
  it.each(["halal", "ingredients"] as const)(
    "does not treat provided/prepaid cost coverage as %s evidence",
    async (dietaryRequirement) => {
      const input = preferences();
      input.dietaryRequirement = dietaryRequirement;
      input.days[0].meals[0].provided = 1;
      input.days[0].meals[0].prepaid = 1;
      const result = await planItinerary(input, {
        repository: getLocalRepository(),
        routing: getSyntheticRouting(),
        evaluatedAt: asOf,
        now: () => 0,
      });
      expect(result.status).toBe("draft");
      expect(result.issues.map((issue) => issue.code)).toContain(
        "PROVIDED_MEAL_DIETARY_UNKNOWN",
      );
      expect(result.input?.dietaryRequirement).toBe(dietaryRequirement);
      expect(result.days[0].meals[0].purchased).toBe(0);
    },
  );
  it("accepts a hard dietary requirement in simulation when all purchased portions and food visits have specific fixture evidence", async () => {
    const input = preferences();
    input.dietaryRequirement = "halal";
    input.days[0].meals[0].provided = 0;
    input.days[0].meals[0].purchased = 2;
    const result = await planItinerary(input, {
      repository: getLocalRepository(),
      routing: getSyntheticRouting(),
      evaluatedAt: asOf,
      now: () => 0,
    });
    expect(result.status).toBe("validated");
    expect(
      result.days[0].meals.every((meal) =>
        meal.evidenceRefs.some((ref) => ref.field === "dietary"),
      ),
    ).toBe(true);
  });
  it("does not downgrade a known missing mandatory category because unrelated meal evidence is unknown", async () => {
    const input = preferences();
    input.dietaryRequirement = "halal";
    input.interests = ["history-example", "craft-example"];
    input.mandatoryInterests = ["craft-example"];
    const repository = getLocalRepository({
      places: SYNTHETIC_PLACES.filter((place) => place.id !== "syn-craft-01"),
    });
    const result = await planItinerary(input, {
      repository,
      routing: getSyntheticRouting(),
      evaluatedAt: asOf,
      now: () => 0,
    });
    expect(result.status).toBe("blocked");
    expect(
      result.issues.some(
        (issue) =>
          issue.code === "PROVIDED_MEAL_DIETARY_UNKNOWN" &&
          issue.severity === "unknown",
      ),
    ).toBe(true);
    expect(
      result.issues.some(
        (issue) =>
          issue.code === "MANDATORY_COVERAGE" && issue.severity === "violation",
      ),
    ).toBe(true);
  });
  it("counts failed retries, with one retry allowed per leg", async () => {
    const router = getSyntheticRouting({
      outcomes: {
        "car:anchor-a>syn-history-01": [
          {
            status: "error",
            retryable: true,
            reason: "Synthetic transient failure",
          },
        ],
      },
    });
    const result = await planItinerary(preferences(), {
      repository: getLocalRepository(),
      routing: router,
      evaluatedAt: asOf,
      now: () => 0,
    });
    expect(result.status).toBe("validated");
    expect(result.work.routeAttempts).toBe(4);
  });
  it("supports seven sparse days at exactly 42 attempts with one transient retry on every leg", async () => {
    const input = preferences();
    input.endDate = addCalendarDays(input.startDate, 6);
    input.dates = Array.from({ length: 7 }, (_, index) =>
      addCalendarDays(input.startDate, index),
    );
    input.days = input.dates.map((date) => ({
      ...structuredClone(input.days[0]),
      date,
    }));
    input.budgetIdr = 5000000;
    const router = getSyntheticRouting();
    const seen = new Set<string>();
    const routing = {
      id: "synthetic-first-attempt-error",
      async resolve(request: RouteRequest) {
        const key = JSON.stringify(request);
        if (!seen.has(key)) {
          seen.add(key);
          return {
            status: "error" as const,
            reason: "Synthetic transient",
            retryable: true,
          };
        }
        return router.resolve(request);
      },
    };
    const result = await planItinerary(input, {
      repository: getLocalRepository(),
      routing,
      evaluatedAt: asOf,
      now: () => 0,
    });
    expect(result.status).toBe("validated");
    expect(result.days).toHaveLength(7);
    expect(
      new Set(
        result.days.flatMap((day) => day.stops.map((stop) => stop.placeId)),
      ).size,
    ).toBe(14);
    expect(result.work.routeAttempts).toBe(42);
    expect(
      result.days.every(
        (day) => day.stops.length === 2 && day.legs.length === 3,
      ),
    ).toBe(true);
  });
  it("enforces 42 attempts including failures without a 43rd provider invocation", async () => {
    const work = new WorkBudget(() => 0);
    const provider = vi.fn(async () => "attempt");
    for (let n = 0; n < 42; n++) await work.route(provider);
    await expect(work.route(provider)).rejects.toThrow("ROUTE_LIMIT");
    expect(provider).toHaveBeenCalledTimes(42);
    expect(work.routeAttempts).toBe(42);
  });
  it("does not repeat a cultural venue when a small catalogue runs out", async () => {
    const input = preferences();
    input.endDate = addCalendarDays(input.startDate, 1);
    input.dates.push(input.endDate);
    input.days.push({ ...structuredClone(input.days[0]), date: input.endDate });
    const repository = getLocalRepository({
      places: SYNTHETIC_PLACES.filter(
        (place) => place.id === "syn-history-01" || place.id === "syn-food-01",
      ),
    });
    const result = await planItinerary(input, {
      repository,
      routing: getSyntheticRouting(),
      evaluatedAt: asOf,
      now: () => 0,
    });
    expect(result.status).toBe("blocked");
    expect(
      result.days
        .flatMap((day) => day.stops)
        .filter((stop) => stop.placeId === "syn-history-01"),
    ).toHaveLength(1);
    expect(
      result.issues.some(
        (issue) =>
          issue.code === "DAILY_COVERAGE" && issue.severity === "violation",
      ),
    ).toBe(true);
  });
  it("does not assume permission to repeat a food venue when repeat preferences are unresolved", async () => {
    const input = preferences();
    input.endDate = addCalendarDays(input.startDate, 1);
    input.dates.push(input.endDate);
    input.days.push({ ...structuredClone(input.days[0]), date: input.endDate });
    const repository = getLocalRepository({
      places: SYNTHETIC_PLACES.filter(
        (place) => place.kind === "culture" || place.id === "syn-food-01",
      ),
    });
    const result = await planItinerary(input, {
      repository,
      routing: getSyntheticRouting(),
      evaluatedAt: asOf,
      now: () => 0,
    });
    expect(result.status).toBe("draft");
    expect(result.issues.map((issue) => issue.code)).toContain(
      "FOOD_REPEAT_POLICY_UNRESOLVED",
    );
    expect(
      result.days
        .flatMap((day) => day.stops)
        .filter((stop) => stop.placeId === "syn-food-01"),
    ).toHaveLength(1);
  });
  it("enforces the full operation deadline before and after asynchronous work", async () => {
    let clock = 0;
    const work = new WorkBudget(() => clock);
    await expect(
      work.route(async () => {
        clock = 45000;
        return true;
      }),
    ).rejects.toThrow(WorkLimitError);
    const provider = vi.fn(async () => true);
    await expect(work.route(provider)).rejects.toThrow("DEADLINE");
    expect(provider).not.toHaveBeenCalled();
  });
  it("times out a non-settling local boundary instead of hanging", async () => {
    vi.useFakeTimers();
    try {
      const work = new WorkBudget(() => 0);
      const pending = expect(
        work.run(() => new Promise<never>(() => {})),
      ).rejects.toThrow("DEADLINE");
      await vi.advanceTimersByTimeAsync(45000);
      await pending;
    } finally {
      vi.useRealTimers();
    }
  });
  it("fails closed if the operation deadline passes during catalogue retrieval", async () => {
    let clock = 0;
    const repository = getLocalRepository();
    const list = repository.list;
    repository.list = async (cityId) => {
      const places = await list(cityId);
      clock = 45000;
      return places;
    };
    const result = await planItinerary(preferences(), {
      repository,
      routing: getSyntheticRouting(),
      evaluatedAt: asOf,
      now: () => clock,
    });
    expect(result.status).toBe("draft");
    expect(result.issues.some((issue) => issue.code === "DEADLINE")).toBe(true);
    expect(result.cost.totalUpperIdr).toBeNull();
  });
});
describe("integer currency and buffers", () => {
  it("rounds contingency up and propagates unknown costs", () => {
    const line: CostLine = {
      id: "one",
      label: "Synthetic",
      quantity: 1,
      unit: "group",
      lowerIdr: 11,
      upperIdr: 11,
      evidenceRefs: [],
    };
    expect(summarizeCost([line], 100).totalUpperIdr).toBe(13);
    expect(
      summarizeCost([{ ...line, upperIdr: null }], 100).totalUpperIdr,
    ).toBeNull();
    expect(() => charge(Number.MAX_SAFE_INTEGER, 8)).toThrow("IDR_OVERFLOW");
    expect(() =>
      summarizeCost(
        [
          {
            ...line,
            lowerIdr: Number.MAX_SAFE_INTEGER,
            upperIdr: Number.MAX_SAFE_INTEGER,
          },
        ],
        100,
      ),
    ).toThrow("IDR_OVERFLOW");
  });
  it("uses the upper route-duration bound for the approved buffer", () => {
    expect(arrivalBuffer(1)).toBe(10);
    expect(arrivalBuffer(41)).toBe(11);
    expect(arrivalBuffer(80)).toBe(20);
  });
});
