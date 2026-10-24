import {
  NormalizedPreferencesSchema,
  SyntheticPlaceSchema,
  type EvidenceRef,
  type NormalizedPreferences,
  type SyntheticPlace,
} from "../contracts";
import { evaluateEvidence } from "../evidence";
import { placeEligibility } from "../planner/selection";
import { charge } from "../planner/cost";
import {
  RankingRequestSchema,
  RankingResponseSchema,
  type RankingRequest,
  type RankingResponse,
  type RankingCandidate,
  type ReasonCode,
  type RejectionCode,
} from "./contracts";

/** A deterministic fingerprint binds the complete structured payload; not a privacy hash or signature. */
function fingerprint(value: unknown) {
  let hash = 2166136261;
  for (const char of JSON.stringify(value))
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `synthetic-ranking-v1-${(hash >>> 0).toString(16)}`;
}
export function buildRankingRequest(
  input: NormalizedPreferences,
  rawPlaces: readonly SyntheticPlace[],
  evaluatedAt: string,
  isCurrent: (refs: readonly EvidenceRef[]) => boolean,
) {
  input = NormalizedPreferencesSchema.parse(input);
  if (rawPlaces.length > 60) throw new Error("CANDIDATE_LIMIT");
  const places = rawPlaces.map((place) => SyntheticPlaceSchema.parse(place));
  if (new Set(places.map((place) => place.id)).size !== places.length)
    throw new Error("DUPLICATE_CATALOGUE_ID");
  const evidenceRefs: EvidenceRef[] = [];
  const candidates: RankingCandidate[] = [];
  for (const place of places) {
    if (place.cityId !== input.cityId) continue;
    // Catalogue names, descriptions, URLs and meal labels never enter a model request.
    const refs = Object.values(place.evidence);
    const admission = charge(
      place.price.upper,
      place.price.unit === "person" ? input.party : 1,
    );
    const walking = place.interiorWalking.upper + place.accessWalking.upper;
    const eligibleDates = input.dates.filter(
      (date) =>
        placeEligibility(place, input, date, evaluatedAt).eligible &&
        refs.every((ref) => evaluateEvidence(ref, date, evaluatedAt).usable),
    );
    if (
      !eligibleDates.length ||
      admission > input.budgetIdr ||
      walking > input.walkingLimit ||
      !isCurrent(refs)
    )
      continue;
    evidenceRefs.push(...refs);
    candidates.push({
      placeId: place.id,
      cityId: place.cityId,
      kind: place.kind,
      categoryIds: place.kind === "culture" ? place.categoryIds : [],
      foodTags: place.foodTags.filter(
        (tag): tag is "savory" | "mild" => tag === "savory" || tag === "mild",
      ),
      admissionUpperIdr: admission,
      venueWalkingUpperMeters: walking,
      visitMinutes: place.minutes,
      eligibleDates,
      assertionIds: [
        place.evidence.identity.assertionId,
        place.evidence.hours.assertionId,
        place.evidence.exceptions.assertionId,
        place.evidence.admission.assertionId,
        place.evidence.walking.assertionId,
        ...(place.kind === "culture"
          ? [place.evidence.categories.assertionId]
          : []),
      ],
    });
  }
  const preferences = structuredClone(input);
  preferences.days.forEach((day) =>
    day.meals.forEach((meal) => {
      meal.label = meal.id.startsWith("extra-") ? "Extra meal" : meal.id;
    }),
  );
  const body = {
    schemaVersion: "ranking-request-v1" as const,
    cityId: input.cityId,
    preferences,
    candidates,
  };
  const request = RankingRequestSchema.parse({
    ...body,
    snapshotId: fingerprint({ body, evidenceRefs }),
  });
  return { request, evidenceRefs };
}
export function allowedReasons(
  candidate: RankingCandidate,
  request: RankingRequest,
): ReasonCode[] {
  const reasons: ReasonCode[] = ["AVAILABLE_WINDOW"];
  const p = request.preferences;
  if (candidate.categoryIds.some((id) => p.interests.includes(id)))
    reasons.push("INTEREST_MATCH");
  if (candidate.categoryIds.some((id) => p.mandatoryInterests.includes(id)))
    reasons.push("MANDATORY_INTEREST");
  if (
    candidate.kind === "food" &&
    p.foodPreference !== "neutral" &&
    candidate.foodTags.includes(p.foodPreference)
  )
    reasons.push("CULINARY_MATCH");
  const peers = request.candidates.filter(
    (other) => other.kind === candidate.kind,
  );
  if (
    candidate.admissionUpperIdr ===
    Math.min(...peers.map((peer) => peer.admissionUpperIdr))
  )
    reasons.push("LOWER_ADMISSION");
  if (
    candidate.venueWalkingUpperMeters ===
    Math.min(...peers.map((peer) => peer.venueWalkingUpperMeters))
  )
    reasons.push("LOWER_WALKING");
  if (
    candidate.visitMinutes ===
    Math.min(...peers.map((peer) => peer.visitMinutes))
  )
    reasons.push("SHORTER_VISIT");
  return reasons;
}
export function fallbackResponse(request: RankingRequest): RankingResponse {
  request = RankingRequestSchema.parse(request);
  const score = (c: RankingCandidate) =>
    c.categoryIds.filter((id) =>
      request.preferences.mandatoryInterests.includes(id),
    ).length *
      1000 +
    c.categoryIds.filter((id) => request.preferences.interests.includes(id))
      .length *
      100 +
    (request.preferences.foodPreference !== "neutral" &&
    c.foodTags.includes(request.preferences.foodPreference)
      ? 10
      : 0);
  const candidates = [...request.candidates].sort(
    (a, b) =>
      score(b) - score(a) ||
      a.admissionUpperIdr - b.admissionUpperIdr ||
      a.venueWalkingUpperMeters - b.venueWalkingUpperMeters ||
      a.visitMinutes - b.visitMinutes ||
      a.placeId.localeCompare(b.placeId),
  );
  return {
    schemaVersion: "ranking-response-v1",
    snapshotId: request.snapshotId,
    cityId: request.cityId,
    rankings: candidates.map((candidate) => ({
      placeId: candidate.placeId,
      categoryIds: [...candidate.categoryIds],
      assertionIds: [...candidate.assertionIds],
      reasonCodes: allowedReasons(candidate, request),
    })),
  };
}
const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length &&
  new Set(a).size === a.length &&
  a.every((value) => b.includes(value));
