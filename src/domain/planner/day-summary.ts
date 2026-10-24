import { arrivalBuffer } from "./schedule";
import type { PlanDay, PlanMeal } from "./types";

export type DayTimingSummary = {
  status: "known" | "unknown";
  availableMinutes: number;
  visitMinutes: number;
  travelMinutes: number | null;
  bufferMinutes: number | null;
  waitingMinutes: number | null;
  modelledMinutes: number | null;
  returnArrivalMinute: number | null;
  returnReadyMinute: number | null;
  unallocatedMinutes: number | null;
  overrunMinutes: number | null;
};

/** Describes the represented schedule; it does not make a new feasibility decision. */
export function summarizeDayTiming(day: PlanDay): DayTimingSummary {
  const availableMinutes = day.endMinute - day.startMinute;
  const visitMinutes = day.stops.reduce(
    (sum, stop) => sum + stop.durationMinutes,
    0,
  );
  const unknown: DayTimingSummary = {
    status: "unknown",
    availableMinutes,
    visitMinutes,
    travelMinutes: null,
    bufferMinutes: null,
    waitingMinutes: null,
    modelledMinutes: null,
    returnArrivalMinute: null,
    returnReadyMinute: null,
    unallocatedMinutes: null,
    overrunMinutes: null,
  };
  if (!day.legs.length) {
    if (day.stops.length || day.startAnchor !== day.endAnchor) return unknown;
    return {
      ...unknown,
      status: "known",
      travelMinutes: 0,
      bufferMinutes: 0,
      waitingMinutes: 0,
      modelledMinutes: 0,
      returnArrivalMinute: day.startMinute,
      returnReadyMinute: day.startMinute,
      unallocatedMinutes: availableMinutes,
      overrunMinutes: 0,
    };
  }
  if (
    day.legs.length !== day.stops.length + 1 ||
    day.legs[0].fromId !== day.startAnchor ||
    day.legs[0].departureMinute !== day.startMinute ||
    day.legs.at(-1)!.toId !== day.endAnchor ||
    day.legs.some(
      (leg) =>
        leg.status !== "known" ||
        leg.arrivalMinute === null ||
        leg.durationMinutes === null,
    )
  )
    return unknown;

  let waitingMinutes = 0;
  for (const [index, stop] of day.stops.entries()) {
    const inbound = day.legs[index];
    const outbound = day.legs[index + 1];
    const ready =
      inbound.arrivalMinute! + arrivalBuffer(inbound.durationMinutes!.upper);
    if (
      inbound.toId !== stop.placeId ||
      outbound.fromId !== stop.placeId ||
      outbound.departureMinute !== stop.endMinute ||
      ready > stop.startMinute
    )
      return unknown;
    waitingMinutes += stop.startMinute - ready;
  }
  const travelMinutes = day.legs.reduce(
    (sum, leg) => sum + leg.durationMinutes!.upper,
    0,
  );
  const bufferMinutes = day.legs.reduce(
    (sum, leg) => sum + arrivalBuffer(leg.durationMinutes!.upper),
    0,
  );
  const last = day.legs.at(-1)!;
  const returnArrivalMinute = last.arrivalMinute!;
  const returnReadyMinute =
    returnArrivalMinute + arrivalBuffer(last.durationMinutes!.upper);
  const modelledMinutes = returnReadyMinute - day.startMinute;
  if (
    modelledMinutes !==
    visitMinutes + travelMinutes + bufferMinutes + waitingMinutes
  )
    return unknown;
  return {
    status: "known",
    availableMinutes,
    visitMinutes,
    travelMinutes,
    bufferMinutes,
    waitingMinutes,
    modelledMinutes,
    returnArrivalMinute,
    returnReadyMinute,
    unallocatedMinutes: Math.max(0, day.endMinute - returnReadyMinute),
    overrunMinutes: Math.max(0, returnReadyMinute - day.endMinute),
  };
}

export type DayMealSummary = {
  necessaryPortions: number;
  providedPortions: number;
  prepaidPortions: number;
  purchasedPortions: number;
  budgetStatus: "accounted" | "unknown";
  timingStatus:
    "not-needed" | "unassigned" | "partial" | "scheduled" | "unresolved";
  scheduledPortions: number;
  unresolvedPortions: number;
  untimedOccasions: PlanMeal[];
};

/** A cost allowance is not evidence of a meal appointment or a particular venue. */
export function summarizeDayMeals(day: PlanDay): DayMealSummary {
  const portions = (
    field: "necessary" | "provided" | "prepaid" | "purchased",
  ) => day.meals.reduce((sum, meal) => sum + meal[field], 0);
  const necessaryPortions = portions("necessary");
  return {
    necessaryPortions,
    providedPortions: portions("provided"),
    prepaidPortions: portions("prepaid"),
    purchasedPortions: portions("purchased"),
    budgetStatus: day.meals.some(
      (meal) =>
        meal.lowerIdr === null ||
        meal.upperIdr === null ||
        (meal.schedulingStatus !== undefined &&
          meal.schedulingStatus !== "unscheduled" &&
          meal.serviceChargeIdr == null),
    )
      ? "unknown"
      : "accounted",
    timingStatus: !necessaryPortions
      ? "not-needed"
      : day.meals.some(
            (meal) =>
              meal.necessary > 0 && meal.schedulingStatus === "unresolved",
          )
        ? "unresolved"
        : day.meals
              .filter((meal) => meal.necessary > 0)
              .every((meal) => meal.schedulingStatus === "scheduled")
          ? "scheduled"
          : day.meals.some((meal) => meal.schedulingStatus === "scheduled")
            ? "partial"
            : "unassigned",
    scheduledPortions: day.meals
      .filter((meal) => meal.schedulingStatus === "scheduled")
      .reduce((sum, meal) => sum + meal.necessary, 0),
    unresolvedPortions: day.meals
      .filter((meal) => meal.schedulingStatus === "unresolved")
      .reduce((sum, meal) => sum + meal.necessary, 0),
    untimedOccasions: day.meals.filter(
      (meal) => meal.necessary > 0 && meal.schedulingStatus !== "scheduled",
    ),
  };
}
