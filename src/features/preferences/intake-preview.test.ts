import { describe, expect, it } from "vitest";
import {
  cityToday,
  initialDay,
  initialIntake,
  PACE_OPTIONS,
  previewDates,
  purchasedPortions,
  validateDayForms,
  validatePaceForm,
  validateTripForm,
} from "./intake-preview";

describe("synthetic intake form guards (not planning validation)", () => {
  it("derives inclusive 1–7-day date choices without browser-timezone arithmetic", () => {
    expect(previewDates("2026-10-23", "2026-10-23")).toEqual(["2026-10-23"]);
    expect(previewDates("2026-10-23", "2026-10-29")).toHaveLength(7);
    expect(previewDates("2026-10-23", "2026-10-30")).toEqual([]);
    expect(previewDates("2026-10-23", "2026-10-22")).toEqual([]);
    expect(previewDates("2026-02-30", "2026-03-01")).toEqual([]);
    expect(cityToday(new Date("2026-10-23T18:00:00Z"))).toBe("2026-10-24");
  });

  it("rejects fractional participants, noninteger currency and dates outside the form horizon", () => {
    const form = initialIntake("2026-10-23");
    expect(validateTripForm(form, "2026-10-23")).toEqual([]);
    expect(validateTripForm({ ...form, party: 2.5 }, "2026-10-23")[0].id).toBe(
      "party",
    );
    expect(
      validateTripForm({ ...form, budget: "1000.50" }, "2026-10-23")[0].id,
    ).toBe("budget");
    expect(
      validateTripForm({ ...form, budget: "9007199254740993" }, "2026-10-23")[0]
        .id,
    ).toBe("budget");
    expect(
      validateTripForm(
        { ...form, startDate: "2026-10-22", endDate: "2026-10-23" },
        "2026-10-23",
      )[0].id,
    ).toBe("start-date");
    expect(
      validateTripForm(
        { ...form, startDate: "2027-01-22", endDate: "2027-01-22" },
        "2026-10-23",
      )[0].id,
    ).toBe("start-date");
  });

  it("retains approved pace ceilings while allowing a lower walking input", () => {
    expect(
      Object.values(PACE_OPTIONS).map((pace) => [pace.stops, pace.meters]),
    ).toEqual([
      [3, 2000],
      [4, 4000],
      [5, 8000],
    ]);
    const form = initialIntake("2026-10-23");
    expect(validatePaceForm({ ...form, walkingLimit: 1000 })).toEqual([]);
    expect(validatePaceForm({ ...form, walkingLimit: 4001 })[0].id).toBe(
      "walking-limit",
    );
    expect(validatePaceForm({ ...form, walkingLimit: 0 })[0].id).toBe(
      "walking-limit",
    );
  });

  it("requires complete confirmed meal inventory on every day including a partial/free day", () => {
    const first = {
      ...initialDay("2026-10-23", 2),
      start: "16:00",
      end: "18:00",
      coverage: "free" as const,
    };
    expect(purchasedPortions(first)).toBe(6);
    expect(
      validateDayForms([first], 2).some(
        (issue) => issue.id === "inventory-confirmed",
      ),
    ).toBe(true);
    expect(
      validateDayForms([{ ...first, inventoryConfirmed: true }], 2),
    ).toEqual([]);
    expect(
      validateDayForms(
        [{ ...first, inventoryConfirmed: true }, initialDay("2026-10-24", 2)],
        2,
      )[0].day,
    ).toBe("2026-10-24");
  });

  it("subtracts declared provided/prepaid totals and rejects a combined count above necessary portions", () => {
    const day = initialDay("2026-10-23", 2);
    day.inventoryConfirmed = true;
    day.meals.breakfast = {
      necessary: 2,
      provided: 1,
      prepaid: 1,
      confirmedZero: false,
    };
    expect(purchasedPortions(day)).toBe(4);
    expect(validateDayForms([day], 2)).toEqual([]);
    day.meals.breakfast.prepaid = 2;
    expect(validateDayForms([day], 2)[0].id).toBe("breakfast-necessary");
  });

  it("requires a separate confirmation for zero necessary portions rather than a generic budget exclusion", () => {
    const day = initialDay("2026-10-23", 2);
    day.inventoryConfirmed = true;
    day.meals.breakfast.necessary = 0;
    expect(validateDayForms([day], 2)[0].id).toBe("breakfast-zero");
    day.meals.breakfast.confirmedZero = true;
    expect(validateDayForms([day], 2)).toEqual([]);
  });

  it("includes additional necessary meal occasions in purchased totals and the same form guards", () => {
    const day = initialDay("2026-10-23", 2);
    day.inventoryConfirmed = true;
    day.extraMeals = [
      {
        id: "extra-1",
        label: "Makan tambahan 1",
        portions: {
          necessary: 2,
          provided: 0,
          prepaid: 1,
          confirmedZero: false,
        },
      },
    ];
    expect(purchasedPortions(day)).toBe(7);
    expect(validateDayForms([day], 2)).toEqual([]);
    day.extraMeals[0].portions.provided = 2;
    expect(validateDayForms([day], 2)[0].id).toBe("extra-1-necessary");
    day.extraMeals[0].portions = {
      necessary: 0,
      provided: 0,
      prepaid: 0,
      confirmedZero: false,
    };
    expect(validateDayForms([day], 2)[0].id).toBe("extra-1-zero");
  });

  it("rejects overnight or invalid daily windows without synthesizing a schedule", () => {
    const day = { ...initialDay("2026-10-23", 2), inventoryConfirmed: true };
    expect(
      validateDayForms([{ ...day, start: "18:00", end: "08:00" }], 2)[0].id,
    ).toBe("day-start");
    expect(
      validateDayForms([{ ...day, start: "25:00", end: "26:00" }], 2)[0].id,
    ).toBe("day-start");
  });

  it("keeps cost-only meals valid but requires an explicit service, same-day window and confirmation when scheduling is requested", () => {
    const day = { ...initialDay("2026-10-23", 2), inventoryConfirmed: true };
    expect(validateDayForms([day], 2)).toEqual([]);
    day.meals.lunch.scheduling = {
      mode: "scheduled",
      serviceId: "",
      window: { start: "", end: "" },
      windowConfirmed: false,
    };
    expect(validateDayForms([day], 2).map((issue) => issue.id)).toEqual([
      "lunch-meal-window-start",
      "lunch-meal-service",
      "lunch-meal-window-confirmed",
    ]);
    day.meals.lunch.scheduling = {
      mode: "scheduled",
      serviceId: "syn-meal-service-food-01",
      window: { start: "12:00", end: "13:00" },
      windowConfirmed: true,
    };
    expect(validateDayForms([day], 2)).toEqual([]);
    expect(purchasedPortions(day)).toBe(6);
    day.meals.lunch.scheduling.window.end = "11:00";
    expect(validateDayForms([day], 2)[0].id).toBe("lunch-meal-window-start");
  });
});
