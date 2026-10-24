import { describe, expect, it, vi } from "vitest";
import { createLocalEditingSession } from "@/application/editing/local-session";
import { buildSyntheticScenario } from "@/application/planning/preview-planner";
import { normalizePreferences } from "@/domain/normalization";
import { planItinerary } from "@/domain/planner";
import { EDITORIAL_FIELDS } from "@/domain/editorial/contracts";
import { SYNTHETIC_PLACES } from "@/infrastructure/synthetic/catalogue";
import { getSyntheticRouting } from "@/infrastructure/synthetic/routing";
import { getMockRankingProvider } from "@/infrastructure/synthetic/mock-ranking";
import {
  createEditorialSession,
  createSyntheticDraft,
  SIMULATED_CURATOR as curator,
  SIMULATED_REVIEWER as reviewer,
  type EditorialSession,
} from "./session";

const AS_OF = "2026-10-23T10:00:00.000Z";
const create = () => createEditorialSession({ now: () => AS_OF });
const body = (session: EditorialSession, id = "syn-history-01") => {
  const record = session
    .getSnapshot()
    .records.find((entry) => entry.id === id)!;
  return structuredClone(record.draft ?? record.active)!;
};
const approve = (session: EditorialSession, id = "syn-history-01") => {
  expect(session.submit(curator, id)).toEqual({ ok: true });
  return session.review(
    reviewer,
    id,
    "approve",
    "Seluruh bukti fixture diperiksa dalam simulasi.",
  );
};
const dependencies = (session: EditorialSession) => ({
  repository: session.getRepository(),
  routing: getSyntheticRouting(),
  recommendationProvider: getMockRankingProvider(),
  evaluatedAt: AS_OF,
  now: () => 0,
});
function preferences() {
  const submission = buildSyntheticScenario("feasible", "2026-10-23");
  const result = normalizePreferences(
    { ...submission.input, cityId: "palembang", days: submission.days },
    { today: "2026-10-23" },
  );
  if (!result.ok) throw new Error("Invalid test fixture.");
  return result.value;
}

