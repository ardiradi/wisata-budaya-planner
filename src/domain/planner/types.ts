import type {
  EvidenceRef,
  NormalizedPreferences,
  Transport,
} from "../contracts";
import type { RecommendationReport } from "../recommendations/contracts";

export type Range = { lower: number; upper: number };
export type PlanIssue = {
  code: string;
  severity: "unknown" | "violation";
  message: string;
  date?: string;
  placeId?: string;
};
export type CostLine = {
  id: string;
  label: string;
  date?: string;
  quantity: number;
  unit: "person" | "group" | "portion";
  lowerIdr: number | null;
  upperIdr: number | null;
  evidenceRefs: EvidenceRef[];
};
export type PlanStop = {
  id: string;
  placeId: string;
  name: string;
  kind: "culture" | "food";
  categoryIds: string[];
  startMinute: number;
  endMinute: number;
  durationMinutes: number;
  openingWindow: { startMinute: number; endMinute: number };
  admissionIdr: Range;
  walkingMeters: Range;
  evidenceRefs: EvidenceRef[];
};
export type PlanLeg = {
  fromId: string;
  toId: string;
  mode: Transport;
  departureMinute: number;
  arrivalMinute: number | null;
  durationMinutes: Range | null;
  walkingMeters: Range | null;
  costIdr: Range | null;
  status: "known" | "unknown" | "error";
  evidenceRefs: EvidenceRef[];
};
export type PlanMeal = {
  id: string;
  label: string;
  date: string;
  necessary: number;
  provided: number;
  prepaid: number;
  purchased: number;
  lowerIdr: number | null;
  upperIdr: number | null;
  evidenceRefs: EvidenceRef[];
  schedulingStatus?: "unscheduled" | "scheduled" | "unresolved";
  serviceId?: string | null;
  placeId?: string | null;
  requestedWindow?: { startMinute: number; endMinute: number } | null;
  startMinute?: number | null;
  endMinute?: number | null;
  durationMinutes?: number | null;
  serviceChargeIdr?: Range | null;
};
export type UtilizationReason =
  | "SHORT_PLAN"
  | "PACE_CAP"
  | "CATALOGUE_RESERVED"
  | "NO_MORE_ELIGIBLE"
  | "FREE_DAY"
  | "EXPLICIT_EDIT"
  | "MEAL_SERVICE_REQUIRED"
  | "OPTIONAL_CONSTRAINT";
export type PlanDay = {
  date: string;
  startMinute: number;
  endMinute: number;
  startAnchor: string;
  endAnchor: string;
  coverage: string;
  stops: PlanStop[];
  legs: PlanLeg[];
  meals: PlanMeal[];
  walkingUpperMeters: number | null;
  culturalCovered: boolean;
  culinaryCovered: boolean;
  utilization?: {
    style: "short" | "relaxed" | "balanced" | "active";
    searchIncomplete: true;
    reasonCodes: UtilizationReason[];
  };
};
export type PlanResult = {
  recommendation?: RecommendationReport;
  status: "validated" | "draft" | "blocked";
  synthetic: true;
  independentlyReviewed: false;
  input: NormalizedPreferences | null;
  days: PlanDay[];
  issues: PlanIssue[];
  cost: {
    lines: CostLine[];
    lowerSubtotalIdr: number | null;
    upperSubtotalIdr: number | null;
    contingencyIdr: number | null;
    totalUpperIdr: number | null;
    budgetIdr: number | null;
  };
  coverage: {
    requiredCategoryIds: string[];
    fulfilledCategoryIds: string[];
    missingCategoryIds: string[];
  };
  work: {
    routeAttempts: number;
    modelCalls: number;
    matrixElements: 0;
    apiCostMicroUsd: 0;
    elapsedMs: number;
  };
  evidenceRefs: EvidenceRef[];
  catalogueVersion: string;
  evaluatedAt: string;
};
