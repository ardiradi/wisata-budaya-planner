import { z } from "zod";

export const CATEGORY_IDS = [
  "history-example",
  "craft-example",
  "architecture-example",
] as const;
export const PACE_LIMITS = {
  relaxed: { meters: 2000, stops: 3 },
  balanced: { meters: 4000, stops: 4 },
  active: { meters: 8000, stops: 5 },
} as const;
export const OPERATING_LIMITS = {
  maxDays: 7,
  maxParty: 8,
  maxCandidates: 60,
  routeAttempts: 42,
  matrixElements: 800,
  matrixRequests: 2,
  aiAttempts: 2,
  deadlineMs: 45000,
  operationUsd: 1,
  projectDailyUsd: 10,
  projectMonthlyUsd: 100,
} as const;

export const IntegerSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
export const RangeSchema = z
  .strictObject({ lower: IntegerSchema, upper: IntegerSchema })
  .refine((range) => range.lower <= range.upper, {
    message: "The upper bound must not be less than the lower bound.",
  });
export type BoundedRange = z.infer<typeof RangeSchema>;
export const CategorySchema = z.enum(CATEGORY_IDS);
export type CategoryId = z.infer<typeof CategorySchema>;
export const TransportSchema = z.enum(["walk", "car", "taxi"]);
export type Transport = z.infer<typeof TransportSchema>;
export const AnchorSchema = z.enum(["anchor-a", "anchor-b"]);
export type AnchorId = z.infer<typeof AnchorSchema>;
export const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((date) => {
    const value = new Date(`${date}T00:00:00Z`);
    return (
      Number.isFinite(value.getTime()) &&
      value.toISOString().slice(0, 10) === date
    );
  }, "Use a real ISO calendar date.");
export const ClockSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const WindowSchema = z
  .strictObject({
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
  })
  .refine(
    (window) => window.startMinute < window.endMinute,
    "The window must have positive duration.",
  );

export const MealSchedulingInputSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("unscheduled") }),
  z.strictObject({
    mode: z.literal("scheduled"),
    serviceId: z
      .string()
      .regex(/^syn-meal-service-[a-z0-9-]+$/)
      .max(100),
    window: z
      .strictObject({ start: ClockSchema, end: ClockSchema })
      .refine(
        (window) => window.start < window.end,
        "The confirmed meal window must have positive duration.",
      ),
    windowConfirmed: z.boolean(),
  }),
]);
export const NormalizedMealSchedulingSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("unscheduled") }),
  z.strictObject({
    mode: z.literal("scheduled"),
    serviceId: z
      .string()
      .regex(/^syn-meal-service-[a-z0-9-]+$/)
      .max(100),
    window: WindowSchema,
    windowConfirmed: z.boolean(),
  }),
]);
export const MealPortionsSchema = z
  .strictObject({
    necessary: z.number().int().min(0).max(8),
    provided: z.number().int().min(0).max(8),
    prepaid: z.number().int().min(0).max(8),
    confirmedZero: z.boolean(),
    scheduling: MealSchedulingInputSchema.optional(),
  })
  .refine(
    (meal) => meal.provided + meal.prepaid <= meal.necessary,
    "Provided and prepaid portions must be disjoint and cannot exceed necessary portions.",
  );
export const DayInputSchema = z
  .strictObject({
    date: DateSchema,
    start: ClockSchema,
    end: ClockSchema,
    startAnchor: AnchorSchema,
    endAnchor: AnchorSchema,
    coverage: z.enum(["both", "free", "culture-only", "food-only"]),
    meals: z.strictObject({
      breakfast: MealPortionsSchema,
      lunch: MealPortionsSchema,
      dinner: MealPortionsSchema,
    }),
    extraMeals: z
      .array(
        z.strictObject({
          id: z
            .string()
            .regex(/^extra-[1-9]\d*$/)
            .max(40),
          label: z.string().trim().min(1).max(80),
          portions: MealPortionsSchema,
        }),
      )
      .max(10),
    inventoryConfirmed: z.boolean(),
  })
  .superRefine((day, context) => {
    if (day.start >= day.end)
      context.addIssue({
        code: "custom",
        path: ["end"],
        message: "Daily availability must end after it starts on the same day.",
      });
    const ids = day.extraMeals.map((meal) => meal.id);
    if (new Set(ids).size !== ids.length)
      context.addIssue({
        code: "custom",
        path: ["extraMeals"],
        message: "Meal occasion IDs must be unique.",
      });
  });
