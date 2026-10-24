import { z } from "zod";
import { NormalizedPreferencesSchema } from "@/domain/contracts";
import {
  RankingRequestSchema,
  ReasonCodeSchema,
  type RankingRequest,
} from "@/domain/recommendations/contracts";
import { allowedReasons } from "@/domain/recommendations/ranking";

/** V1 is retained as a comparison projection, never a separate source of authority. */
export function projectGeminiInputV1(rawRequest: RankingRequest) {
  const request = RankingRequestSchema.parse(rawRequest);
  return {
    schemaVersion: "gemini-ranking-input-v1" as const,
    snapshotId: request.snapshotId,
    preferences: request.preferences,
    candidates: request.candidates.map((candidate) => ({
      placeId: candidate.placeId,
      cityId: candidate.cityId,
      kind: candidate.kind,
      categoryIds: candidate.categoryIds,
      foodTags: candidate.foodTags,
      admissionUpperIdr: candidate.admissionUpperIdr,
      venueWalkingUpperMeters: candidate.venueWalkingUpperMeters,
      visitMinutes: candidate.visitMinutes,
      eligibleDates: candidate.eligibleDates,
      allowedReasonCodes: allowedReasons(candidate, request),
    })),
  };
}

const COLUMNS = [
  "placeId",
  "kind",
  "categoryIds",
  "foodTags",
  "admissionUpperIdr",
  "venueWalkingUpperMeters",
  "visitMinutes",
  "eligibleDateIndices",
  "allowedReasonIndices",
] as const;
const nonnegative = z.number().int().nonnegative().safe();
const referenceIndices = z.array(nonnegative).min(1).max(7);
const rowSchema = z.tuple([
  RankingRequestSchema.shape.candidates.element.shape.placeId,
  z.enum(["culture", "food"]),
  RankingRequestSchema.shape.candidates.element.shape.categoryIds,
  RankingRequestSchema.shape.candidates.element.shape.foodTags,
  nonnegative,
  nonnegative,
  z.number().int().positive().max(480),
  referenceIndices,
  referenceIndices,
]);
const inputSchema = z.strictObject({
  schemaVersion: z.literal("gemini-ranking-input-v2"),
  snapshotId: RankingRequestSchema.shape.snapshotId,
  cityId: RankingRequestSchema.shape.cityId,
  preferences: NormalizedPreferencesSchema,
  columns: z
    .array(z.enum(COLUMNS))
    .length(COLUMNS.length)
    .refine((columns) =>
      columns.every((column, index) => column === COLUMNS[index]),
    ),
  dates: z.array(z.iso.date()).min(1).max(420),
  reasons: z.array(ReasonCodeSchema).min(1).max(7),
  rows: z.array(rowSchema).max(60),
});
export type GeminiInputV2 = z.infer<typeof inputSchema>;

/**
 * Columnar wire representation only. No filtering, truncation, inferred values or
 * replacement IDs. Full preferences and all V1 ranking signals survive decoding.
 * Assertion authority stays in the original RankingRequest, never in model output.
 */
export function projectGeminiInputV2(
  rawRequest: RankingRequest,
): GeminiInputV2 {
  const original = projectGeminiInputV1(rawRequest);
  const dates = [
    ...new Set(original.candidates.flatMap((c) => c.eligibleDates)),
  ];
  const reasons = [
    ...new Set(original.candidates.flatMap((c) => c.allowedReasonCodes)),
  ];
  // Empty inputs are refused by dispatch admission. The projection remains valid
  // and reversible without inventing a candidate or asserting an eligible date.
  return inputSchema.parse({
    schemaVersion: "gemini-ranking-input-v2",
    snapshotId: original.snapshotId,
    cityId: rawRequest.cityId,
    preferences: original.preferences,
    columns: COLUMNS,
    dates: dates.length ? dates : original.preferences.dates,
    reasons: reasons.length ? reasons : ["AVAILABLE_WINDOW"],
    rows: original.candidates.map((c) => [
      c.placeId,
      c.kind,
      c.categoryIds,
      c.foodTags,
      c.admissionUpperIdr,
      c.venueWalkingUpperMeters,
      c.visitMinutes,
      c.eligibleDates.map((date) => dates.indexOf(date)),
      c.allowedReasonCodes.map((reason) => reasons.indexOf(reason)),
    ]),
  });
}

/** Strict decoder supports local equivalence tests, not acceptance of model facts. */
export function expandGeminiInputV2(raw: unknown) {
  const input = inputSchema.parse(raw);
  if (
    new Set(input.rows.map((row) => row[0])).size !== input.rows.length ||
    new Set(input.dates).size !== input.dates.length ||
    new Set(input.reasons).size !== input.reasons.length
  )
    throw new Error("DUPLICATE_PROJECTION_VALUE");
  const lookup = <T>(dictionary: readonly T[], indices: readonly number[]) => {
    if (
      new Set(indices).size !== indices.length ||
      indices.some((index) => index >= dictionary.length)
    )
      throw new Error("INVALID_PROJECTION_REFERENCE");
    return indices.map((index) => dictionary[index]);
  };
  return {
    schemaVersion: "gemini-ranking-input-v1" as const,
    snapshotId: input.snapshotId,
    preferences: input.preferences,
    candidates: input.rows.map((row) => ({
      placeId: row[0],
      cityId: input.cityId,
      kind: row[1],
      categoryIds: row[2],
      foodTags: row[3],
      admissionUpperIdr: row[4],
      venueWalkingUpperMeters: row[5],
      visitMinutes: row[6],
      eligibleDates: lookup(input.dates, row[7]),
      allowedReasonCodes: lookup(input.reasons, row[8]),
    })),
  };
}