describe("synthetic in-memory editorial session", () => {
  it("starts with engineering baseline events and no human approval or identity", async () => {
    const session = create();
    const state = session.getSnapshot();
    expect(state.records).toHaveLength(17);
    expect(
      state.records.every((entry) => entry.status === "baseline_fixture"),
    ).toBe(true);
    expect(
      state.events.every(
        (entry) =>
          entry.actorId === "system-fixture" &&
          entry.action === "baseline_fixture" &&
          !entry.independentlyReviewed,
      ),
    ).toBe(true);
    expect(await session.getRepository().list("palembang")).toHaveLength(17);
    expect(
      state.records.every(
        (entry) => entry.active?.independentlyReviewed === false,
      ),
    ).toBe(true);
  });

  it("returns stable frozen snapshots, immutable events and isolated repository copies", async () => {
    const session = create();
    const first = session.getSnapshot();
    expect(first).toBe(session.getSnapshot());
    expect(Object.isFrozen(first.records[0].active!.evidence.identity)).toBe(
      true,
    );
    const listed = await session.getRepository().list("palembang");
    listed[0].name = "mutated";
    expect(session.getSnapshot().records[0].active!.name).not.toBe("mutated");
    const draft = body(session);
    draft.name = "Perubahan contoh · sintetis";
    expect(session.updateDraft(curator, draft.id, draft)).toEqual({ ok: true });
    expect(first.events).toHaveLength(17);
    expect(first.records[0].draft).toBeNull();
    expect(session.getSnapshot()).not.toBe(first);
    expect(Object.isFrozen(session.getSnapshot().events.at(-1))).toBe(true);
  });

  it("supports subscribe and unsubscribe with one notification per successful action", () => {
    const session = create();
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);
    session.updateDraft(curator, "syn-history-01", body(session));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    session.submit(curator, "syn-history-01");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps active publication unchanged until a distinct reviewer approves the submitted draft", async () => {
    const session = create();
    const old = body(session);
    const changed = {
      ...old,
      name: "Galeri revisi demo · sintetis",
      price: { ...old.price, lower: 35000, upper: 40000 },
    };
    expect(session.updateDraft(curator, changed.id, changed)).toEqual({
      ok: true,
    });
    expect((await session.getRepository().list("palembang"))[0].name).toBe(
      old.name,
    );
    expect(session.getRepository().isCurrent(Object.values(old.evidence))).toBe(
      true,
    );
    expect(approve(session)).toEqual({ ok: true });
    const current = (await session.getRepository().list("palembang"))[0];
    expect(current.name).toBe(changed.name);
    expect(current.price.upper).toBe(40000);
    expect(current.independentlyReviewed).toBe(false);
    expect(
      session.getRepository().isCurrent(Object.values(current.evidence)),
    ).toBe(true);
    expect(session.getRepository().isCurrent(Object.values(old.evidence))).toBe(
      false,
    );
    expect(current.evidence.identity.assertionId).not.toBe(
      old.evidence.identity.assertionId,
    );
  });

  it("denies contributor self-approval and forged role selection", () => {
    const session = create();
    session.updateDraft(curator, "syn-history-01", body(session));
    session.submit(curator, "syn-history-01");
    expect(
      session.review(
        curator,
        "syn-history-01",
        "approve",
        "Coba menyetujui sendiri.",
      ),
    ).toMatchObject({ ok: false, code: "SELF_APPROVAL" });
    expect(
      session.review(
        { ...curator, role: "reviewer" },
        "syn-history-01",
        "approve",
        "Peran palsu.",
      ),
    ).toMatchObject({ ok: false, code: "ROLE_DENIED" });
    expect(session.getSnapshot().records[0].status).toBe("submitted");
  });

  it.each(["unknown", "stale", "conflicted", "revoked"] as const)(
    "blocks simulated publication with %s evidence",
    (state) => {
      const session = create();
      const draft = body(session);
      draft.evidence.hours.state = state;
      session.updateDraft(curator, draft.id, draft);
      expect(session.submit(curator, draft.id)).toEqual({ ok: true });
      expect(
        session.review(
          reviewer,
          draft.id,
          "approve",
          "Tidak boleh melewati bukti.",
        ),
      ).toMatchObject({ ok: false, code: "EVIDENCE_REQUIRED" });
      expect(
        session
          .getSnapshot()
          .records[0].eligibilityIssues.some((message) =>
            message.startsWith("hours:"),
          ),
      ).toBe(true);
    },
  );

  it.each([
    "unpublished",
    "expired",
    "future-observed",
    "outside-validity",
    "mismatched-authority",
  ])("blocks %s field evidence", (condition) => {
    const session = create();
    const draft = body(session);
    if (condition === "unpublished") draft.evidence.identity.published = false;
    if (condition === "expired")
      draft.evidence.identity.expiresAt = "2026-01-01T00:00:00Z";
    if (condition === "future-observed")
      draft.evidence.identity.observedAt = "2027-01-01T00:00:00Z";
    if (condition === "mismatched-authority")
      draft.evidence.identity.currentAssertionId =
        "different-current-assertion";
    if (condition === "outside-validity")
      draft.evidence.identity.validTo = "2020-01-01";
    session.updateDraft(curator, draft.id, draft);
    session.submit(curator, draft.id);
    expect(
      session.review(
        reviewer,
        draft.id,
        "approve",
        "Bukti tidak memenuhi syarat.",
      ),
    ).toMatchObject({ ok: false, code: "EVIDENCE_REQUIRED" });
  });

  it("rejects malformed/missing fields and falsely independently reviewed content", () => {
    const session = create();
    const draft = body(session);
    const missing = structuredClone(draft) as unknown as {
      evidence: Record<string, unknown>;
    };
    delete missing.evidence.hours;
    for (const invalid of [
      missing,
      { ...draft, independentlyReviewed: true },
      { ...draft, cityId: "another-city" },
      { ...draft, name: "Unlabelled place" },
      { ...draft, historicalClaim: "Injected fact" },
    ]) {
      expect(session.updateDraft(curator, draft.id, invalid)).toMatchObject({
        ok: false,
        code: "INVALID_PLACE",
      });
    }
    expect(session.getSnapshot().revision).toBe(0);
  });

  it("rejects borrowed cross-field heads, non-fixture source identities and tampered current references", () => {
    const session = create();
    const original = body(session);
    const borrowed = structuredClone(original);
    borrowed.evidence.hours = structuredClone(borrowed.evidence.identity);
    expect(session.updateDraft(curator, borrowed.id, borrowed)).toMatchObject({
      ok: false,
      code: "INVALID_PLACE",
    });
    const realSource = structuredClone(original);
    realSource.evidence.hours.sourceId = "real-cultural-authority";
    expect(
      session.updateDraft(curator, realSource.id, realSource),
    ).toMatchObject({ ok: false, code: "INVALID_PLACE" });
    const tampered = structuredClone(original.evidence.identity);
    tampered.currentAssertionId = "different-head";
    expect(session.getRepository().isCurrent([tampered])).toBe(false);
  });

  it("supports rejection and corrected resubmission without replacing the active record", async () => {
    const session = create();
    const old = body(session);
    session.updateDraft(curator, old.id, {
      ...old,
      name: "Draf perlu koreksi · sintetis",
    });
    session.submit(curator, old.id);
    expect(
      session.review(
        reviewer,
        old.id,
        "reject",
        "Perjelas cakupan bukti fixture.",
      ),
    ).toEqual({ ok: true });
    expect(session.getSnapshot().records[0].status).toBe("rejected");
    expect((await session.getRepository().list("palembang"))[0].name).toBe(
      old.name,
    );
    const draft = body(session);
    draft.name = "Draf telah diperbaiki · sintetis";
    session.updateDraft(curator, old.id, draft);
    expect(approve(session)).toEqual({ ok: true });
  });

  it("requires valid review/withdrawal notes and submitted state", () => {
    const session = create();
    expect(
      session.review(
        reviewer,
        "syn-history-01",
        "approve",
        "Valid review note",
      ),
    ).toMatchObject({ ok: false, code: "INVALID_STATE" });
    expect(session.withdraw(curator, "syn-history-01", " ")).toMatchObject({
      ok: false,
      code: "REASON_REQUIRED",
    });
    expect(
      session.review(reviewer, "syn-history-01", "approve", " "),
    ).toMatchObject({ ok: false, code: "INVALID_REVIEW" });
  });

  it("adds synthetic drafts without granting eligibility and enforces uniqueness and the candidate ceiling", async () => {
    const session = create();
    const draft = createSyntheticDraft(
      "syn-demo-new",
      "Studio demo",
      "culture",
    );
    expect(session.createDraft(reviewer, draft)).toMatchObject({
      ok: false,
      code: "ROLE_DENIED",
    });
    expect(session.createDraft(curator, draft)).toEqual({ ok: true });
    expect(session.createDraft(curator, draft)).toMatchObject({
      ok: false,
      code: "DUPLICATE_ID",
    });
    expect(await session.getRepository().list("palembang")).toHaveLength(17);
    expect(approve(session, draft.id)).toEqual({ ok: true });
    expect(await session.getRepository().list("palembang")).toHaveLength(18);
    for (let index = 18; index < 60; index++)
      expect(
        session.createDraft(
          curator,
          createSyntheticDraft(`syn-new-${index}`, `Draf ${index}`),
        ),
      ).toEqual({ ok: true });
    expect(
      session.createDraft(
        curator,
        createSyntheticDraft("syn-limit-exceeded", "Draf melampaui"),
      ),
    ).toMatchObject({ ok: false, code: "CANDIDATE_LIMIT" });
  });

  it("withdraws eligibility immediately and old evidence cannot restore the place", async () => {
    const session = create();
    const old = body(session);
    const pinned = Object.values(old.evidence);
    session.updateDraft(curator, old.id, old);
    session.submit(curator, old.id);
    expect(
      session.withdraw(curator, old.id, "Penarikan darurat simulasi."),
    ).toEqual({ ok: true });
    expect(session.getRepository().isCurrent(pinned)).toBe(false);
    expect(
      (await session.getRepository().list("palembang")).some(
        (entry) => entry.id === old.id,
      ),
    ).toBe(false);
    expect(
      session.review(
        reviewer,
        old.id,
        "approve",
        "Draf lama tidak boleh hidup.",
      ),
    ).toMatchObject({ ok: false, code: "INVALID_STATE" });
    session.updateDraft(curator, old.id, old);
    session.submit(curator, old.id);
    expect(
      session.review(
        reviewer,
        old.id,
        "approve",
        "Coba menghidupkan bukti lama.",
      ),
    ).toMatchObject({ ok: false, code: "EVIDENCE_REQUIRED" });
  });

  it("a superseded assertion cannot be republished by replaying an older fixture body", () => {
    const session = create();
    const old = body(session);
    session.updateDraft(curator, old.id, {
      ...old,
      name: "Klaim baru · sintetis",
    });
    expect(approve(session)).toEqual({ ok: true });
    session.updateDraft(curator, old.id, old);
    session.submit(curator, old.id);
    expect(
      session.review(
        reviewer,
        old.id,
        "approve",
        "Coba memutar ulang klaim usang.",
      ),
    ).toMatchObject({ ok: false, code: "EVIDENCE_REQUIRED" });
  });

  it("revokes every field sharing a source and prevents old-draft review from reviving it", () => {
    const session = create();
    const old = body(session);
    session.updateDraft(curator, old.id, old);
    session.submit(curator, old.id);
    expect(
      session.revokeEvidence(
        reviewer,
        old.id,
        "hours",
        "Sumber fixture dicabut.",
      ),
    ).toEqual({ ok: true });
    expect(session.getRepository().isCurrent(Object.values(old.evidence))).toBe(
      false,
    );
    expect(session.getSnapshot().records[0].eligibilityIssues).toHaveLength(
      EDITORIAL_FIELDS.length,
    );
    expect(
      session.review(
        reviewer,
        old.id,
        "approve",
        "Tidak boleh memakai sumber dicabut.",
      ),
    ).toMatchObject({ ok: false, code: "EVIDENCE_REQUIRED" });
  });

  it("may publish a fresh corrected synthetic source after withdrawal, with new immutable authority", async () => {
    const session = create();
    const fresh = body(session);
    session.withdraw(reviewer, fresh.id, "Koreksi memerlukan sumber baru.");
    for (const field of EDITORIAL_FIELDS) {
      fresh.evidence[field].sourceId =
        `fixture-corrected-source:${fresh.id}:${field}`;
      fresh.evidence[field].assertionId =
        `${fresh.id}:${field}:corrected-input`;
      fresh.evidence[field].currentAssertionId =
        fresh.evidence[field].assertionId;
    }
    session.updateDraft(curator, fresh.id, fresh);
    expect(approve(session)).toEqual({ ok: true });
    const active = (await session.getRepository().list("palembang"))[0];
    expect(
      session.getRepository().isCurrent(Object.values(active.evidence)),
    ).toBe(true);
    expect(active.evidence.hours.fieldHeadRevision).toBeGreaterThan(1);
  });

  it("guards malformed actor, field and catalogue constructor boundaries", () => {
    const session = create();
    expect(
      session.revokeEvidence(
        curator,
        "syn-history-01",
        "not-a-field" as "hours",
        "Reason present.",
      ),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(
      session.updateDraft(
        { id: "real-user", role: "curator" },
        "syn-history-01",
        body(session),
      ),
    ).toMatchObject({ ok: false, code: "ROLE_DENIED" });
    expect(() =>
      createEditorialSession({
        initialPlaces: [SYNTHETIC_PLACES[0], SYNTHETIC_PLACES[0]],
      }),
    ).toThrow("unique IDs");
    expect(() =>
      createEditorialSession({
        initialPlaces: Array.from({ length: 61 }, (_, i) =>
          createSyntheticDraft(`syn-initial-${i}`, `Entry ${i}`),
        ),
      }),
    ).toThrow("at most 60");
  });
});

