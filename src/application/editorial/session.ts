import { z } from "zod";
import {
  EvidenceRefSchema,
  SyntheticPlaceSchema,
  type CatalogueRepository,
  type EvidenceRef,
  type SyntheticPlace,
} from "@/domain/contracts";
import { evaluateEvidence } from "@/domain/evidence";
import {
  EDITORIAL_FIELDS,
  EditorialActorSchema,
  EditorialFieldSchema,
  type EditorialActionResult,
  type EditorialActor,
  type EditorialEvent,
  type EditorialField,
  type EditorialRecord,
  type EditorialSnapshot,
} from "@/domain/editorial/contracts";
import {
  SYNTHETIC_MEAL_ALLOWANCE,
  SYNTHETIC_PLACES,
} from "@/infrastructure/synthetic/catalogue";
import { fixtureEvidence } from "@/infrastructure/synthetic/evidence-fixture";
import { SYNTHETIC_MEAL_SERVICES } from "@/infrastructure/synthetic/meal-services";

export {
  SIMULATED_CURATOR,
  SIMULATED_REVIEWER,
} from "@/domain/editorial/contracts";
export type {
  EditorialActor,
  EditorialSnapshot,
  EditorialRecord,
  EditorialActionResult,
} from "@/domain/editorial/contracts";

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
const copy = <T>(value: T): T => structuredClone(value);
const failure = (code: string, message: string): EditorialActionResult => ({
  ok: false,
  code,
  message,
});
const success: EditorialActionResult = Object.freeze({ ok: true });
const NoteSchema = z.string().trim().min(3).max(300);

/** Creates engineering fixtures, never a real identity or independently approved claim. */
export function createSyntheticDraft(
  id: string,
  name: string,
  kind: "culture" | "food" = "culture",
): SyntheticPlace {
  const template = copy(SYNTHETIC_PLACES.find((place) => place.kind === kind)!);
  return SyntheticPlaceSchema.parse({
    ...template,
    id,
    name: name.includes("sintetis") ? name : `${name} · sintetis`,
    evidence: Object.fromEntries(
      EDITORIAL_FIELDS.map((field) => [field, fixtureEvidence(id, field)]),
    ),
  });
}

export type EditorialSession = ReturnType<typeof createEditorialSession>;

