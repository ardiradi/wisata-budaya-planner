import {
  MealAllowanceSchema,
  MealServiceSchema,
  SyntheticPlaceSchema,
  type CatalogueRepository,
  type CategoryId,
  type EvidenceRef,
  type MealAllowance,
  type MealService,
  type SyntheticPlace,
} from "@/domain/contracts";
import { fixtureEvidence } from "./evidence-fixture";
import { SYNTHETIC_MEAL_SERVICES } from "./meal-services";

function freezeFixture<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeFixture);
    Object.freeze(value);
  }
  return value;
}

function place(
  id: string,
  name: string,
  kind: "culture" | "food",
  categoryIds: CategoryId[],
  price: number,
  options: Partial<SyntheticPlace> = {},
): SyntheticPlace {
  const evidence = Object.fromEntries(
    [
      "identity",
      "location",
      "hours",
      "exceptions",
      "categories",
      "admission",
      "walking",
      "dietary",
      "accessibility",
    ].map((field) => [field, fixtureEvidence(id, field)]),
  );
  return SyntheticPlaceSchema.parse({
    id,
    cityId: "palembang",
    name,
    kind,
    categoryIds,
    foodTags: kind === "food" ? ["savory", "mild"] : [],
    minutes: kind === "food" ? 45 : 60,
    windows: [{ startMinute: 480, endMinute: 1080 }],
    exceptions: [],
    price: { lower: price, upper: price, unit: "person" },
    interiorWalking:
      kind === "food" ? { lower: 40, upper: 60 } : { lower: 120, upper: 180 },
    // Venue-boundary-to-entrance connector, outside route endpoint scope.
    // Driving pickup/parking walking is separate in route fixtures; no span overlaps.
    accessWalking: { lower: 20, upper: 40 },
    dietary: ["halal", "ingredients"],
    stepFree: true,
    evidence,
    synthetic: true,
    independentlyReviewed: false,
    ...options,
  });
}

/** None of these identities, prices, categories or access claims describe actual Palembang places. */
export const SYNTHETIC_PLACES: readonly SyntheticPlace[] = freezeFixture([
  place(
    "syn-history-01",
    "Galeri Sejarah Contoh · sintetis",
    "culture",
    ["history-example"],
    25000,
  ),
  place(
    "syn-craft-01",
    "Studio Kriya Contoh · sintetis",
    "culture",
    ["craft-example"],
    30000,
  ),
  place(
    "syn-architecture-01",
    "Ruang Arsitektur Contoh · sintetis",
    "culture",
    ["architecture-example"],
    20000,
  ),
  place("syn-food-01", "Dapur Cerita Contoh · sintetis", "food", [], 0),
  place("syn-food-02", "Meja Rasa Contoh · sintetis", "food", [], 0, {
    foodTags: ["savory"],
    windows: [{ startMinute: 660, endMinute: 1020 }],
  }),
  place(
    "syn-culture-02",
    "Paviliun Contoh · sintetis",
    "culture",
    ["history-example", "architecture-example"],
    35000,
    {
      windows: [
        { startMinute: 540, endMinute: 720 },
        { startMinute: 780, endMinute: 1020 },
      ],
    },
  ),
  ...Array.from({ length: 6 }, (_, index) => {
    const ordinal = String(index + 2).padStart(2, "0");
    return place(
      `syn-history-${ordinal}`,
      `Galeri Sejarah Contoh ${ordinal} · sintetis`,
      "culture",
      ["history-example"],
      25000,
    );
  }),
  ...Array.from({ length: 5 }, (_, index) => {
    const ordinal = String(index + 3).padStart(2, "0");
    return place(
      `syn-food-${ordinal}`,
      `Dapur Cerita Contoh ${ordinal} · sintetis`,
      "food",
      [],
      0,
    );
  }),
]);
export const SYNTHETIC_MEAL_ALLOWANCE: MealAllowance = freezeFixture(
  MealAllowanceSchema.parse({
    price: { lower: 30000, upper: 40000, unit: "portion" },
    evidence: fixtureEvidence("meal-allowance", "price-and-included-charges"),
    dietary: ["halal", "ingredients"],
    stepFree: true,
    dietaryEvidence: fixtureEvidence("meal-allowance", "dietary"),
    accessibilityEvidence: fixtureEvidence("meal-allowance", "accessibility"),
    assumption:
      "Synthetic all-in meal allowance for each purchased portion, including modeled mandatory charges. This is not a real tariff, reviewed allowance, dietary assurance or purchase booking.",
  }),
);

type HeadOverride = {
  assertionId?: string;
  revision?: number;
  reviewId?: string;
  reviewSequence?: number;
  sourceRevoked?: boolean;
};
export type LocalRepositoryOptions = {
  places?: readonly SyntheticPlace[];
  allowance?: MealAllowance;
  mealServices?: readonly MealService[];
  headOverrides?: Readonly<Record<string, HeadOverride>>;
};

/** Request-scoped copies only: there is no database, storage, network or shared mutable publication API. */
export function getLocalRepository(
  options: LocalRepositoryOptions = {},
): CatalogueRepository {
  const places = structuredClone(options.places ?? SYNTHETIC_PLACES).map(
    (entry) => SyntheticPlaceSchema.parse(entry),
  );
  if (places.length > 60)
    throw new Error("The local catalogue candidate ceiling is 60.");
  if (new Set(places.map((entry) => entry.id)).size !== places.length)
    throw new Error("Canonical synthetic place IDs must be unique.");
  const allowance = MealAllowanceSchema.parse(
    structuredClone(options.allowance ?? SYNTHETIC_MEAL_ALLOWANCE),
  );
  const refs = [
    ...places.flatMap((entry) => Object.values(entry.evidence)),
    allowance.evidence,
    allowance.dietaryEvidence,
    allowance.accessibilityEvidence,
    ...(options.mealServices ?? SYNTHETIC_MEAL_SERVICES).flatMap((service) =>
      Object.values(service.evidence),
    ),
  ];
  const heads = new Map(
    refs.map((ref) => [
      ref.fieldHeadId,
      {
        assertionId: ref.currentAssertionId,
        revision: ref.fieldHeadRevision,
        reviewId: ref.currentReviewId,
        reviewSequence: ref.currentReviewSequence,
        publicationRevision: ref.publicationRevision,
        sourceId: ref.sourceId,
        sourcePolicyId: ref.sourcePolicyId,
        sourceRevoked: ref.sourceRevoked,
        ...options.headOverrides?.[ref.fieldHeadId],
      },
    ]),
  );
  return {
    version: "synthetic-catalogue-v1",
    async list(cityId) {
      return structuredClone(places.filter((entry) => entry.cityId === cityId));
    },
    async getMealAllowance() {
      return structuredClone(allowance);
    },
    async listMealServices() {
      return structuredClone(
        options.mealServices ?? SYNTHETIC_MEAL_SERVICES,
      ).map((service) => MealServiceSchema.parse(service));
    },
    isCurrent(pinned: readonly EvidenceRef[]) {
      return pinned.every((ref) => {
        const head = heads.get(ref.fieldHeadId);
        return (
          head !== undefined &&
          !head.sourceRevoked &&
          head.assertionId === ref.assertionId &&
          head.revision === ref.fieldHeadRevision &&
          head.reviewId === ref.reviewId &&
          head.reviewSequence === ref.reviewSequence &&
          head.publicationRevision === ref.publicationRevision &&
          head.sourceId === ref.sourceId &&
          head.sourcePolicyId === ref.sourcePolicyId
        );
      });
    },
  };
}
