import { MealServiceSchema, type MealService } from "@/domain/contracts";
import { fixtureEvidence } from "./evidence-fixture";

/** Invented local service records only; these are not meal bookings or Palembang facts. */
export const SYNTHETIC_MEAL_SERVICES: readonly MealService[] = Array.from(
  { length: 7 },
  (_, index) => {
    const ordinal = String(index + 1).padStart(2, "0");
    const id = `syn-meal-service-food-${ordinal}`;
    return MealServiceSchema.parse({
      id,
      cityId: "palembang",
      placeId: `syn-food-${ordinal}`,
      durationMinutes: 30,
      // Explicit fixture claim: service has no extra charge, including declared
      // provided/prepaid handling. Purchased food still uses the all-in allowance.
      additionalChargeIdr: { lower: 0, upper: 0 },
      maxPortions: 8,
      supportedPortions: ["purchased", "provided", "prepaid"],
      windows:
        index === 1
          ? [{ startMinute: 660, endMinute: 1020 }]
          : [{ startMinute: 480, endMinute: 1080 }],
      dietary: ["halal", "ingredients"],
      stepFree: true,
      evidence: Object.fromEntries(
        [
          "location",
          "service",
          "portions",
          "charges",
          "dietary",
          "accessibility",
        ].map((field) => [field, fixtureEvidence(id, field)]),
      ),
      synthetic: true,
      independentlyReviewed: false,
    });
  },
);
