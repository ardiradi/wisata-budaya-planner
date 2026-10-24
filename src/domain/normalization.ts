import {
  DateSchema,
  PreferenceInputSchema,
  PACE_LIMITS,
  NormalizedPreferencesSchema,
  type NormalizedPreferences,
} from "./contracts";

export function addCalendarDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}
export function calendarDates(start: string, end: string): string[] {
  if (
    !DateSchema.safeParse(start).success ||
    !DateSchema.safeParse(end).success
  )
    return [];
  const count =
    Math.round(
      (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
        86400000,
    ) + 1;
  if (count < 1 || count > 7) return [];
  return Array.from({ length: count }, (_, index) =>
    addCalendarDays(start, index),
  );
}
export function clockMinutes(clock: string): number {
  const [hours, minutes] = clock.split(":").map(Number);
  return hours * 60 + minutes;
}
export type NormalizationIssue = { path: string; message: string };
export type NormalizationResult =
  | { ok: true; value: NormalizedPreferences }
  | { ok: false; issues: NormalizationIssue[] };

/** A local synthetic boundary; no persistence, inferred portions or generic meal exclusions. */
export function normalizePreferences(
  raw: unknown,
  context: { today: string },
): NormalizationResult {
  const parsed = PreferenceInputSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  const input = parsed.data;
  const dates = calendarDates(input.startDate, input.endDate);
  const issues: NormalizationIssue[] = [];
  if (!DateSchema.safeParse(context.today).success)
    return {
      ok: false,
      issues: [
        {
          path: "today",
          message: "A valid city-local evaluation date is required.",
        },
      ],
    };
  if (!dates.length)
    issues.push({
      path: "endDate",
      message: "Travel must cover 1–7 inclusive calendar days.",
    });
  if (
    input.startDate < context.today ||
    input.endDate > addCalendarDays(context.today, 90)
  )
    issues.push({
      path: "startDate",
      message:
        "Travel dates must fall from today through 90 calendar days ahead in the destination timezone.",
    });
  if (
    input.days.length !== dates.length ||
    input.days.some((day, index) => day.date !== dates[index])
  )
    issues.push({
      path: "days",
      message:
        "Daily inputs must match every travel date exactly once in chronological order.",
    });
  if (issues.length) return { ok: false, issues };
  const { budget, days, ...rest } = input;
  const labels = {
    breakfast: "Sarapan",
    lunch: "Makan siang",
    dinner: "Makan malam",
  };
  return {
    ok: true,
    value: NormalizedPreferencesSchema.parse({
      ...rest,
      budgetIdr: Number(budget),
      dates,
      stopCap: PACE_LIMITS[input.pace].stops,
      days: days.map((day) => ({
        date: day.date,
        startMinute: clockMinutes(day.start),
        endMinute: clockMinutes(day.end),
        startAnchor: day.startAnchor,
        endAnchor: day.endAnchor,
        coverage: day.coverage,
        inventoryConfirmed: day.inventoryConfirmed,
        meals: [
          ...Object.entries(day.meals).map(([id, portions]) => ({
            id,
            label: labels[id as keyof typeof labels],
            ...portions,
          })),
          ...day.extraMeals.map((meal) => ({
            id: meal.id,
            label: meal.label,
            ...meal.portions,
          })),
        ].map((meal) => ({
          ...meal,
          purchased: meal.necessary - meal.provided - meal.prepaid,
          scheduling:
            meal.scheduling?.mode === "scheduled"
              ? {
                  ...meal.scheduling,
                  window: {
                    startMinute: clockMinutes(meal.scheduling.window.start),
                    endMinute: clockMinutes(meal.scheduling.window.end),
                  },
                }
              : { mode: "unscheduled" },
        })),
      })),
    }),
  };
}
