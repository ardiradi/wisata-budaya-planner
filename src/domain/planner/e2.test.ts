import { describe, expect, it } from "vitest";
import { buildSyntheticScenario } from "@/application/planning/preview-planner";
import {
  getLocalRepository,
  SYNTHETIC_PLACES,
} from "@/infrastructure/synthetic/catalogue";
import { SYNTHETIC_MEAL_SERVICES } from "@/infrastructure/synthetic/meal-services";
import { getSyntheticRouting } from "@/infrastructure/synthetic/routing";
import type {
  CatalogueRepository,
  MealService,
  NormalizedPreferences,
  RoutingProvider,
} from "../contracts";
import { addCalendarDays, normalizePreferences } from "../normalization";
import { planItinerary } from ".";
import { summarizeDayMeals, summarizeDayTiming } from "./day-summary";
import { PlanResultSchema } from "./result-schema";

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
function services() {
  return structuredClone(SYNTHETIC_MEAL_SERVICES) as MealService[];
}
function schedule(
  input: NormalizedPreferences,
  id = "lunch",
  serviceId = "syn-meal-service-food-01",
  startMinute = 720,
  endMinute = 780,
) {
  input.days[0].meals.find((meal) => meal.id === id)!.scheduling = {
    mode: "scheduled",
    serviceId,
    window: { startMinute, endMinute },
    windowConfirmed: true,
  };
  return input;
}
function run(
  input = preferences(),
  repository: CatalogueRepository = getLocalRepository(),
  routing: RoutingProvider = getSyntheticRouting(),
) {
  return planItinerary(input, {
    repository,
    routing,
    evaluatedAt,
    now: () => 0,
  });
}
const codes = (result: Awaited<ReturnType<typeof run>>) =>
  result.issues.map((issue) => issue.code);