/** Local role-play only. Actor selection is not authentication or real review approval. */
export function createEditorialSession(
  options: {
    now?: () => string;
    initialPlaces?: readonly SyntheticPlace[];
  } = {},
) {
  const now = options.now ?? (() => new Date().toISOString());
  const initial = (options.initialPlaces ?? SYNTHETIC_PLACES).map((place) =>
    SyntheticPlaceSchema.parse(copy(place)),
  );
  if (
    initial.length > 60 ||
    new Set(initial.map((place) => place.id)).size !== initial.length
  )
    throw new Error(
      "Synthetic catalogue requires unique IDs and at most 60 entries.",
    );
  let sequence = 0;
  let revision = 0;
  const records = new Map<string, EditorialRecord>();
  const events: EditorialEvent[] = [];
  const heads = new Map<string, EvidenceRef>();
  const revokedAssertions = new Set<string>();
  const revokedSources = new Set<string>();
  const listeners = new Set<() => void>();
  let snapshot: EditorialSnapshot;

  function event(
    placeId: string,
    action: EditorialEvent["action"],
    actor: EditorialActor | null,
    note: string,
  ) {
    const entry: EditorialEvent = freeze({
      id: `synthetic-editorial-event-${++sequence}`,
      sequence,
      at: now(),
      placeId,
      action,
      actorId: actor?.id ?? "system-fixture",
      actorRole: actor?.role ?? "system",
      note,
      synthetic: true,
      independentlyReviewed: false,
    });
    events.push(entry);
    records.get(placeId)?.events.push(entry);
  }
  function issues(place: SyntheticPlace | null): string[] {
    if (!place) return ["Draf belum tersedia."];
    const asOf = now();
    const today = asOf.slice(0, 10);
    return EDITORIAL_FIELDS.flatMap((field) => {
      const ref = place.evidence[field];
      const bound =
        ref.field === field && ref.fieldHeadId === `${place.id}:${field}:head`;
      const usable = evaluateEvidence(ref, today, asOf).usable;
      return bound &&
        usable &&
        !revokedAssertions.has(ref.assertionId) &&
        !revokedSources.has(ref.sourceId)
        ? []
        : [
            `${field}: bukti sintetis hilang, tidak berlaku, bertentangan, atau dicabut.`,
          ];
    });
  }
  function publishSnapshot() {
    snapshot = freeze(
      copy({
        revision,
        records: [...records.values()].map((record) => ({
          ...record,
          eligibilityIssues: issues(record.draft ?? record.active),
        })),
        events,
        synthetic: true as const,
        independentlyReviewed: false as const,
      }),
    );
    listeners.forEach((listener) => listener());
  }
  function actor(value: unknown): EditorialActor | null {
    const parsed = EditorialActorSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }
  function validatePlace(
    value: unknown,
    expectedId?: string,
  ): SyntheticPlace | null {
    const parsed = SyntheticPlaceSchema.safeParse(value);
    if (!parsed.success || (expectedId && parsed.data.id !== expectedId))
      return null;
    const place = parsed.data;
    if (
      EDITORIAL_FIELDS.some(
        (field) =>
          place.evidence[field].field !== field ||
          place.evidence[field].fieldHeadId !== `${place.id}:${field}:head` ||
          !place.evidence[field].sourceId.startsWith("fixture-"),
      )
    )
      return null;
    if (!place.name.toLocaleLowerCase("id").includes("sintetis")) return null;
    if (
      new Set(place.categoryIds).size !== place.categoryIds.length ||
      new Set(place.foodTags).size !== place.foodTags.length
    )
      return null;
    if (
      place.kind === "food"
        ? place.categoryIds.length !== 0
        : place.categoryIds.length === 0
    )
      return null;
    return place;
  }
  function stage(place: SyntheticPlace): SyntheticPlace {
    // A draft revision is new evidence, never an in-place mutation of pinned facts.
    return SyntheticPlaceSchema.parse({
      ...place,
      evidence: Object.fromEntries(
        EDITORIAL_FIELDS.map((field) => {
          const source = place.evidence[field];
          const current = heads.get(`${place.id}:${field}:head`);
          const nextRevision =
            Math.max(
              source.fieldHeadRevision,
              current?.fieldHeadRevision ?? 0,
            ) + 1;
          const assertion = `${place.id}:${field}:draft-${revision + 1}`;
          const review = `${place.id}:${field}:simulated-check-${revision + 1}`;
          const revoked =
            source.sourceRevoked ||
            source.state === "revoked" ||
            revokedAssertions.has(source.assertionId) ||
            revokedSources.has(source.sourceId);
          return [
            field,
            {
              ...source,
              field,
              fieldHeadId: `${place.id}:${field}:head`,
              assertionId: assertion,
              currentAssertionId: assertion,
              fieldHeadRevision: nextRevision,
              reviewId: review,
              currentReviewId: review,
              reviewSequence: nextRevision,
              currentReviewSequence: nextRevision,
              state: revoked
                ? "revoked"
                : source.assertionId !== source.currentAssertionId ||
                    source.reviewId !== source.currentReviewId ||
                    source.reviewSequence !== source.currentReviewSequence
                  ? "conflicted"
                  : source.state,
              sourceRevoked: revoked,
            },
          ];
        }),
      ),
    });
  }

  for (const place of initial) {
    records.set(place.id, {
      id: place.id,
      status: "baseline_fixture",
      active: place,
      draft: null,
      contributorId: null,
      events: [],
      eligibilityIssues: [],
    });
    Object.values(place.evidence).forEach((ref) =>
      heads.set(ref.fieldHeadId, copy(ref)),
    );
    event(
      place.id,
      "baseline_fixture",
      null,
      "Fixture awal untuk pengujian; bukan persetujuan atau peninjauan manusia.",
    );
  }
  for (const ref of [
    SYNTHETIC_MEAL_ALLOWANCE.evidence,
    SYNTHETIC_MEAL_ALLOWANCE.dietaryEvidence,
    SYNTHETIC_MEAL_ALLOWANCE.accessibilityEvidence,
    ...SYNTHETIC_MEAL_SERVICES.flatMap((service) =>
      Object.values(service.evidence),
    ),
  ])
    heads.set(ref.fieldHeadId, copy(ref));
  publishSnapshot();

  const repository: CatalogueRepository = {
    get version() {
      return `synthetic-editorial-v${revision}`;
    },
    async list(cityId) {
      return copy(
        [...records.values()].flatMap((record) =>
          record.active?.cityId === cityId ? [record.active] : [],
        ),
      );
    },
    async getMealAllowance() {
      return copy(SYNTHETIC_MEAL_ALLOWANCE);
    },
    async listMealServices() {
      // Engineering fixtures only. Venue eligibility and these separate service heads
      // are both rechecked; editorial role-play cannot turn them into real approval.
      return copy([...SYNTHETIC_MEAL_SERVICES]);
    },
    isCurrent(refs) {
      return refs.every((raw) => {
        const parsed = EvidenceRefSchema.safeParse(raw);
        if (!parsed.success) return false;
        const ref = parsed.data;
        const head = heads.get(ref.fieldHeadId);
        return Boolean(
          head &&
          head.published &&
          head.state === "fixture" &&
          !head.sourceRevoked &&
          ref.published &&
          ref.state === "fixture" &&
          !ref.sourceRevoked &&
          ref.assertionId === ref.currentAssertionId &&
          ref.reviewId === ref.currentReviewId &&
          ref.reviewSequence === ref.currentReviewSequence &&
          !revokedAssertions.has(ref.assertionId) &&
          !revokedSources.has(ref.sourceId) &&
          head.assertionId === ref.assertionId &&
          head.reviewId === ref.reviewId &&
          head.fieldHeadRevision === ref.fieldHeadRevision &&
          head.reviewSequence === ref.reviewSequence &&
          head.publicationRevision === ref.publicationRevision &&
          head.sourceId === ref.sourceId &&
          head.sourcePolicyId === ref.sourcePolicyId,
        );
      });
    },
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getRepository: () => repository,
    createDraft(rawActor: unknown, value: unknown): EditorialActionResult {
      const who = actor(rawActor);
      if (!who || who.role !== "curator")
        return failure(
          "ROLE_DENIED",
          "Hanya kurator simulasi yang dapat membuat draf.",
        );
      const place = validatePlace(value);
      if (!place)
        return failure(
          "INVALID_PLACE",
          "Isi destinasi atau bukti tidak sah; gunakan data berlabel sintetis.",
        );
      if (records.has(place.id))
        return failure("DUPLICATE_ID", "ID destinasi sudah digunakan.");
      if (records.size >= 60)
        return failure(
          "CANDIDATE_LIMIT",
          "Batas 60 kandidat tidak boleh dilampaui.",
        );
      records.set(place.id, {
        id: place.id,
        status: "draft",
        active: null,
        draft: stage(place),
        contributorId: who.id,
        events: [],
        eligibilityIssues: [],
      });
      revision++;
      event(
        place.id,
        "created",
        who,
        "Draf sintetis dibuat; belum menjadi kandidat aktif.",
      );
      publishSnapshot();
      return success;
    },
    updateDraft(
      rawActor: unknown,
      placeId: string,
      value: unknown,
    ): EditorialActionResult {
      const who = actor(rawActor);
      if (!who || who.role !== "curator")
        return failure(
          "ROLE_DENIED",
          "Hanya kurator simulasi yang dapat mengedit draf.",
        );
      const record = records.get(placeId);
      if (!record) return failure("NOT_FOUND", "Destinasi tidak ditemukan.");
      const place = validatePlace(value, placeId);
      if (!place)
        return failure(
          "INVALID_PLACE",
          "Perubahan destinasi atau bukti tidak sah.",
        );
      record.draft = stage(place);
      record.contributorId = who.id;
      record.status = "draft";
      revision++;
      event(
        placeId,
        "edited",
        who,
        "Draf baru disimpan dalam memori; publikasi aktif belum diganti.",
      );
      publishSnapshot();
      return success;
    },
    submit(rawActor: unknown, placeId: string): EditorialActionResult {
      const who = actor(rawActor);
      const record = records.get(placeId);
      if (!who || who.role !== "curator")
        return failure(
          "ROLE_DENIED",
          "Hanya kurator simulasi dapat mengajukan draf.",
        );
      if (!record?.draft || !["draft", "rejected"].includes(record.status))
        return failure(
          "INVALID_STATE",
          "Simpan draf sebelum mengajukan tinjauan.",
        );
      record.status = "submitted";
      revision++;
      event(
        placeId,
        "submitted",
        who,
        "Diajukan ke antrean peninjau simulasi; tidak membuktikan persetujuan manusia.",
      );
      publishSnapshot();
      return success;
    },
    review(
      rawActor: unknown,
      placeId: string,
      decision: "approve" | "reject",
      note: string,
    ): EditorialActionResult {
      const who = actor(rawActor);
      const record = records.get(placeId);
      if (!who) return failure("ROLE_DENIED", "Aktor simulasi tidak sah.");
      if (record?.contributorId === who.id)
        return failure(
          "SELF_APPROVAL",
          "Kontributor tidak dapat meninjau karyanya sendiri.",
        );
      if (who.role !== "reviewer")
        return failure(
          "ROLE_DENIED",
          "Tinjauan memerlukan peninjau simulasi yang berbeda.",
        );
      if (
        !NoteSchema.safeParse(note).success ||
        !["approve", "reject"].includes(decision)
      )
        return failure(
          "INVALID_REVIEW",
          "Pilih keputusan dan isi catatan tinjauan 3–300 karakter.",
        );
      if (!record?.draft || record.status !== "submitted")
        return failure(
          "INVALID_STATE",
          "Hanya draf yang diajukan dapat ditinjau.",
        );
      if (decision === "approve" && issues(record.draft).length)
        return failure(
          "EVIDENCE_REQUIRED",
          "Publikasi diblokir: seluruh bidang memerlukan bukti sintetis yang berlaku dan tidak dicabut.",
        );
      revision++;
      if (decision === "approve") {
        record.active = SyntheticPlaceSchema.parse({
          ...record.draft,
          evidence: Object.fromEntries(
            EDITORIAL_FIELDS.map((field) => {
              const ref = record.draft!.evidence[field];
              const oldHead = heads.get(ref.fieldHeadId);
              if (oldHead) revokedAssertions.add(oldHead.assertionId);
              const publicationRevision =
                (oldHead?.publicationRevision ?? 0) + 1;
              const published = { ...ref, publicationRevision };
              heads.set(ref.fieldHeadId, copy(published));
              return [field, published];
            }),
          ),
        });
        record.draft = null;
        record.status = "approved";
      } else record.status = "rejected";
      event(
        placeId,
        decision === "approve" ? "approved" : "rejected",
        who,
        note.trim(),
      );
      publishSnapshot();
      return success;
    },
    withdraw(
      rawActor: unknown,
      placeId: string,
      note: string,
    ): EditorialActionResult {
      const who = actor(rawActor);
      const record = records.get(placeId);
      if (!who) return failure("ROLE_DENIED", "Aktor simulasi tidak sah.");
      if (!record?.active)
        return failure(
          "INVALID_STATE",
          "Tidak ada publikasi aktif yang dapat ditarik.",
        );
      if (!NoteSchema.safeParse(note).success)
        return failure(
          "REASON_REQUIRED",
          "Catat alasan penarikan 3–300 karakter.",
        );
      revision++;
      for (const ref of Object.values(record.active.evidence)) {
        revokedAssertions.add(ref.assertionId);
        revokedSources.add(ref.sourceId);
        const tombstone = {
          ...ref,
          assertionId: `${ref.fieldHeadId}:withdrawn-${revision}`,
          currentAssertionId: `${ref.fieldHeadId}:withdrawn-${revision}`,
          fieldHeadRevision: ref.fieldHeadRevision + 1,
          publicationRevision: ref.publicationRevision + 1,
          reviewId: `${ref.fieldHeadId}:withdrawal-${revision}`,
          currentReviewId: `${ref.fieldHeadId}:withdrawal-${revision}`,
          reviewSequence: ref.reviewSequence + 1,
          currentReviewSequence: ref.reviewSequence + 1,
          state: "revoked" as const,
          sourceRevoked: true,
          published: false,
        };
        heads.set(ref.fieldHeadId, tombstone);
      }
      if (record.draft)
        Object.values(record.draft.evidence).forEach((ref) =>
          revokedAssertions.add(ref.assertionId),
        );
      // Old drafts cannot restore a withdrawn assertion through approval.
      record.draft = null;
      record.active = null;
      record.status = "withdrawn";
      event(placeId, "withdrawn", who, note.trim());
      publishSnapshot();
      return success;
    },
    revokeEvidence(
      rawActor: unknown,
      placeId: string,
      rawField: EditorialField,
      note: string,
    ): EditorialActionResult {
      const who = actor(rawActor);
      const record = records.get(placeId);
      const parsedField = EditorialFieldSchema.safeParse(rawField);
      if (!who) return failure("ROLE_DENIED", "Aktor simulasi tidak sah.");
      if (!record || !parsedField.success)
        return failure("NOT_FOUND", "Destinasi atau bidang tidak ditemukan.");
      if (!NoteSchema.safeParse(note).success)
        return failure(
          "REASON_REQUIRED",
          "Catat alasan pencabutan 3–300 karakter.",
        );
      const field = parsedField.data;
      const ref =
        record.active?.evidence[field] ?? record.draft?.evidence[field];
      if (!ref) return failure("INVALID_STATE", "Bukti tidak tersedia.");
      revokedAssertions.add(ref.assertionId);
      revokedSources.add(ref.sourceId);
      // A source can support multiple fields. Revoke every linked field, never silently keep siblings active.
      for (const item of records.values())
        for (const body of [item.active, item.draft]) {
          if (!body) continue;
          for (const key of EDITORIAL_FIELDS)
            if (body.evidence[key].sourceId === ref.sourceId) {
              body.evidence[key] = {
                ...body.evidence[key],
                sourceRevoked: true,
                state: "revoked",
              };
              if (item.active === body)
                heads.set(
                  body.evidence[key].fieldHeadId,
                  copy(body.evidence[key]),
                );
            }
        }
      revision++;
      event(placeId, "evidence_revoked", who, `${field}: ${note.trim()}`);
      publishSnapshot();
      return success;
    },
  };
}
