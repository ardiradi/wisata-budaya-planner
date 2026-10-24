import { EvidenceRefSchema, type EvidenceRef } from "@/domain/contracts";

/** Engineering fixture authority only; IDs do not identify human reviewers or real sources. */
export function fixtureEvidence(
  owner: string,
  field: string,
  patch: Partial<EvidenceRef> = {},
): EvidenceRef {
  const id = `${owner}:${field}`;
  return EvidenceRefSchema.parse({
    sourceId: `fixture-source:${owner}`,
    sourcePolicyId: "synthetic-local-preview-v1",
    field,
    assertionId: `${id}:assertion-1`,
    currentAssertionId: `${id}:assertion-1`,
    fieldHeadId: `${id}:head`,
    fieldHeadRevision: 1,
    publicationRevision: 1,
    reviewId: `${id}:fixture-check-1`,
    currentReviewId: `${id}:fixture-check-1`,
    reviewSequence: 1,
    currentReviewSequence: 1,
    state: "fixture",
    sourceRevoked: false,
    published: true,
    validFrom: "2000-01-01",
    validTo: "2100-12-31",
    observedAt: "2000-01-01T00:00:00Z",
    expiresAt: "2101-01-01T00:00:00Z",
    synthetic: true,
    independentlyReviewed: false,
    ...patch,
  });
}
