import type {
  MealAllowance,
  MealService,
  NormalizedMeal,
  NormalizedDay,
  NormalizedPreferences,
} from "../contracts";
import { evaluateEvidence } from "../evidence";
import type { PlanIssue } from "./types";

/** Pin precisely the service fields that authorize this request, including suitability when required. */
export function requiredMealServiceEvidence(
  service: MealService,
  input: NormalizedPreferences,
) {
  const fields = [
    "location",
    "service",
    "portions",
    "charges",
    ...(input.dietaryRequirement !== "none" ? ["dietary"] : []),
    ...(input.accessibilityRequirement !== "none" ? ["accessibility"] : []),
  ] as (keyof MealService["evidence"])[];
  return fields.map((field) => ({ field, ref: service.evidence[field] }));
}

/** Reserve known upper meal/extra service amounts before optional visits spend them. */
export function futureMealUpperCost(
  days: readonly NormalizedDay[],
  allowance: MealAllowance,
  services: readonly MealService[],
): bigint {
  return days.reduce(
    (total, day) =>
      total +
      day.meals.reduce((sum, meal) => {
        const request = meal.scheduling;
        const service =
          request?.mode === "scheduled"
            ? services.find((entry) => entry.id === request.serviceId)
            : undefined;
        return (
          sum +
          BigInt(meal.purchased) * BigInt(allowance.price.upper) +
          BigInt(service?.additionalChargeIdr.upper ?? 0)
        );
      }, 0n),
    0n,
  );
}

/** Service authority is separate from venue food tags, admission and generic meal allowances. */
export function eligibleMealServices(
  meals: readonly NormalizedMeal[],
  services: readonly MealService[],
  input: NormalizedPreferences,
  date: string,
  asOf: string,
  isCurrent: (
    refs: MealService["evidence"][keyof MealService["evidence"]][],
  ) => boolean,
  issues: PlanIssue[],
): Map<string, MealService> {
  const valid = new Map<string, MealService>();
  const usedVenues = new Set<string>();
  for (const meal of meals) {
    const request = meal.scheduling;
    if (request?.mode !== "scheduled") continue;
    const add = (
      code: string,
      severity: "unknown" | "violation",
      message: string,
    ) =>
      issues.push({
        code,
        severity,
        date,
        message: `${meal.label}: ${message}`,
      });
    if (!meal.necessary) {
      add(
        "MEAL_SCHEDULE_ZERO",
        "violation",
        "Penjadwalan memerlukan setidaknya satu porsi yang dikonfirmasi.",
      );
      continue;
    }
    if (!request.windowConfirmed) {
      add(
        "MEAL_WINDOW_UNCONFIRMED",
        "unknown",
        "Jendela makan belum dikonfirmasi pelancong; jam makan tidak ditebak.",
      );
      continue;
    }
    const service = services.find(
      (candidate) => candidate.id === request.serviceId,
    );
    if (!service || service.cityId !== input.cityId) {
      add(
        "MEAL_SERVICE_UNKNOWN",
        "unknown",
        "Bukti layanan dan lokasi makan yang diminta belum tersedia.",
      );
      continue;
    }
    const bindings = requiredMealServiceEvidence(service, input);
    const refs = bindings.map(({ ref }) => ref);
    if (
      bindings.some(
        ({ field, ref }) =>
          ref.field !== field ||
          ref.sourceId !== `fixture-source:${service.id}`,
      ) ||
      refs.some((ref) => !evaluateEvidence(ref, date, asOf).usable) ||
      !isCurrent(refs)
    ) {
      add(
        "MEAL_SERVICE_EVIDENCE_UNKNOWN",
        "unknown",
        "Bukti layanan, porsi, lokasi atau kesesuaian sudah tidak berlaku; makan tidak dinyatakan terjadwal.",
      );
      continue;
    }
    if (
      meal.necessary > service.maxPortions ||
      (["purchased", "provided", "prepaid"] as const).some(
        (source) =>
          meal[source] > 0 && !service.supportedPortions.includes(source),
      )
    ) {
      add(
        "MEAL_SERVICE_PORTIONS",
        "violation",
        "Layanan tidak mendukung seluruh porsi atau sumber porsi yang diminta; pengecualian biaya tidak menghapus kebutuhan layanan.",
      );
      continue;
    }
    if (
      (input.dietaryRequirement !== "none" &&
        !service.dietary.includes(input.dietaryRequirement)) ||
      (input.accessibilityRequirement === "step-free" && !service.stepFree)
    ) {
      add(
        "MEAL_SERVICE_REQUIREMENT",
        "violation",
        "Layanan tidak memenuhi kebutuhan diet atau akses yang diwajibkan.",
      );
      continue;
    }
    const day = input.days.find((candidate) => candidate.date === date)!;
    if (
      !service.windows.some(
        (window) =>
          Math.min(window.endMinute, request.window.endMinute, day.endMinute) -
            Math.max(
              window.startMinute,
              request.window.startMinute,
              day.startMinute,
            ) >=
          service.durationMinutes,
      )
    ) {
      add(
        "MEAL_WINDOW_CONFLICT",
        "violation",
        "Durasi layanan tidak muat pada irisan jendela yang Anda pilih dan waktu tersedia. Jendela tidak diubah otomatis.",
      );
      continue;
    }
    if (usedVenues.has(service.placeId)) {
      add(
        "MEAL_SERVICE_REPEAT_CONFLICT",
        "violation",
        "Dua kesempatan makan meminta tempat yang sama. Pengulangan kunjungan belum diizinkan; pilih layanan berbeda atau ubah penjadwalan secara eksplisit.",
      );
      continue;
    }
    usedVenues.add(service.placeId);
    valid.set(meal.id, service);
  }
  return valid;
}