describe("E2 explicit necessary meal scheduling", () => {
  it("schedules evidenced service within the requested visit without counting the same minutes twice", async () => {
    const result = await run(schedule(preferences()));
    expect(result.status).toBe("validated");
    expect(
      result.days[0].meals.find((meal) => meal.id === "lunch"),
    ).toMatchObject({
      schedulingStatus: "scheduled",
      necessary: 2,
      purchased: 2,
      startMinute: 720,
      endMinute: 750,
      durationMinutes: 30,
      placeId: "syn-food-01",
      serviceChargeIdr: { lower: 0, upper: 0 },
    });
    expect(result.days[0].stops[1]).toMatchObject({
      startMinute: 720,
      endMinute: 765,
    });
    expect(summarizeDayTiming(result.days[0])).toMatchObject({
      visitMinutes: 105,
      modelledMinutes: 303,
      unallocatedMinutes: 297,
    });
    expect(summarizeDayMeals(result.days[0])).toMatchObject({
      timingStatus: "partial",
      necessaryPortions: 6,
      scheduledPortions: 2,
    });
    expect(result.cost.totalUpperIdr).toBe(280500);
    expect(
      result.cost.lines.find(
        (line) =>
          line.id.endsWith("-lunch") && line.id.startsWith("meal-service-"),
      ),
    ).toMatchObject({ unit: "group", quantity: 1, upperIdr: 0 });
  });

  it("keeps the same food visit and every necessary portion costed but unassigned unless requested", async () => {
    const result = await run();
    expect(result.status).toBe("validated");
    expect(
      result.days[0].meals.every(
        (meal) =>
          meal.schedulingStatus === "unscheduled" && meal.startMinute === null,
      ),
    ).toBe(true);
    expect(summarizeDayMeals(result.days[0])).toMatchObject({
      timingStatus: "unassigned",
      scheduledPortions: 0,
      purchasedPortions: 4,
    });
    expect(result.cost.totalUpperIdr).toBe(280500);
  });
  it("orders explicit breakfast and lunch at distinct services around mandatory culture", async () => {
    const input = schedule(
      preferences(),
      "breakfast",
      "syn-meal-service-food-01",
      480,
      540,
    );
    schedule(input, "lunch", "syn-meal-service-food-02", 720, 780);
    const result = await run(input);
    expect(result.status).toBe("validated");
    expect(result.days[0].stops[0].placeId).toBe("syn-food-01");
    expect(result.days[0].meals[0].schedulingStatus).toBe("scheduled");
    expect(result.days[0].meals[0].endMinute).toBeLessThanOrEqual(540);
    expect(result.days[0].meals[1]).toMatchObject({
      schedulingStatus: "scheduled",
      placeId: "syn-food-02",
      startMinute: 720,
      endMinute: 750,
    });
    expect(new Set(result.days[0].stops.map((stop) => stop.placeId)).size).toBe(
      3,
    );
    expect(result.coverage.missingCategoryIds).toEqual([]);
  });

  it("blocks a known ten-minute meal window without deleting its portions", async () => {
    const result = await run(
      schedule(preferences(), "lunch", undefined, 720, 730),
    );
    expect(result.status).toBe("blocked");
    expect(codes(result)).toContain("MEAL_WINDOW_CONFLICT");
    expect(
      result.days[0].meals.find((meal) => meal.id === "lunch"),
    ).toMatchObject({
      necessary: 2,
      purchased: 2,
      schedulingStatus: "unresolved",
      startMinute: null,
    });
  });

  it("requires traveler confirmation and does not infer a breakfast clock", async () => {
    const input = schedule(preferences());
    const request = input.days[0].meals[1].scheduling;
    if (request?.mode === "scheduled") request.windowConfirmed = false;
    const result = await run(input);
    expect(result.status).toBe("draft");
    expect(codes(result)).toContain("MEAL_WINDOW_UNCONFIRMED");
    expect(result.days[0].meals[0].startMinute).toBeNull();
  });

  it("keeps a missing service draft with unknown additional charges, not a zero fee", async () => {
    const result = await run(
      schedule(preferences()),
      getLocalRepository({ mealServices: [] }),
    );
    expect(result.status).toBe("draft");
    expect(codes(result)).toContain("MEAL_SERVICE_UNKNOWN");
    expect(result.cost.totalUpperIdr).toBeNull();
    expect(summarizeDayMeals(result.days[0]).budgetStatus).toBe("unknown");
    expect(
      result.cost.lines.find((line) => line.id.startsWith("meal-service-"))
        ?.upperIdr,
    ).toBeNull();
  });
  it("blocks a requested service whose exact venue is known closed", async () => {
    const places = structuredClone(SYNTHETIC_PLACES);
    places
      .find((place) => place.id === "syn-food-01")!
      .exceptions.push({
        date: preferences().startDate,
        closed: true,
        windows: [],
      });
    const result = await run(
      schedule(preferences()),
      getLocalRepository({ places }),
    );
    expect(result.status).toBe("blocked");
    expect(
      result.issues.find(
        (issue) => issue.code === "MEAL_SERVICE_PLACE_UNAVAILABLE",
      )?.severity,
    ).toBe("violation");
  });

  it("does not let provided or prepaid declarations waive diet evidence", async () => {
    const input = schedule(preferences());
    input.dietaryRequirement = "halal";
    const serviceList = services();
    serviceList[0].evidence.dietary.state = "unknown";
    const result = await run(
      input,
      getLocalRepository({ mealServices: serviceList }),
    );
    expect(result.status).toBe("draft");
    expect(codes(result)).toContain("MEAL_SERVICE_EVIDENCE_UNKNOWN");
    expect(codes(result)).toContain("PROVIDED_MEAL_DIETARY_UNKNOWN");
  });

  it("uses explicit all-portion service suitability while preserving exact provided/prepaid purchase exemptions", async () => {
    const input = schedule(preferences());
    input.dietaryRequirement = "halal";
    const breakfast = input.days[0].meals[0];
    breakfast.provided = 0;
    breakfast.purchased = 2;
    const lunch = input.days[0].meals[1];
    lunch.provided = 1;
    lunch.prepaid = 1;
    lunch.purchased = 0;
    const result = await run(input);
    expect(result.status).toBe("validated");
    expect(result.days[0].meals[1]).toMatchObject({
      necessary: 2,
      provided: 1,
      prepaid: 1,
      purchased: 0,
      lowerIdr: 0,
      upperIdr: 0,
      schedulingStatus: "scheduled",
    });
    expect(
      result.days[0].meals[1].evidenceRefs.some(
        (ref) =>
          ref.field === "dietary" && ref.sourceId.includes("syn-meal-service"),
      ),
    ).toBe(true);
  });

  it("blocks known insufficient service portion capacity", async () => {
    const serviceList = services();
    serviceList[0].maxPortions = 1;
    const result = await run(
      schedule(preferences()),
      getLocalRepository({ mealServices: serviceList }),
    );
    expect(result.status).toBe("blocked");
    expect(codes(result)).toContain("MEAL_SERVICE_PORTIONS");
  });

  it("rejects service evidence borrowed from another service even when both heads are current", async () => {
    const serviceList = services();
    serviceList[0].evidence.service = serviceList[1].evidence.service;
    const result = await run(
      schedule(preferences()),
      getLocalRepository({ mealServices: serviceList }),
    );
    expect(result.status).toBe("draft");
    expect(codes(result)).toContain("MEAL_SERVICE_EVIDENCE_UNKNOWN");
  });

  it("keeps scheduled meals on an explicit free partial day, and routes their real fixture location", async () => {
    const input = schedule(preferences(), "dinner", undefined, 840, 900);
    input.days[0].coverage = "free";
    input.days[0].startMinute = 780;
    input.interests = [];
    input.mandatoryInterests = [];
    const result = await run(input);
    expect(result.status).toBe("validated");
    expect(result.days[0].stops.map((stop) => stop.placeId)).toEqual([
      "syn-food-01",
    ]);
    expect(result.days[0].legs.map((leg) => [leg.fromId, leg.toId])).toEqual([
      ["anchor-a", "syn-food-01"],
      ["syn-food-01", "anchor-a"],
    ]);
    expect(summarizeDayMeals(result.days[0]).necessaryPortions).toBe(6);
    expect(
      result.days[0].meals.find((meal) => meal.id === "dinner")
        ?.schedulingStatus,
    ).toBe("scheduled");
  });

  it("does not introduce food repetition to fulfill two meal occasions", async () => {
    const input = schedule(preferences());
    schedule(input, "dinner", undefined, 960, 1020);
    const result = await run(input);
    expect(result.status).toBe("blocked");
    expect(codes(result)).toContain("MEAL_SERVICE_REPEAT_CONFLICT");
    expect(
      result.days[0].stops.filter((stop) => stop.placeId === "syn-food-01"),
    ).toHaveLength(1);
    expect(summarizeDayMeals(result.days[0]).necessaryPortions).toBe(6);
  });

  it("withdraws generated service claims if service evidence changes during routing", async () => {
    const base = getLocalRepository();
    const routes = getSyntheticRouting();
    let revoked = false;
    const repository: CatalogueRepository = {
      ...base,
      isCurrent(refs) {
        return (
          base.isCurrent(refs) &&
          (!revoked ||
            !refs.some((ref) => ref.sourceId.includes("syn-meal-service")))
        );
      },
    };
    const routing: RoutingProvider = {
      id: "revoking-service-fixture",
      async resolve(request) {
        const result = await routes.resolve(request);
        revoked = true;
        return result;
      },
    };
    const result = await run(schedule(preferences()), repository, routing);
    expect(result.status).toBe("draft");
    expect(codes(result)).toContain("EVIDENCE_HEAD_CHANGED");
    expect(result.days).toEqual([]);
    expect(result.cost.totalUpperIdr).toBeNull();
  });

  it("guards against a forged scheduled meal time, missing fee row and unsupported service identity", async () => {
    const result = await run(schedule(preferences()));
    for (const mutate of [
      (value: typeof result) => {
        value.days[0].meals[1].startMinute = 600;
      },
      (value: typeof result) => {
        value.cost.lines = value.cost.lines.filter(
          (line) => !line.id.startsWith("meal-service-"),
        );
      },
      (value: typeof result) => {
        value.days[0].meals[1].serviceId = "syn-meal-service-invented";
      },
    ]) {
      const changed = structuredClone(result);
      mutate(changed);
      expect(PlanResultSchema.safeParse(changed).success).toBe(false);
    }
  });
});