export const PreferenceInputSchema = z
  .strictObject({
    cityId: z.literal("palembang"),
    startDate: DateSchema,
    endDate: DateSchema,
    party: z.number().int().min(1).max(8),
    budget: z
      .string()
      .regex(/^[0-9]+$/)
      .refine(
        (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0,
        "The total group budget must be positive safe integer rupiah.",
      ),
    transport: TransportSchema,
    pace: z.enum(["relaxed", "balanced", "active"]),
    planningStyle: z.enum(["short", "pace"]).optional(),
    walkingLimit: z.number().int().positive(),
    interests: z.array(CategorySchema).max(3),
    mandatoryInterests: z.array(CategorySchema).max(3),
    foodPreference: z.enum(["neutral", "savory", "mild"]),
    dietaryRequirement: z.enum(["none", "halal", "ingredients"]),
    accessibilityRequirement: z.enum(["none", "step-free"]),
    days: z.array(DayInputSchema).min(1).max(7),
  })
  .superRefine((input, context) => {
    if (input.walkingLimit > PACE_LIMITS[input.pace].meters)
      context.addIssue({
        code: "custom",
        path: ["walkingLimit"],
        message:
          "The user walking limit cannot exceed the selected pace preset.",
      });
    if (
      input.mandatoryInterests.some(
        (category) => !input.interests.includes(category),
      )
    )
      context.addIssue({
        code: "custom",
        path: ["mandatoryInterests"],
        message: "Every mandatory interest must also be selected.",
      });
    for (const key of ["interests", "mandatoryInterests"] as const)
      if (new Set(input[key]).size !== input[key].length)
        context.addIssue({
          code: "custom",
          path: [key],
          message: "Duplicate interests are not allowed.",
        });
    input.days.forEach((day, index) => {
      const meals = [
        ...Object.values(day.meals),
        ...day.extraMeals.map((meal) => meal.portions),
      ];
      if (
        meals.some(
          (meal) =>
            meal.necessary > input.party ||
            meal.provided > input.party ||
            meal.prepaid > input.party,
        )
      )
        context.addIssue({
          code: "custom",
          path: ["days", index, "meals"],
          message:
            "An occasion cannot contain more portions than the party count.",
        });
    });
  });
export type PreferenceInput = z.infer<typeof PreferenceInputSchema>;

export const NormalizedMealSchema = z
  .strictObject({
    id: z
      .string()
      .regex(/^(?:breakfast|lunch|dinner|extra-[1-9]\d*)$/)
      .max(40),
    label: z.string().trim().min(1).max(80),
    necessary: z.number().int().min(0).max(8),
    provided: z.number().int().min(0).max(8),
    prepaid: z.number().int().min(0).max(8),
    purchased: z.number().int().min(0).max(8),
    confirmedZero: z.boolean(),
    scheduling: NormalizedMealSchedulingSchema.optional(),
  })
  .refine(
    (meal) =>
      meal.provided + meal.prepaid <= meal.necessary &&
      meal.purchased === meal.necessary - meal.provided - meal.prepaid,
    "Every necessary portion must reconcile to exact disjoint purchased/provided/prepaid quantities.",
  );
export type NormalizedMeal = z.infer<typeof NormalizedMealSchema>;
export const NormalizedDaySchema = z
  .strictObject({
    date: DateSchema,
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1439),
    startAnchor: AnchorSchema,
    endAnchor: AnchorSchema,
    coverage: z.enum(["both", "free", "culture-only", "food-only"]),
    inventoryConfirmed: z.boolean(),
    meals: z.array(NormalizedMealSchema).min(3).max(13),
  })
  .superRefine((day, context) => {
    if (day.startMinute >= day.endMinute)
      context.addIssue({
        code: "custom",
        path: ["endMinute"],
        message: "Daily availability must have positive same-day duration.",
      });
    const ids = day.meals.map((meal) => meal.id);
    if (
      new Set(ids).size !== ids.length ||
      ["breakfast", "lunch", "dinner"].some((id) => !ids.includes(id))
    )
      context.addIssue({
        code: "custom",
        path: ["meals"],
        message:
          "Each suggested meal occasion must appear exactly once; additional IDs must be unique.",
      });
  });
