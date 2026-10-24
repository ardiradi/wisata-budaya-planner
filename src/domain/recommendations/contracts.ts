import { z } from "zod";
import {
  CategorySchema,
  DateSchema,
  IntegerSchema,
  NormalizedPreferencesSchema,
} from "../contracts";

export const REASON_CODES = [
  "INTEREST_MATCH",
  "MANDATORY_INTEREST",
  "CULINARY_MATCH",
  "LOWER_ADMISSION",
  "LOWER_WALKING",
  "SHORTER_VISIT",
  "AVAILABLE_WINDOW",
] as const;
export const ReasonCodeSchema = z.enum(REASON_CODES);
export type ReasonCode = z.infer<typeof ReasonCodeSchema>;
export const REJECTION_CODES = [
  "SCHEMA_INVALID",
  "BINDING_INVALID",
  "UNKNOWN_ID",
  "DUPLICATE_ID",
  "INCOMPLETE_RANKING",
  "ASSERTION_INVALID",
  "CATEGORY_INVALID",
  "REASON_INVALID",
  "MANDATORY_MISSING",
  "EVIDENCE_CHANGED",
  "NO_CANDIDATES",
  "PROVIDER_FAILURE",
  "REFUSAL",
  "TIMEOUT",
  "TOKEN_LIMIT",
  "COST_DENIED",
  "SPEND_LIMIT",
  "ATTEMPT_LIMIT",
  "DEADLINE",
  "CANCELLED",
  "RATE_LIMITED",
  "LIVE_DISABLED",
  "LIVE_ALREADY_USED",
  "INPUT_NOT_APPROVED",
] as const;
export const RejectionCodeSchema = z.enum(REJECTION_CODES);
export type RejectionCode = z.infer<typeof RejectionCodeSchema>;
// Canonical opaque identifiers only; source text and instructions are never IDs.
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9:_-]{0,179}$/);
const unique = (values: readonly string[]) =>
  new Set(values).size === values.length;
const CandidateSchema = z.strictObject({
  placeId: id,
  cityId: z.literal("palembang"),
  kind: z.enum(["culture", "food"]),
  categoryIds: z.array(CategorySchema).max(3).refine(unique),
  foodTags: z
    .array(z.enum(["savory", "mild"]))
    .max(2)
    .refine(unique),
  admissionUpperIdr: IntegerSchema,
  venueWalkingUpperMeters: IntegerSchema,
  visitMinutes: IntegerSchema.positive().max(480),
  eligibleDates: z.array(DateSchema).min(1).max(7).refine(unique),
  assertionIds: z.array(id).min(1).max(6).refine(unique),
});
export const RankingRequestSchema = z.strictObject({
  schemaVersion: z.literal("ranking-request-v1"),
  snapshotId: id,
  cityId: z.literal("palembang"),
  preferences: NormalizedPreferencesSchema,
  candidates: z
    .array(CandidateSchema)
    .max(60)
    .refine((candidates) =>
      unique(candidates.map((candidate) => candidate.placeId)),
    ),
});
export type RankingRequest = z.infer<typeof RankingRequestSchema>;
export type RankingCandidate = RankingRequest["candidates"][number];
export const RankedCandidateSchema = z.strictObject({
  placeId: id,
  reasonCodes: z.array(ReasonCodeSchema).min(1).max(7),
  categoryIds: z.array(CategorySchema).max(3),
  assertionIds: z.array(id).min(1).max(6),
});
export const RankingResponseSchema = z.strictObject({
  schemaVersion: z.literal("ranking-response-v1"),
  snapshotId: id,
  cityId: z.literal("palembang"),
  rankings: z.array(RankedCandidateSchema).max(60),
});
export type RankingResponse = z.infer<typeof RankingResponseSchema>;
const UsageSchema = z.strictObject({
  inputTokens: IntegerSchema,
  outputTokens: IntegerSchema,
  simulatedCostMicroUsd: IntegerSchema,
  modelCalls: z.union([z.literal(0), z.literal(1)]).optional(),
  inputBoundTokens: IntegerSchema.optional(),
});
export const RankingOutcomeSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("ok"),
    output: z.unknown(),
    usage: UsageSchema,
  }),
  z.strictObject({
    status: z.literal("error"),
    code: z.enum([
      "UNAVAILABLE",
      "TIMEOUT",
      "REFUSAL",
      "RATE_LIMITED",
      "LIVE_DISABLED",
      "LIVE_ALREADY_USED",
      "INPUT_NOT_APPROVED",
      "TOKEN_LIMIT",
      "SCHEMA_INVALID",
      "UNKNOWN_ID",
    ]),
    retryable: z.boolean(),
    usage: UsageSchema,
  }),
]);
export interface RecommendationProvider {
  readonly id: string;
  readonly kind?: "mock" | "live";
  readonly modelId?: "gemini-3.8-flash" | "gemini-2.5-flash";
  readonly maxAttempts?: 1 | 2;
  readonly timeoutMs?: number;
  /** Only synthetic admission exists in B3. This is not a production spend ledger. */
  admit?(reservation: {
    attempt: number;
    reservationMicroUsd: number;
  }): boolean;
  rank(
    request: RankingRequest,
    context: {
      signal: AbortSignal;
      attempt: number;
      repairCode?: RejectionCode;
    },
  ): Promise<unknown>;
}
export const RecommendationReportSchema = z.strictObject({
  schemaVersion: z.literal("recommendation-report-v1"),
  source: z.enum([
    "mock_ai",
    "gemini_live",
    "deterministic_fallback",
    "unavailable",
  ]),
  synthetic: z.literal(true),
  independentlyReviewed: z.literal(false),
  providerId: id,
  modelId: z.enum(["gemini-3.8-flash", "gemini-2.5-flash"]).optional(),
  liveModelCalls: IntegerSchema.max(2).optional(),
  snapshotId: id,
  candidateCount: IntegerSchema.max(60),
  attempts: IntegerSchema.max(2),
  inputTokens: IntegerSchema.max(24000),
  outputTokens: IntegerSchema.max(4000),
  simulatedCostMicroUsd: IntegerSchema.max(1000000),
  // Live free-tier intent is not a reconciled provider billing record.
  actualApiCostMicroUsd: z.literal(0).nullable(),
  rejectionCodes: z.array(RejectionCodeSchema).max(10),
  rankings: z.array(RankedCandidateSchema).max(60),
});
export type RecommendationReport = z.infer<typeof RecommendationReportSchema>;
