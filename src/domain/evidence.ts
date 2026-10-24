import { DateSchema, EvidenceRefSchema, type EvidenceRef } from "./contracts";

export type EvidenceEvaluation = {
  usable: boolean;
  state: EvidenceRef["state"] | "invalid";
  reason?: string;
};

/** `fixture` is useful only for local synthetic checks. It never means human verification. */
export function evaluateEvidence(
  value: unknown,
  travelDate: string,
  asOf: string,
): EvidenceEvaluation {
  const parsed = EvidenceRefSchema.safeParse(value);
  if (!parsed.success)
    return {
      usable: false,
      state: "invalid",
      reason: "Evidence reference is malformed.",
    };
  const ref = parsed.data;
  if (
    !DateSchema.safeParse(travelDate).success ||
    !Number.isFinite(Date.parse(asOf))
  )
    return {
      usable: false,
      state: "invalid",
      reason: "Evidence travel date or evaluation time is invalid.",
    };
  if (ref.sourceRevoked || ref.state === "revoked")
    return {
      usable: false,
      state: "revoked",
      reason: "The current source or assertion is revoked.",
    };
  if (!ref.published)
    return {
      usable: false,
      state: "unknown",
      reason: "The field head is not published.",
    };
  if (
    ref.assertionId !== ref.currentAssertionId ||
    ref.reviewId !== ref.currentReviewId ||
    ref.reviewSequence !== ref.currentReviewSequence
  )
    return {
      usable: false,
      state: "conflicted",
      reason:
        "The reference does not match the authoritative current head and ordered review.",
    };
  if (ref.state !== "fixture")
    return {
      usable: false,
      state: ref.state,
      reason: `The current evidence is ${ref.state}; an older assertion cannot replace it.`,
    };
  if (Date.parse(ref.observedAt) > Date.parse(asOf))
    return {
      usable: false,
      state: "unknown",
      reason: "Evidence was not yet observed at evaluation time.",
    };
  if (Date.parse(ref.expiresAt) <= Date.parse(asOf))
    return {
      usable: false,
      state: "stale",
      reason:
        "The selected evidence expired; historical evidence cannot be used as fallback.",
    };
  if (travelDate < ref.validFrom || travelDate > ref.validTo)
    return {
      usable: false,
      state: "unknown",
      reason: "The selected evidence does not cover this travel date.",
    };
  return { usable: true, state: "fixture" };
}

export type EvidenceHead = { assertionId: string; revision: number };
export type OrderedReview = {
  assertionId: string;
  id: string;
  sequence: number;
  state: EvidenceRef["state"];
};

/** Select by explicit authority, never by timestamps or a latest-success query. */
export function selectCurrentEvidence(
  head: EvidenceHead | undefined,
  assertions: readonly EvidenceRef[],
  reviews: readonly OrderedReview[],
): EvidenceRef | undefined {
  if (!head) return undefined;
  const assertion = assertions.find(
    (candidate) => candidate.assertionId === head.assertionId,
  );
  if (!assertion || assertion.fieldHeadRevision !== head.revision)
    return undefined;
  const chain = reviews.filter(
    (review) => review.assertionId === head.assertionId,
  );
  if (
    !chain.length ||
    new Set(chain.map((review) => review.sequence)).size !== chain.length
  )
    return undefined;
  const current = chain.reduce((latest, review) =>
    review.sequence > latest.sequence ? review : latest,
  );
  if (
    current.id !== assertion.currentReviewId ||
    current.sequence !== assertion.currentReviewSequence
  )
    return undefined;
  return {
    ...assertion,
    currentAssertionId: head.assertionId,
    reviewId: current.id,
    reviewSequence: current.sequence,
    state: current.state,
  };
}
