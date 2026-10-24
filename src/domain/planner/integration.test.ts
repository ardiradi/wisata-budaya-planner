import { describe, expect, it } from "vitest";
import { buildSyntheticScenario } from "@/application/planning/preview-planner";
import {
  getLocalRepository,
  SYNTHETIC_MEAL_ALLOWANCE,
  SYNTHETIC_PLACES,
} from "@/infrastructure/synthetic/catalogue";
import { getSyntheticRouting } from "@/infrastructure/synthetic/routing";
import type {
  CatalogueRepository,
  NormalizedPreferences,
  RoutingProvider,
  SyntheticPlace,
} from "../contracts";
import { addCalendarDays, normalizePreferences } from "../normalization";
import { planItinerary } from ".";

const today = "2026-10-23";
const evaluatedAt = "2026-10-23T00:00:00.000Z";
function preferences(): NormalizedPreferences {
  const scenario = buildSyntheticScenario("feasible", today);
  const normalized = normalizePreferences(
    { ...scenario.input, cityId: "palembang", days: scenario.days },
    { today },
  );
  if (!normalized.ok) throw new Error(JSON.stringify(normalized.issues));
  return normalized.value;
}
function catalogue(): SyntheticPlace[] {
  return structuredClone(SYNTHETIC_PLACES) as SyntheticPlace[];
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
function issueCodes(result: Awaited<ReturnType<typeof run>>) {
  return result.issues.map((issue) => issue.code);
}

describe("confirmed necessary meals and complete costs", () => {
  it("costs exact uncovered portions on a partial day, including extra occasions", async () => {
    const input = preferences();
    input.days[0].startMinute = 780;
    input.days[0].meals = [
      {
        id: "breakfast",
        label: "Sarapan",
        necessary: 0,
        provided: 0,
        prepaid: 0,
        purchased: 0,
        confirmedZero: true,
      },
      {
        id: "lunch",
        label: "Makan siang",
        necessary: 2,
        provided: 1,
        prepaid: 1,
        purchased: 0,
        confirmedZero: false,
      },
      {
        id: "dinner",
        label: "Makan malam",
        necessary: 2,
        provided: 0,
        prepaid: 1,
        purchased: 1,
        confirmedZero: false,
      },
      {
        id: "extra-1",
        label: "Porsi tambahan sintetis",
        necessary: 2,
        provided: 1,
        prepaid: 0,
        purchased: 1,
        confirmedZero: false,
      },
    ];
    const result = await run(input);
    expect(result.status).toBe("validated");
    expect(
      result.days[0].meals.map((meal) => [
        meal.id,
        meal.purchased,
        meal.upperIdr,
      ]),
    ).toEqual([
      ["breakfast", 0, 0],
      ["lunch", 0, 0],
      ["dinner", 1, 40000],
      ["extra-1", 1, 40000],
    ]);
    expect(
      result.cost.lines
        .filter((line) => line.unit === "portion")
        .reduce((sum, line) => sum + line.upperIdr!, 0),
    ).toBe(80000);
    expect(
      result.cost.lines.find((line) => line.id.includes("syn-food-01"))
        ?.upperIdr,
    ).toBe(0);
  });

  it("keeps all necessary meal costs on an explicitly free day without inventing travel", async () => {
    const input = preferences();
    input.days[0].coverage = "free";
    input.mandatoryInterests = [];
    const result = await run(input);
    expect(result.status).toBe("validated");
    expect(result.days[0].stops).toEqual([]);
    expect(result.days[0].legs).toEqual([]);
    expect(
      result.days[0].meals.reduce((sum, meal) => sum + meal.purchased, 0),
    ).toBe(4);
    expect(result.cost.totalUpperIdr).toBe(176000);
  });

  it("accepts zero meals only when each zero and the inventory are explicit", async () => {
    const input = preferences();
    input.days[0].coverage = "free";
    input.mandatoryInterests = [];
    input.days[0].meals.forEach((meal) =>
      Object.assign(meal, {
        necessary: 0,
        provided: 0,
        prepaid: 0,
        purchased: 0,
        confirmedZero: true,
      }),
    );
    const result = await run(input);
    expect(result.status).toBe("validated");
    expect(result.cost.totalUpperIdr).toBe(0);
    input.days[0].meals[0].confirmedZero = false;
    const unconfirmed = await run(input);
    expect(unconfirmed.status).toBe("draft");
    expect(issueCodes(unconfirmed)).toContain("MEAL_INVENTORY_UNCONFIRMED");
  });

  it("retains an unconfirmed inventory as draft instead of treating suggested portions as confirmed", async () => {
    const input = preferences();
    input.days[0].inventoryConfirmed = false;
    const result = await run(input);
    expect(result.status).toBe("draft");
    expect(issueCodes(result)).toContain("MEAL_INVENTORY_UNCONFIRMED");
  });

  it("propagates unknown meal prices instead of zeroing a cost or returning a complete total", async () => {
    const allowance = structuredClone(SYNTHETIC_MEAL_ALLOWANCE);
    allowance.evidence.state = "unknown";
    const result = await run(preferences(), getLocalRepository({ allowance }));
    expect(result.status).toBe("draft");
    expect(
      result.days[0].meals.find((meal) => meal.purchased > 0)?.upperIdr,
    ).toBeNull();
    expect(result.cost.totalUpperIdr).toBeNull();
    expect(issueCodes(result)).toContain("MEAL_PRICE_UNKNOWN");
  });

  it("blocks a provably insufficient budget without removing meals or required visits", async () => {
    const input = preferences();
    input.budgetIdr = 10000;
    const result = await run(input);
    expect(result.status).toBe("blocked");
    expect(issueCodes(result)).toContain("BUDGET_EXCEEDED");
    expect(
      result.days[0].meals.reduce((sum, meal) => sum + meal.purchased, 0),
    ).toBe(4);
    expect(result.days[0].stops).toHaveLength(2);
  });
});

describe("daily and trip-wide coverage", () => {
  it("does not let an explicit daily opt-out waive a mandatory interest", async () => {
    const input = preferences();
    input.days[0].coverage = "free";
    const result = await run(input);
    expect(result.status).toBe("validated");
    expect(
      result.days[0].stops.some((stop) =>
        stop.categoryIds.includes("history-example"),
      ),
    ).toBe(true);
    expect(result.coverage.missingCategoryIds).toEqual([]);
  });

  it("allows one eligible scheduled visit to fulfill multiple fixture category assignments", async () => {
    const input = preferences();
    input.interests = [
      "history-example",
      "architecture-example",
      "craft-example",
    ];
    input.mandatoryInterests = [...input.interests];
    const result = await run(input);
    expect(result.status).toBe("validated");
    expect(result.coverage.fulfilledCategoryIds).toEqual(
      input.mandatoryInterests,
    );
    expect(result.days[0].stops.map((stop) => stop.placeId)).toContain(
      "syn-culture-02",
    );
    expect(result.days[0].stops).toHaveLength(3);
    expect(result.days[0].stops.some((stop) => stop.kind === "food")).toBe(
      true,
    );
  });

  it("does not count a retrieved but unscheduled category as fulfilled", async () => {
    const input = preferences();
    input.interests = ["history-example", "craft-example"];
    input.mandatoryInterests = ["craft-example"];
    const places = catalogue();
    places.find((place) => place.id === "syn-craft-01")!.exceptions = [
      { date: input.dates[0], closed: true, windows: [] },
    ];
    const result = await run(input, getLocalRepository({ places }));
    expect(result.status).toBe("blocked");
    expect(result.coverage.missingCategoryIds).toEqual(["craft-example"]);
    expect(
      result.days[0].stops.some((stop) => stop.placeId === "syn-craft-01"),
    ).toBe(false);
  });

  it("blocks known absence of required daily culinary coverage", async () => {
    const result = await run(
      preferences(),
      getLocalRepository({
        places: catalogue().filter((place) => place.kind === "culture"),
      }),
    );
    expect(result.status).toBe("blocked");
    expect(issueCodes(result)).toContain("DAILY_COVERAGE");
    expect(result.days[0].culinaryCovered).toBe(false);
    expect(result.cost.totalUpperIdr).toBeNull();
  });

  it("covers culture and food every required day and mandatory categories across seven days", async () => {
    const input = preferences();
    input.dates = Array.from({ length: 7 }, (_, index) =>
      addCalendarDays(input.startDate, index),
    );
    input.endDate = input.dates[6];
    const first = structuredClone(input.days[0]);
    input.days = input.dates.map((date) => ({
      ...structuredClone(first),
      date,
    }));
    input.budgetIdr = 5000000;
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
    expect(result.work.routeAttempts).toBe(21);
    expect(result.work.routeAttempts).toBeLessThanOrEqual(42);
    expect(result.cost.totalUpperIdr).toBe(1963500);
  });
});

describe("opening windows, durations, buffers and return anchors", () => {
  it("uses a date-specific replacement window rather than the ordinary opening time", async () => {
    const input = preferences();
    const places = catalogue();
    places.find((place) => place.id === "syn-history-01")!.exceptions = [
      {
        date: input.dates[0],
        closed: false,
        windows: [{ startMinute: 720, endMinute: 840 }],
      },
    ];
    const result = await run(input, getLocalRepository({ places }));
    expect(result.status).toBe("validated");
    expect(result.days[0].stops[0]).toMatchObject({
      startMinute: 720,
      endMinute: 780,
      durationMinutes: 60,
      openingWindow: { startMinute: 720, endMinute: 840 },
    });
  });

  it("never squeezes a visit into a window that only fits before route and buffer time", async () => {
    const input = preferences();
    const places = catalogue().filter(
      (place) => place.id === "syn-history-01" || place.kind === "food",
    );
    places[0].windows = [{ startMinute: 480, endMinute: 545 }];
    const result = await run(input, getLocalRepository({ places }));
    expect(result.status).toBe("draft");
    expect(issueCodes(result)).toContain("SEARCH_SELECTION_NO_FIT");
    expect(
      result.days[0].stops.some((stop) => stop.placeId === "syn-history-01"),
    ).toBe(false);
    expect(result.coverage.missingCategoryIds).toEqual(["history-example"]);
  });

  it("checks the required return leg and final buffer instead of accepting visits alone", async () => {
    const input = preferences();
    input.days[0].endMinute = 630;
    const result = await run(input);
    expect(result.status).toBe("blocked");
    expect(issueCodes(result)).toContain("RETURN_WINDOW");
    expect(result.days[0].legs.at(-1)?.toId).toBe(input.days[0].endAnchor);
    expect(result.days[0].stops.map((stop) => stop.durationMinutes)).toEqual([
      60, 45,
    ]);
  });

  it("keeps a missing return arrival, walking sum and complete cost unknown", async () => {
    const fixture = getSyntheticRouting();
    const routing: RoutingProvider = {
      id: "missing-return",
      async resolve(request) {
        return request.toId.startsWith("anchor-")
          ? {
              status: "unknown",
              reason: "Synthetic missing return",
              retryable: false,
            }
          : fixture.resolve(request);
      },
    };
    const result = await run(preferences(), getLocalRepository(), routing);
    expect(result.status).toBe("draft");
    expect(result.days[0].legs.at(-1)).toMatchObject({
      status: "unknown",
      arrivalMinute: null,
      costIdr: null,
    });
    expect(result.days[0].walkingUpperMeters).toBeNull();
    expect(result.cost.totalUpperIdr).toBeNull();
  });
});

describe("source authority and runtime provider boundaries", () => {
  it.each(["stale", "conflicted", "revoked"] as const)(
    "does not schedule a mandatory place whose authoritative identity is %s",
    async (state) => {
      const input = preferences();
      const places = catalogue().filter(
        (place) => place.id === "syn-history-01" || place.kind === "food",
      );
      places[0].evidence.identity.state = state;
      const result = await run(input, getLocalRepository({ places }));
      expect(result.status).toBe("draft");
      expect(
        result.days[0].stops.some((stop) => stop.placeId === "syn-history-01"),
      ).toBe(false);
      expect(result.coverage.missingCategoryIds).toEqual(["history-example"]);
    },
  );

  it("rechecks catalogue field heads before promoting a complete result", async () => {
    const repository = getLocalRepository();
    repository.isCurrent = () => false;
    const result = await run(preferences(), repository);
    expect(result.status).toBe("draft");
    expect(issueCodes(result)).toContain("EVIDENCE_HEAD_CHANGED");
    expect(result.days).toEqual([]);
    expect(result.evidenceRefs).toEqual([]);
    expect(result.cost.totalUpperIdr).toBeNull();
    expect(result.cost.lines).toEqual([]);
    expect(result.coverage.fulfilledCategoryIds).toEqual([]);
  });

  it.each([
    "fromId",
    "toId",
    "mode",
    "date",
    "departureMinute",
    "party",
  ] as const)(
    "rejects a route fixture with the wrong %s binding",
    async (field) => {
      const fixture = getSyntheticRouting();
      const routing: RoutingProvider = {
        id: "bad-binding",
        async resolve(request) {
          const result = await fixture.resolve(request);
          if (result.status !== "ok") return result;
          const replacement = {
            fromId: "anchor-b",
            toId: "anchor-b",
            mode: "taxi",
            date: "2026-10-25",
            departureMinute: 481,
            party: 3,
          };
          return {
            ...result,
            data: {
              ...result.data,
              binding: { ...result.data.binding, [field]: replacement[field] },
            },
          };
        },
      };
      const result = await run(preferences(), getLocalRepository(), routing);
      expect(result.status).toBe("draft");
      expect(issueCodes(result)).toContain("ROUTE_BINDING_OR_EVIDENCE");
      expect(result.days[0].stops).toEqual([]);
    },
  );

  it("rejects a malformed routing response rather than trusting TypeScript alone", async () => {
    const routing = {
      id: "malformed",
      async resolve() {
        return { status: "ok", data: { durationMinutes: -1 } };
      },
    } as unknown as RoutingProvider;
    const result = await run(preferences(), getLocalRepository(), routing);
    expect(result.status).toBe("draft");
    expect(issueCodes(result)).toContain("ROUTE_INVALID");
    expect(result.cost.totalUpperIdr).toBeNull();
  });
});

describe("hard dietary/accessibility requirements and all walking components", () => {
  it("cannot use food tags as proof of halal status", async () => {
    const input = preferences();
    input.dietaryRequirement = "halal";
    const places = catalogue();
    places
      .filter((place) => place.kind === "food")
      .forEach((place) => {
        place.dietary = [];
      });
    const result = await run(input, getLocalRepository({ places }));
    expect(result.status).toBe("blocked");
    expect(result.days[0].culinaryCovered).toBe(false);
  });

  it("does not claim dietary compliance for unscheduled purchased meal portions without active evidence", async () => {
    const input = preferences();
    input.dietaryRequirement = "halal";
    const allowance = structuredClone(SYNTHETIC_MEAL_ALLOWANCE);
    allowance.dietaryEvidence.state = "unknown";
    const result = await run(input, getLocalRepository({ allowance }));
    expect(result.status).toBe("draft");
    expect(issueCodes(result)).toContain("MEAL_REQUIREMENT_UNSUPPORTED");
  });

  it("filters known incompatible accessibility without substituting distance for suitability", async () => {
    const input = preferences();
    input.accessibilityRequirement = "step-free";
    const places = catalogue();
    places.forEach((place) => {
      place.stepFree = false;
    });
    const result = await run(input, getLocalRepository({ places }));
    expect(result.status).toBe("blocked");
    expect(result.days[0].stops).toEqual([]);
  });

  it("adds route access walking, venue interiors and venue access per person without party multiplication", async () => {
    const input = preferences();
    input.party = 8;
    const result = await run(input);
    expect(result.status).toBe("validated");
    expect(
      result.days[0].legs.reduce(
        (sum, leg) => sum + leg.walkingMeters!.upper,
        0,
      ),
    ).toBe(300);
    expect(
      result.days[0].stops.reduce(
        (sum, stop) => sum + stop.walkingMeters.upper,
        0,
      ),
    ).toBe(320);
    expect(result.days[0].walkingUpperMeters).toBe(620);
    expect(result.days[0].stops[0].admissionIdr.upper).toBe(200000);
    expect(result.days[0].legs[0].costIdr?.upper).toBe(30000);
  });

  it("refuses validation when all walking components exceed the chosen cap", async () => {
    const input = preferences();
    input.walkingLimit = 619;
    const result = await run(input);
    expect(result.status).toBe("blocked");
    expect(issueCodes(result)).toContain("WALKING_LIMIT");
    expect(result.input?.walkingLimit).toBe(619);
    expect(result.days[0].walkingUpperMeters).toBe(620);
  });

  it.each(["walk", "car", "taxi"] as const)(
    "preserves selected %s mode on outbound, inter-visit and return legs",
    async (mode) => {
      const input = preferences();
      input.transport = mode;
      const result = await run(input);
      expect(result.status).toBe("validated");
      expect(result.days[0].legs).toHaveLength(3);
      expect(result.days[0].legs.every((leg) => leg.mode === mode)).toBe(true);
      expect(result.days[0].legs[0].fromId).toBe(input.days[0].startAnchor);
      expect(result.days[0].legs.at(-1)?.toId).toBe(input.days[0].endAnchor);
    },
  );

  it("preserves a walking barrier as blocked rather than switching transport", async () => {
    const input = preferences();
    input.transport = "walk";
    input.days[0].startAnchor = "anchor-b";
    input.days[0].coverage = "food-only";
    input.mandatoryInterests = [];
    const places = catalogue().filter((place) => place.id === "syn-food-02");
    const result = await run(input, getLocalRepository({ places }));
    expect(result.status).toBe("blocked");
    expect(issueCodes(result)).toContain("ROUTE_UNREACHABLE");
    expect(result.input?.transport).toBe("walk");
    expect(result.days[0].legs[0].mode).toBe("walk");
  });
});
