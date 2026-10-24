import { describe, expect, it } from "vitest";
import { fixtureEvidence } from "@/infrastructure/synthetic/evidence-fixture";
import { evaluateEvidence, selectCurrentEvidence } from "./evidence";

const DATE = "2026-10-30";
const NOW = "2026-10-23T06:00:00Z";
describe("authoritative synthetic evidence", () => {
  it("keeps fixture eligibility explicitly separate from independent review", () => {
    const ref = fixtureEvidence("syn-history-01", "hours");
    expect(evaluateEvidence(ref, DATE, NOW)).toEqual({
      usable: true,
      state: "fixture",
    });
    expect(ref.independentlyReviewed).toBe(false);
    expect(
      evaluateEvidence({ ...ref, independentlyReviewed: true }, DATE, NOW)
        .usable,
    ).toBe(false);
  });
  it.each(["unknown", "stale", "conflicted", "revoked"] as const)(
    "does not replace a current %s assertion with historical success",
    (state) => {
      const old = fixtureEvidence("old", "hours");
      const current = fixtureEvidence("new", "hours", {
        state,
        observedAt: "2026-10-20T00:00:00Z",
      });
      const selected = selectCurrentEvidence(
        { assertionId: current.assertionId, revision: 1 },
        [old, current],
        [
          {
            assertionId: old.assertionId,
            id: old.reviewId,
            sequence: 1,
            state: "fixture",
          },
          {
            assertionId: current.assertionId,
            id: current.reviewId,
            sequence: 1,
            state,
          },
        ],
      );
      expect(selected?.assertionId).toBe(current.assertionId);
      expect(evaluateEvidence(selected, DATE, NOW)).toMatchObject({
        usable: false,
        state,
      });
    },
  );
  it("uses ordered current reviews rather than equal timestamps or insertion order", () => {
    const ref = fixtureEvidence("syn-history-01", "hours", {
      currentReviewId: "fixture-check-2",
      currentReviewSequence: 2,
    });
    const selected = selectCurrentEvidence(
      { assertionId: ref.assertionId, revision: 1 },
      [ref],
      [
        {
          assertionId: ref.assertionId,
          id: "fixture-check-2",
          sequence: 2,
          state: "unknown",
        },
        {
          assertionId: ref.assertionId,
          id: ref.reviewId,
          sequence: 1,
          state: "fixture",
        },
      ],
    );
    expect(selected?.state).toBe("unknown");
    expect(evaluateEvidence(selected, DATE, NOW).usable).toBe(false);
  });
  it("rejects forks, wrong assertions, missing heads and mismatched head revisions", () => {
    const ref = fixtureEvidence("syn-history-01", "hours");
    const review = {
      assertionId: ref.assertionId,
      id: ref.reviewId,
      sequence: 1,
      state: "fixture" as const,
    };
    expect(selectCurrentEvidence(undefined, [ref], [review])).toBeUndefined();
    expect(
      selectCurrentEvidence(
        { assertionId: ref.assertionId, revision: 2 },
        [ref],
        [review],
      ),
    ).toBeUndefined();
    expect(
      selectCurrentEvidence(
        { assertionId: ref.assertionId, revision: 1 },
        [ref],
        [review, { ...review, id: "fork" }],
      ),
    ).toBeUndefined();
    expect(
      selectCurrentEvidence(
        { assertionId: ref.assertionId, revision: 1 },
        [ref],
        [{ ...review, assertionId: "other" }],
      ),
    ).toBeUndefined();
  });
  it("fails closed on source revocation, expiry, travel-date mismatch and unpublished head", () => {
    const ref = fixtureEvidence("syn-history-01", "hours");
    for (const patch of [
      { sourceRevoked: true },
      { expiresAt: NOW },
      { validTo: "2026-10-29" },
      { published: false },
      { currentAssertionId: "replaced" },
      { currentReviewSequence: 2 },
    ])
      expect(evaluateEvidence({ ...ref, ...patch }, DATE, NOW).usable).toBe(
        false,
      );
    expect(evaluateEvidence(ref, "2026-02-30", NOW).usable).toBe(false);
    expect(evaluateEvidence(ref, DATE, "not-a-time").usable).toBe(false);
  });
});