describe("E2 bounded optional day utilization", () => {
  it("reproduces the documented synthetic comparison examples", async () => {
    const paced = preferences();
    paced.planningStyle = "pace";
    const free = schedule(preferences(), "dinner", undefined, 840, 900);
    free.days[0].coverage = "free";
    free.days[0].startMinute = 780;
    free.interests = [];
    free.mandatoryInterests = [];
    const examples = await Promise.all([
      run(),
      run(paced),
      run(schedule(preferences())),
      run(schedule(preferences(), "lunch", undefined, 720, 730)),
      run(free),
    ]);
    expect(examples.map((result) => result.status)).toEqual([
      "validated",
      "validated",
      "validated",
      "blocked",
      "validated",
    ]);
    if (process.env.E2_CAPTURE_EXAMPLES === "1")
      console.info(
        JSON.stringify(
          examples.map((result, index) => ({
            example: [
              "short-unscheduled",
              "balanced-pace",
              "scheduled-lunch",
              "window-conflict",
              "free-partial-scheduled",
            ][index],
            status: result.status,
            issues: codes(result),
            stops: result.days[0].stops.map((stop) => ({
              placeId: stop.placeId,
              start: stop.startMinute,
              end: stop.endMinute,
            })),
            meals: result.days[0].meals.map((meal) => ({
              id: meal.id,
              necessary: meal.necessary,
              purchased: meal.purchased,
              schedulingStatus: meal.schedulingStatus,
              start: meal.startMinute,
              end: meal.endMinute,
            })),
            timing: summarizeDayTiming(result.days[0]),
            cost: result.cost.totalUpperIdr,
            routes: result.work.routeAttempts,
          })),
          null,
          2,
        ),
      );
  });
  it("explicitly fills balanced pace within its cap while retaining unchanged short behavior", async () => {
    const short = await run();
    const input = preferences();
    input.planningStyle = "pace";
    const fuller = await run(input);
    expect(short.days[0].stops).toHaveLength(2);
    expect(fuller.status).toBe("validated");
    expect(fuller.days[0].stops).toHaveLength(4);
    expect(summarizeDayTiming(fuller.days[0]).modelledMinutes).toBeGreaterThan(
      summarizeDayTiming(short.days[0]).modelledMinutes!,
    );
    expect(fuller.days[0].utilization).toMatchObject({
      style: "balanced",
      searchIncomplete: true,
      reasonCodes: ["PACE_CAP"],
    });
    expect(fuller.work.routeAttempts).toBeGreaterThan(
      fuller.days[0].legs.length,
    );
    expect(fuller.work.routeAttempts).toBeLessThanOrEqual(42);
  });

  it("declines optional visits that cannot return in the available window without breaking the valid short agenda", async () => {
    const input = preferences();
    input.days[0].endMinute = 660;
    input.planningStyle = "pace";
    const result = await run(input);
    expect(result.status).toBe("validated");
    expect(result.days[0].stops).toHaveLength(2);
    expect(result.days[0].utilization?.reasonCodes).toContain(
      "OPTIONAL_CONSTRAINT",
    );
    expect(summarizeDayTiming(result.days[0]).overrunMinutes).toBe(0);
  });

  it("declines optional routes that would exceed walking while preserving every mandatory visit", async () => {
    const input = preferences();
    input.walkingLimit = 620;
    input.planningStyle = "pace";
    const result = await run(input);
    expect(result.status).toBe("validated");
    expect(result.days[0].walkingUpperMeters).toBe(620);
    expect(result.days[0].stops).toHaveLength(2);
    expect(result.coverage.missingCategoryIds).toEqual([]);
  });

  it("does not spend a tight meal-inclusive budget on optional extra visits", async () => {
    const input = preferences();
    input.budgetIdr = 280500;
    input.planningStyle = "pace";
    const result = await run(input);
    expect(result.status).toBe("validated");
    expect(result.cost.totalUpperIdr).toBe(280500);
    expect(result.days[0].stops).toHaveLength(2);
  });
  it("establishes the whole required seven-day cost before optional visits can spend its budget", async () => {
    const input = preferences();
    input.endDate = addCalendarDays(input.startDate, 6);
    input.dates = Array.from({ length: 7 }, (_, index) =>
      addCalendarDays(input.startDate, index),
    );
    input.days = input.dates.map((date) => ({
      ...structuredClone(input.days[0]),
      date,
    }));
    input.budgetIdr = 1963500;
    const baseline = await run(input);
    input.planningStyle = "pace";
    const result = await run(input);
    expect(baseline.status).toBe("validated");
    expect(result.status).toBe("validated");
    expect(result.cost.totalUpperIdr).toBe(baseline.cost.totalUpperIdr);
    expect(
      result.days.flatMap((day) => day.stops.map((stop) => stop.placeId)),
    ).toEqual(
      baseline.days.flatMap((day) => day.stops.map((stop) => stop.placeId)),
    );
    expect(result.work.routeAttempts).toBeGreaterThan(
      baseline.work.routeAttempts,
    );
    expect(result.work.routeAttempts).toBeLessThanOrEqual(42);
  });

  it.each(["relaxed", "balanced", "active"] as const)(
    "preserves seven-day distinct coverage and ceilings for %s optional density",
    async (pace) => {
      const input = preferences();
      input.planningStyle = "pace";
      input.pace = pace;
      input.stopCap = pace === "relaxed" ? 3 : pace === "balanced" ? 4 : 5;
      input.walkingLimit =
        pace === "relaxed" ? 2000 : pace === "balanced" ? 4000 : 8000;
      input.endDate = addCalendarDays(input.startDate, 6);
      input.dates = Array.from({ length: 7 }, (_, index) =>
        addCalendarDays(input.startDate, index),
      );
      input.days = input.dates.map((date) => ({
        ...structuredClone(input.days[0]),
        date,
      }));
      input.budgetIdr = 10000000;
      const result = await run(input);
      expect(result.status).toBe("validated");
      expect(result.days).toHaveLength(7);
      expect(
        result.days.every(
          (day) =>
            day.culturalCovered &&
            day.culinaryCovered &&
            day.stops.length <= input.stopCap,
        ),
      ).toBe(true);
      const ids = result.days.flatMap((day) =>
        day.stops.map((stop) => stop.placeId),
      );
      expect(new Set(ids).size).toBe(ids.length);
      expect(result.work.routeAttempts).toBeLessThanOrEqual(42);
      expect(result.coverage.missingCategoryIds).toEqual([]);
    },
  );

  it("keeps bounded retries within 42 attempts rather than resetting work when optional probes fail", async () => {
    const input = preferences();
    input.planningStyle = "pace";
    input.endDate = addCalendarDays(input.startDate, 6);
    input.dates = Array.from({ length: 7 }, (_, index) =>
      addCalendarDays(input.startDate, index),
    );
    input.days = input.dates.map((date) => ({
      ...structuredClone(input.days[0]),
      date,
    }));
    input.budgetIdr = 10000000;
    const base = getSyntheticRouting();
    let calls = 0;
    const routing: RoutingProvider = {
      id: "bounded-transient-fixture",
      async resolve(request) {
        calls++;
        return calls % 2
          ? { status: "error", reason: "Synthetic transient", retryable: true }
          : base.resolve(request);
      },
    };
    const result = await run(input, getLocalRepository(), routing);
    expect(calls).toBeLessThanOrEqual(42);
    expect(result.work.routeAttempts).toBe(calls);
    expect(result.days.flatMap((day) => day.stops).length).toBeGreaterThan(0);
  });
});
