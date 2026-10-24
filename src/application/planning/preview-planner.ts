import { z } from "zod";
import {
  DayInputSchema,
  PreferenceInputSchema,
  type CatalogueRepository,
} from "@/domain/contracts";
import { addCalendarDays, normalizePreferences } from "@/domain/normalization";
import { emptyResult, freezeDeep, planItinerary } from "@/domain/planner";
import type { PlanResult } from "@/domain/planner/types";
import type { RecommendationProvider } from "@/domain/recommendations/contracts";
import { getLocalRepository } from "@/infrastructure/synthetic/catalogue";
import { getSyntheticRouting } from "@/infrastructure/synthetic/routing";
import { siteConfig } from "@/config/site";
import {
  getMockRankingProvider,
  type MockRankingScenario,
} from "@/infrastructure/synthetic/mock-ranking";

// The nested transport DTO has structural checks; all cross-field rules run again in normalization.
const InputSchema = z
  .strictObject(PreferenceInputSchema.shape)
  .omit({ cityId: true, days: true });
const SubmissionSchema = z.strictObject({
  input: InputSchema,
  days: z.array(DayInputSchema).min(1).max(7),
});
export type SyntheticSubmission = {
  input: Omit<
    z.input<typeof InputSchema>,
    | "foodPreference"
    | "dietaryRequirement"
    | "accessibilityRequirement"
    | "interests"
    | "mandatoryInterests"
  > & {
    foodPreference: string;
    dietaryRequirement: string;
    accessibilityRequirement: string;
    interests: string[];
    mandatoryInterests: string[];
  };
  days: (Omit<z.input<typeof DayInputSchema>, "startAnchor" | "endAnchor"> & {
    startAnchor: string;
    endAnchor: string;
  })[];
};
function cityToday(evaluatedAt: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: siteConfig.city.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(evaluatedAt));
}

/** No network, credentials, persistence or traveler identifiers enter this preview facade. */
export async function generateSyntheticPlan(
  submission: unknown,
  scenario: "normal" | "missing-route" = "normal",
  recommendationScenario: MockRankingScenario = "normal",
  repository?: CatalogueRepository,
  recommendationProvider?: RecommendationProvider,
): Promise<PlanResult> {
  const evaluatedAt = new Date().toISOString();
  const parsed = SubmissionSchema.safeParse(submission);
  if (!parsed.success)
    return freezeDeep(
      emptyResult(
        evaluatedAt,
        parsed.error.issues.map((issue) => ({
          code: "INPUT_INVALID",
          severity: "violation",
          message: `${issue.path.join(".")}: ${issue.message}`,
        })),
      ),
    );
  const normalized = normalizePreferences(
    { ...parsed.data.input, cityId: "palembang", days: parsed.data.days },
    { today: cityToday(evaluatedAt) },
  );
  if (!normalized.ok)
    return freezeDeep(
      emptyResult(
        evaluatedAt,
        normalized.issues.map((issue) => ({
          code: "INPUT_INVALID",
          severity: "violation",
          message: `${issue.path}: ${issue.message}`,
        })),
      ),
    );
  const router = getSyntheticRouting();
  const routing =
    scenario === "missing-route"
      ? {
          id: "synthetic-missing-return-v1",
          resolve: async (request: Parameters<typeof router.resolve>[0]) =>
            request.toId.startsWith("anchor-")
              ? {
                  status: "unknown" as const,
                  reason: "Synthetic return evidence intentionally missing.",
                  retryable: false,
                }
              : router.resolve(request),
        }
      : router;
  return planItinerary(normalized.value, {
    repository: repository ?? getLocalRepository(),
    routing,
    evaluatedAt,
    recommendationProvider:
      recommendationProvider ?? getMockRankingProvider(recommendationScenario),
  });
}

export function buildRecommendationProfile(
  profile: "history" | "craft" | "architecture",
  today: string,
): SyntheticSubmission {
  const submission = buildSyntheticScenario("feasible", today);
  const category =
    profile === "history"
      ? "history-example"
      : profile === "craft"
        ? "craft-example"
        : "architecture-example";
  submission.input.interests = [category];
  submission.input.mandatoryInterests = [category];
  if (profile === "craft") {
    submission.input.pace = "relaxed";
    submission.input.walkingLimit = 2000;
    submission.input.transport = "walk";
  }
  if (profile === "architecture") {
    submission.input.transport = "taxi";
    submission.input.foodPreference = "savory";
  }
  return submission;
}

export function buildSyntheticScenario(
  name: "feasible" | "low-budget" | "missing-route",
  today: string,
): SyntheticSubmission {
  const date = addCalendarDays(today, 1);
  const portions = {
    necessary: 2,
    provided: 0,
    prepaid: 0,
    confirmedZero: false,
  };
  return {
    input: {
      startDate: date,
      endDate: date,
      party: 2,
      budget: name === "low-budget" ? "10000" : "1500000",
      transport: "car",
      pace: "balanced",
      walkingLimit: 4000,
      interests: ["history-example"],
      mandatoryInterests: ["history-example"],
      foodPreference: "neutral",
      dietaryRequirement: "none",
      accessibilityRequirement: "none",
    },
    days: [
      {
        date,
        start: "08:00",
        end: "18:00",
        startAnchor: "anchor-a",
        endAnchor: "anchor-a",
        coverage: "both",
        inventoryConfirmed: true,
        meals: {
          breakfast: { ...portions, provided: 2 },
          lunch: { ...portions },
          dinner: { ...portions },
        },
        extraMeals: [],
      },
    ],
  };
}
