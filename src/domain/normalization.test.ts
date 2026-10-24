import { describe, expect, it } from "vitest";
import {
  initialDay,
  initialIntake,
} from "@/features/preferences/intake-preview";
import { normalizePreferences, calendarDates } from "./normalization";
import {
  DayInputSchema,
  NormalizedPreferencesSchema,
  type PreferenceInput,
} from "./contracts";

const TODAY = "2026-10-23";
function input(): PreferenceInput {
  const intake = initialIntake(TODAY);
  return {
    ...intake,
    cityId: "palembang",
    days: calendarDates(intake.startDate, intake.endDate).map((date) => ({
      ...initialDay(date, intake.party),
      inventoryConfirmed: true,
    })),
  } as PreferenceInput;
}

describe("preference normalization", () => {
  it("derives calendar dates, integer budget, pace caps and exact purchased meal portions", () => {
    const raw = input();
    raw.days[0].meals.breakfast.provided = 1;
    raw.days[0].meals.breakfast.prepaid = 1;
    raw.days[0].extraMeals = [
      {
        id: "extra-1",
        label: "Makan tambahan",
        portions: {
          necessary: 2,
          provided: 1,
          prepaid: 0,
          confirmedZero: false,
        },
      },
    ];
    const result = normalizePreferences(raw, { today: TODAY });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      budgetIdr: 1500000,
      stopCap: 4,
      dates: ["2026-10-30", "2026-10-31"],
    });
    expect(result.value.days[0]).toMatchObject({
      startMinute: 480,
      endMinute: 1080,
    });
    expect(result.value.days[0].meals.map((meal) => meal.purchased)).toEqual([
      0, 2, 2, 1,
    ]);
    expect(raw.days[0].extraMeals[0].portions).not.toHaveProperty("purchased");
  });
  it("retains incomplete meal confirmations for a truthful draft rather than inventing an inventory", () => {
    const raw = input();
    raw.days[0].inventoryConfirmed = false;
    raw.days[0].meals.breakfast = {
      necessary: 0,
      provided: 0,
      prepaid: 0,
      confirmedZero: false,
    };
    const result = normalizePreferences(raw, { today: TODAY });
    expect(result.ok && result.value.days[0].inventoryConfirmed).toBe(false);
    expect(result.ok && result.value.days[0].meals[0].confirmedZero).toBe(
      false,
    );
  });
  it.each([
    [
      "fractional party",
      (raw: PreferenceInput) => {
        raw.party = 2.5;
      },
    ],
    [
      "more than eight people",
      (raw: PreferenceInput) => {
        raw.party = 9;
      },
    ],
    [
      "overlapping exemptions",
      (raw: PreferenceInput) => {
        raw.days[0].meals.lunch.provided = 2;
        raw.days[0].meals.lunch.prepaid = 1;
      },
    ],
    [
      "occasion larger than party",
      (raw: PreferenceInput) => {
        raw.days[0].meals.lunch.necessary = 3;
      },
    ],
    [
      "fractional portions",
      (raw: PreferenceInput) => {
        raw.days[0].meals.lunch.necessary = 1.5;
      },
    ],
    [
      "unsafe currency",
      (raw: PreferenceInput) => {
        raw.budget = "9007199254740992";
      },
    ],
    [
      "zero budget",
      (raw: PreferenceInput) => {
        raw.budget = "0";
      },
    ],
    [
      "preset enlargement",
      (raw: PreferenceInput) => {
        raw.pace = "relaxed";
        raw.walkingLimit = 2001;
      },
    ],
    [
      "backwards window",
      (raw: PreferenceInput) => {
        raw.days[0].end = "07:00";
      },
    ],
    [
      "missing date",
      (raw: PreferenceInput) => {
        raw.days.pop();
      },
    ],
    [
      "duplicate date",
      (raw: PreferenceInput) => {
        raw.days[1].date = raw.days[0].date;
      },
    ],
    [
      "unselected mandatory category",
      (raw: PreferenceInput) => {
        raw.mandatoryInterests = ["craft-example"];
      },
    ],
    [
      "duplicate categories",
      (raw: PreferenceInput) => {
        raw.interests = ["history-example", "history-example"];
      },
    ],
  ])("rejects %s instead of silently relaxing", (_, change) => {
    const raw = input();
    change(raw);
    expect(normalizePreferences(raw, { today: TODAY }).ok).toBe(false);
  });
  it("does not accept a generic meal exclusion or unknown preference key", () => {
    const raw = input();
    expect(
      normalizePreferences(
        { ...raw, excludedMeals: ["dinner"] },
        { today: TODAY },
      ).ok,
    ).toBe(false);
    expect(
      normalizePreferences(
        { ...raw, foodPreference: "AI decides" },
        { today: TODAY },
      ).ok,
    ).toBe(false);
  });
  it("keeps an explicitly confirmed zero occasion and partial-day purchases without auto-exclusion", () => {
    const raw = input();
    raw.days[0].start = "15:00";
    raw.days[0].meals.breakfast = {
      necessary: 0,
      provided: 0,
      prepaid: 0,
      confirmedZero: true,
    };
    const result = normalizePreferences(raw, { today: TODAY });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.value.days[0].meals.find((meal) => meal.id === "lunch")?.purchased,
    ).toBe(2);
  });
  it("uses inclusive 7-day and destination-local 90-day boundaries", () => {
    const raw = input();
    raw.startDate = "2027-01-15";
    raw.endDate = "2027-01-21";
    raw.days = calendarDates(raw.startDate, raw.endDate).map((date) =>
      DayInputSchema.parse(initialDay(date, 2)),
    );
    expect(normalizePreferences(raw, { today: TODAY }).ok).toBe(true);
    raw.endDate = "2027-01-22";
    expect(normalizePreferences(raw, { today: TODAY }).ok).toBe(false);
    expect(calendarDates("2026-02-30", "2026-03-01")).toEqual([]);
  });
  it("runtime-validates normalized input rather than trusting TypeScript callers", () => {
    const result = normalizePreferences(input(), { today: TODAY });
    if (!result.ok) throw new Error("Expected a valid fixture.");
    expect(NormalizedPreferencesSchema.safeParse(result.value).success).toBe(
      true,
    );
    const mutations = [
      { ...result.value, stopCap: 5 },
      { ...result.value, walkingLimit: 4001 },
      {
        ...result.value,
        dates: [result.value.dates[0], result.value.dates[0]],
      },
      { ...result.value, budgetIdr: 1.5 },
      {
        ...result.value,
        days: [
          {
            ...result.value.days[0],
            meals: result.value.days[0].meals.slice(1),
          },
          result.value.days[1],
        ],
      },
      {
        ...result.value,
        days: [
          {
            ...result.value.days[0],
            meals: result.value.days[0].meals.map((meal, index) =>
              index === 0 ? { ...meal, purchased: meal.purchased + 1 } : meal,
            ),
          },
          result.value.days[1],
        ],
      },
    ];
    mutations.forEach((mutated) =>
      expect(NormalizedPreferencesSchema.safeParse(mutated).success).toBe(
        false,
      ),
    );
  });
});