export type NormalizedDay = z.infer<typeof NormalizedDaySchema>;
export const NormalizedPreferencesSchema = z
  .strictObject({
    cityId: z.literal("palembang"),
    startDate: DateSchema,
    endDate: DateSchema,
    party: z.number().int().min(1).max(8),
    budgetIdr: IntegerSchema.positive(),
    transport: TransportSchema,
    pace: z.enum(["relaxed", "balanced", "active"]),
    planningStyle: z.enum(["short", "pace"]).optional(),
    walkingLimit: z.number().int().positive(),
    stopCap: z.number().int().min(3).max(5),
    interests: z.array(CategorySchema).max(3),
    mandatoryInterests: z.array(CategorySchema).max(3),
    foodPreference: z.enum(["neutral", "savory", "mild"]),
    dietaryRequirement: z.enum(["none", "halal", "ingredients"]),
    accessibilityRequirement: z.enum(["none", "step-free"]),
    dates: z.array(DateSchema).min(1).max(7),
    days: z.array(NormalizedDaySchema).min(1).max(7),
  })
  .superRefine((input, context) => {
    const add = (path: (string | number)[], message: string) =>
      context.addIssue({ code: "custom", path, message });
    if (
      input.stopCap !== PACE_LIMITS[input.pace].stops ||
      input.walkingLimit > PACE_LIMITS[input.pace].meters
    )
      add(["pace"], "Normalized caps must preserve the selected pace limits.");
    if (
      new Set(input.interests).size !== input.interests.length ||
      new Set(input.mandatoryInterests).size !==
        input.mandatoryInterests.length ||
      input.mandatoryInterests.some(
        (category) => !input.interests.includes(category),
      )
    )
      add(
        ["mandatoryInterests"],
        "Mandatory interests must be unique selected categories.",
      );
    const firstMs = Date.parse(`${input.startDate}T00:00:00Z`);
    const inclusiveCount =
      Math.round(
        (Date.parse(`${input.endDate}T00:00:00Z`) - firstMs) / 86400000,
      ) + 1;
    if (
      inclusiveCount < 1 ||
      inclusiveCount > 7 ||
      input.dates.length !== inclusiveCount ||
      input.days.length !== inclusiveCount ||
      input.dates.some(
        (date, index) =>
          Date.parse(`${date}T00:00:00Z`) !== firstMs + index * 86400000 ||
          input.days[index]?.date !== date,
      )
    )
      add(
        ["dates"],
        "Normalized dates and days must match every inclusive travel date once in chronological order.",
      );
    input.days.forEach((day, index) => {
      if (
        day.meals.some(
          (meal) =>
            meal.necessary > input.party ||
            meal.provided > input.party ||
            meal.prepaid > input.party,
        )
      )
        add(
          ["days", index, "meals"],
          "Each occasion must stay within the anonymous party portion count.",
        );
    });
  });
export type NormalizedPreferences = z.infer<typeof NormalizedPreferencesSchema>;

export const EvidenceRefSchema = z
  .strictObject({
    sourceId: z.string().min(1),
    sourcePolicyId: z.literal("synthetic-local-preview-v1"),
    field: z.string().min(1),
    assertionId: z.string().min(1),
    currentAssertionId: z.string().min(1),
    fieldHeadId: z.string().min(1),
    fieldHeadRevision: z.number().int().positive(),
    publicationRevision: z.number().int().positive(),
    reviewId: z.string().min(1),
    currentReviewId: z.string().min(1),
    reviewSequence: z.number().int().positive(),
    currentReviewSequence: z.number().int().positive(),
    state: z.enum(["fixture", "unknown", "stale", "conflicted", "revoked"]),
    sourceRevoked: z.boolean(),
    published: z.boolean(),
    validFrom: DateSchema,
    validTo: DateSchema,
    observedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    synthetic: z.literal(true),
    independentlyReviewed: z.literal(false),
  })
  .refine(
    (ref) => ref.validFrom <= ref.validTo,
    "Evidence applicability is inverted.",
  );
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
export const PriceSchema = z
  .strictObject({
    lower: IntegerSchema,
    upper: IntegerSchema,
    unit: z.enum(["person", "group", "portion"]),
  })
  .refine(
    (price) => price.lower <= price.upper,
    "The price range is inverted.",
  );
export const SyntheticPlaceSchema = z
  .strictObject({
    id: z.string().regex(/^syn-[a-z0-9-]+$/),
    cityId: z.literal("palembang"),
    name: z.string().min(1).max(120),
    kind: z.enum(["culture", "food"]),
    categoryIds: z.array(CategorySchema).max(3),
    foodTags: z.array(z.enum(["savory", "mild"])).max(2),
    minutes: z.number().int().min(1).max(480),
    windows: z.array(WindowSchema).min(1).max(4),
    exceptions: z
      .array(
        z.strictObject({
          date: DateSchema,
          closed: z.boolean(),
          windows: z.array(WindowSchema).max(4),
        }),
      )
      .max(100),
    price: PriceSchema.refine(
      (price) => price.unit !== "portion",
      "Place admission requires a per-person or per-group unit; meal portions are budgeted separately.",
    ),
    interiorWalking: RangeSchema,
    accessWalking: RangeSchema,
    dietary: z.array(z.enum(["halal", "ingredients"])).max(2),
    stepFree: z.boolean(),
    evidence: z.strictObject({
      identity: EvidenceRefSchema,
      location: EvidenceRefSchema,
      hours: EvidenceRefSchema,
      exceptions: EvidenceRefSchema,
      categories: EvidenceRefSchema,
      admission: EvidenceRefSchema,
      walking: EvidenceRefSchema,
      dietary: EvidenceRefSchema,
      accessibility: EvidenceRefSchema,
    }),
    synthetic: z.literal(true),
    independentlyReviewed: z.literal(false),
  })
  .superRefine((place, context) => {
    if (
      new Set(place.exceptions.map((exception) => exception.date)).size !==
      place.exceptions.length
    )
      context.addIssue({
        code: "custom",
        path: ["exceptions"],
        message: "Only one authoritative exception may apply per date.",
      });
    place.exceptions.forEach((exception, index) => {
      if (
        exception.closed
          ? exception.windows.length !== 0
          : exception.windows.length === 0
      )
        context.addIssue({
          code: "custom",
          path: ["exceptions", index],
          message:
            "A closed date has no windows; a replacement date needs explicit windows.",
        });
    });
  });
