import type { NormalizedPreferences, SyntheticPlace } from "../contracts";
import { evaluateEvidence } from "../evidence";

export function placeEligibility(
  place: SyntheticPlace,
  input: NormalizedPreferences,
  date: string,
  asOf: string,
): { eligible: boolean; unknown: boolean } {
  const fields: (keyof SyntheticPlace["evidence"])[] = [
    "identity",
    "location",
    "hours",
    "exceptions",
    "admission",
    "walking",
  ];
  if (place.kind === "culture") fields.push("categories");
  if (input.dietaryRequirement !== "none" && place.kind === "food")
    fields.push("dietary");
  if (input.accessibilityRequirement !== "none") fields.push("accessibility");
  if (
    fields.some(
      (field) => !evaluateEvidence(place.evidence[field], date, asOf).usable,
    )
  )
    return { eligible: false, unknown: true };
  if (place.cityId !== input.cityId) return { eligible: false, unknown: false };
  if (
    input.dietaryRequirement !== "none" &&
    place.kind === "food" &&
    !place.dietary.includes(input.dietaryRequirement)
  )
    return { eligible: false, unknown: false };
  if (input.accessibilityRequirement === "step-free" && !place.stepFree)
    return { eligible: false, unknown: false };
  const exception = place.exceptions.find((entry) => entry.date === date);
  if (exception?.closed) return { eligible: false, unknown: false };
  const windows = exception?.windows ?? place.windows;
  const day = input.days.find((entry) => entry.date === date)!;
  if (
    !windows.some(
      (window) =>
        Math.min(window.endMinute, day.endMinute) -
          Math.max(window.startMinute, day.startMinute) >=
        place.minutes,
    )
  )
    return { eligible: false, unknown: false };
  return { eligible: true, unknown: false };
}

/** Bounded sparse selection, not an exhaustive route optimizer. Routing can still reject this selection. */
export function selectDayPlaces(
  places: SyntheticPlace[],
  input: NormalizedPreferences,
  date: string,
  remaining: Set<string>,
  asOf: string,
  recommendation?: readonly { placeId: string }[],
  requiredServicePlaceIds: readonly string[] = [],
  options: {
    fillOptional?: boolean;
    reserveFutureCoverage?: boolean;
    serviceWindows?: ReadonlyMap<
      string,
      { startMinute: number; endMinute: number }
    >;
  } = {},
) {
  const day = input.days.find((entry) => entry.date === date)!;
  const eligible = places.filter(
    (place) => placeEligibility(place, input, date, asOf).eligible,
  );
  const chosen: SyntheticPlace[] = [];
  const uncovered = new Set(remaining);
  // Maximum new mandatory coverage, then soft interests, then lower upper admission/dwell and canonical ID.
  const ranked = eligible
    .filter((place) => place.kind === "culture")
    .sort((a, b) => {
      const count = (place: SyntheticPlace, categories: Set<string>) =>
        place.categoryIds.filter((id) => categories.has(id)).length;
      return (
        count(b, uncovered) - count(a, uncovered) ||
        (recommendation
          ? (recommendation.findIndex((row) => row.placeId === a.id) < 0
              ? 1000
              : recommendation.findIndex((row) => row.placeId === a.id)) -
            (recommendation.findIndex((row) => row.placeId === b.id) < 0
              ? 1000
              : recommendation.findIndex((row) => row.placeId === b.id))
          : 0) ||
        count(b, new Set(input.interests)) -
          count(a, new Set(input.interests)) ||
        a.price.upper - b.price.upper ||
        a.minutes - b.minutes ||
        a.id.localeCompare(b.id)
      );
    });
  const foodRequired = day.coverage === "both" || day.coverage === "food-only";
  const cultureRequired =
    day.coverage === "both" || day.coverage === "culture-only";
  const requiredFoods = eligible.filter((place) =>
    requiredServicePlaceIds.includes(place.id),
  );
  const cultureSlots = Math.max(
    0,
    input.stopCap - Math.max(requiredFoods.length, foodRequired ? 1 : 0),
  );
  for (const place of ranked) {
    if (chosen.length >= cultureSlots) break;
    if (
      (!chosen.length && cultureRequired) ||
      place.categoryIds.some((id) => uncovered.has(id))
    ) {
      chosen.push(place);
      place.categoryIds.forEach((id) => uncovered.delete(id));
    }
  }
  chosen.push(...requiredFoods.slice(0, input.stopCap));
  if (foodRequired && !chosen.some((place) => place.kind === "food")) {
    const foods = eligible
      .filter((place) => place.kind === "food")
      .sort(
        (a, b) =>
          (recommendation
            ? (recommendation.findIndex((row) => row.placeId === a.id) < 0
                ? 1000
                : recommendation.findIndex((row) => row.placeId === a.id)) -
              (recommendation.findIndex((row) => row.placeId === b.id) < 0
                ? 1000
                : recommendation.findIndex((row) => row.placeId === b.id))
            : 0) ||
          Number(b.foodTags.some((tag) => tag === input.foodPreference)) -
            Number(a.foodTags.some((tag) => tag === input.foodPreference)) ||
          a.price.upper - b.price.upper ||
          a.id.localeCompare(b.id),
      );
    if (foods[0]) chosen.push(foods[0]);
  }
  if (options.serviceWindows?.size) {
    const preferredStart = (place: SyntheticPlace) =>
      options.serviceWindows?.get(place.id)?.startMinute ??
      Math.max(
        day.startMinute,
        Math.min(
          ...(
            place.exceptions.find((entry) => entry.date === date)?.windows ??
            place.windows
          ).map((window) => window.startMinute),
        ),
      );
    // Only a deterministic ordering heuristic. Actual directed routes, buffers
    // and opening/service windows below remain authoritative for feasibility.
    chosen.sort(
      (a, b) =>
        preferredStart(a) - preferredStart(b) ||
        Number(options.serviceWindows!.has(b.id)) -
          Number(options.serviceWindows!.has(a.id)),
    );
  }
  let reserved = false;
  const requiredIds = new Set(chosen.map((place) => place.id));
  if (
    input.planningStyle === "pace" &&
    day.coverage !== "free" &&
    options.fillOptional !== false
  ) {
    const laterDays = input.days.slice(
      input.days.findIndex((entry) => entry.date === date) + 1,
    );
    const reserveCulture =
      options.reserveFutureCoverage === false
        ? 0
        : laterDays.filter(
            (entry) =>
              entry.coverage === "both" || entry.coverage === "culture-only",
          ).length;
    const remainingCulture = eligible.filter(
      (place) =>
        place.kind === "culture" &&
        !chosen.some((selected) => selected.id === place.id),
    );
    const extraLimit = Math.max(0, remainingCulture.length - reserveCulture);
    for (const place of ranked
      .filter((place) => !chosen.some((selected) => selected.id === place.id))
      .slice(0, extraLimit)) {
      if (chosen.length >= input.stopCap) break;
      chosen.push(place);
    }
    reserved =
      chosen.length < input.stopCap &&
      reserveCulture > 0 &&
      remainingCulture.length > 0;
  }
  return {
    chosen,
    eligible,
    unknownExcluded: places.some(
      (place) => placeEligibility(place, input, date, asOf).unknown,
    ),
    reserved,
    optionalIds: new Set(
      chosen
        .filter((place) => !requiredIds.has(place.id))
        .map((place) => place.id),
    ),
  };
}