export function validateRecommendationOutput(
  raw: unknown,
  request: RankingRequest,
): { ok: true; value: RankingResponse } | { ok: false; code: RejectionCode } {
  const parsed = RankingResponseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "SCHEMA_INVALID" };
  const output = parsed.data;
  if (
    output.snapshotId !== request.snapshotId ||
    output.cityId !== request.cityId
  )
    return { ok: false, code: "BINDING_INVALID" };
  const ids = output.rankings.map((row) => row.placeId);
  if (new Set(ids).size !== ids.length)
    return { ok: false, code: "DUPLICATE_ID" };
  if (
    ids.some(
      (id) => !request.candidates.some((candidate) => candidate.placeId === id),
    )
  )
    return { ok: false, code: "UNKNOWN_ID" };
  const actualCategories = new Set(
    output.rankings.flatMap(
      (row) =>
        request.candidates.find(
          (candidate) => candidate.placeId === row.placeId,
        )!.categoryIds,
    ),
  );
  if (
    request.preferences.mandatoryInterests.some(
      (id) =>
        request.candidates.some((c) => c.categoryIds.includes(id)) &&
        !actualCategories.has(id),
    )
  )
    return { ok: false, code: "MANDATORY_MISSING" };
  if (ids.length !== request.candidates.length)
    return { ok: false, code: "INCOMPLETE_RANKING" };
  for (const row of output.rankings) {
    const candidate = request.candidates.find(
      (candidate) => candidate.placeId === row.placeId,
    )!;
    if (!sameSet(row.categoryIds, candidate.categoryIds))
      return { ok: false, code: "CATEGORY_INVALID" };
    if (!sameSet(row.assertionIds, candidate.assertionIds))
      return { ok: false, code: "ASSERTION_INVALID" };
    if (
      new Set(row.reasonCodes).size !== row.reasonCodes.length ||
      row.reasonCodes.some(
        (reason) => !allowedReasons(candidate, request).includes(reason),
      )
    )
      return { ok: false, code: "REASON_INVALID" };
  }
  return { ok: true, value: output };
}