describe("editorial current-head integration with planner and frozen B2 history", () => {
  it("withdraws scheduled claims/totals while retaining the exact frozen historical body", async () => {
    const session = create();
    const deps = dependencies(session);
    const original = await planItinerary(preferences(), deps);
    expect(original.status).toBe("validated");
    expect(original.cost.totalUpperIdr).toBe(280500);
    const editing = createLocalEditingSession(original, deps);
    const frozen = editing.getSnapshot().current;
    const originalJson = JSON.stringify(frozen);
    const unsubscribe = session.subscribe(editing.refreshEvidence);
    session.withdraw(
      curator,
      "syn-history-01",
      "Demo penarikan setelah perencanaan.",
    );
    expect(JSON.stringify(frozen)).toBe(originalJson);
    expect(Object.isFrozen(frozen.result.days[0].stops[0])).toBe(true);
    const current = editing.getSnapshot().current;
    expect(current.id).toBe(frozen.id);
    expect(current.availability).toBe("withdrawn");
    expect(current.result.days).toHaveLength(0);
    expect(current.result.cost.totalUpperIdr).toBeNull();
    expect(current.result.recommendation?.rankings ?? []).toHaveLength(0);
    const fresh = await planItinerary(preferences(), deps);
    expect(
      fresh.days
        .flatMap((day) => day.stops)
        .every((stop) => stop.placeId !== "syn-history-01"),
    ).toBe(true);
    expect(
      fresh.recommendation?.rankings.every(
        (entry) => entry.placeId !== "syn-history-01",
      ),
    ).toBe(true);
    unsubscribe();
  });

  it("suppresses old current claims when a new approved body supersedes evidence", async () => {
    const session = create();
    const deps = dependencies(session);
    const original = await planItinerary(preferences(), deps);
    const editing = createLocalEditingSession(original, deps);
    const snapshot = editing.getSnapshot();
    const old = body(session);
    session.updateDraft(curator, old.id, {
      ...old,
      price: { ...old.price, lower: 30000, upper: 30000 },
    });
    expect(approve(session)).toEqual({ ok: true });
    editing.refreshEvidence();
    expect(snapshot.current.result.cost.totalUpperIdr).toBe(280500);
    expect(editing.getSnapshot().current.result.cost.totalUpperIdr).toBeNull();
    const replanned = await planItinerary(preferences(), {
      ...deps,
      selection: original.days.map((day) => ({
        date: day.date,
        stops: day.stops.map((stop) => ({
          id: stop.id,
          placeId: stop.placeId,
          lockedStartMinute: null,
          lockedDurationMinutes: null,
        })),
      })),
    });
    expect(replanned.status).toBe("validated");
    expect(replanned.cost.totalUpperIdr).toBe(291500);
  });

  it("does not invent routing for newly published synthetic destinations", async () => {
    const session = create();
    const added = createSyntheticDraft(
      "syn-editorial-no-route",
      "Destinasi tanpa rute",
      "culture",
    );
    session.createDraft(curator, added);
    expect(approve(session, added.id)).toEqual({ ok: true });
    const input = preferences();
    const plan = await planItinerary(input, {
      ...dependencies(session),
      selection: [
        {
          date: input.dates[0],
          stops: [added.id, "syn-food-01"].map((placeId, index) => ({
            id: `editorial-stop-${index}`,
            placeId,
            lockedStartMinute: null,
            lockedDurationMinutes: null,
          })),
        },
      ],
    });
    expect(plan.status).toBe("draft");
    expect(plan.issues.some((issue) => issue.code.includes("ROUTE"))).toBe(
      true,
    );
    expect(plan.days[0].legs.some((leg) => leg.status === "unknown")).toBe(
      true,
    );
  });
});