export type SyntheticPlace = z.infer<typeof SyntheticPlaceSchema>;
export const MealAllowanceSchema = z.strictObject({
  price: PriceSchema.refine(
    (price) => price.unit === "portion",
    "Meal allowance must use a per-portion unit.",
  ),
  evidence: EvidenceRefSchema,
  dietary: z.array(z.enum(["halal", "ingredients"])).max(2),
  stepFree: z.boolean(),
  dietaryEvidence: EvidenceRefSchema,
  accessibilityEvidence: EvidenceRefSchema,
  assumption: z.string().min(1),
});
export type MealAllowance = z.infer<typeof MealAllowanceSchema>;

/** Explicit synthetic service authority. Venue admission/food tags alone cannot fulfill a meal. */
export const MealServiceSchema = z.strictObject({
  id: z.string().regex(/^syn-meal-service-[a-z0-9-]+$/),
  cityId: z.literal("palembang"),
  placeId: z.string().regex(/^syn-/),
  durationMinutes: z.number().int().min(1).max(240),
  additionalChargeIdr: RangeSchema,
  maxPortions: z.number().int().min(1).max(8),
  supportedPortions: z
    .array(z.enum(["purchased", "provided", "prepaid"]))
    .min(1)
    .max(3),
  windows: z.array(WindowSchema).min(1).max(4),
  dietary: z.array(z.enum(["halal", "ingredients"])).max(2),
  stepFree: z.boolean(),
  evidence: z.strictObject({
    location: EvidenceRefSchema,
    service: EvidenceRefSchema,
    portions: EvidenceRefSchema,
    charges: EvidenceRefSchema,
    dietary: EvidenceRefSchema,
    accessibility: EvidenceRefSchema,
  }),
  synthetic: z.literal(true),
  independentlyReviewed: z.literal(false),
});
export type MealService = z.infer<typeof MealServiceSchema>;

export const RouteRequestSchema = z.strictObject({
  fromId: z.string().min(1).max(100),
  toId: z.string().min(1).max(100),
  mode: TransportSchema,
  date: DateSchema,
  departureMinute: z.number().int().min(0).max(1439),
  party: z.number().int().min(1).max(8),
});
export type RouteRequest = z.infer<typeof RouteRequestSchema>;
export const RouteDataSchema = z.strictObject({
  binding: RouteRequestSchema,
  durationMinutes: RangeSchema,
  distanceMeters: RangeSchema,
  walkingMeters: RangeSchema,
  costIdr: PriceSchema.refine(
    (price) => price.unit === "group",
    "Resolved route costs must be total group costs.",
  ),
  evidence: EvidenceRefSchema,
  synthetic: z.literal(true),
});
export type RouteData = z.infer<typeof RouteDataSchema>;
export const RouteOutcomeSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("ok"), data: RouteDataSchema }),
  z.strictObject({
    status: z.enum(["unknown", "unreachable", "error"]),
    reason: z.string().min(1),
    retryable: z.boolean(),
  }),
]);
export type RouteOutcome = z.infer<typeof RouteOutcomeSchema>;
export interface RoutingProvider {
  readonly id: string;
  resolve(request: RouteRequest): Promise<RouteOutcome>;
  /** Local fixtures may additionally expose revocation/current-head checks. */
  isCurrent?(refs: readonly EvidenceRef[]): boolean;
}
export interface CatalogueRepository {
  readonly version: string;
  list(cityId: string): Promise<SyntheticPlace[]>;
  getMealAllowance(): Promise<MealAllowance>;
  listMealServices?(): Promise<MealService[]>;
  isCurrent(refs: readonly EvidenceRef[]): boolean;
}
