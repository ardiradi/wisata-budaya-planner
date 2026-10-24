import { describe, expect, it } from "vitest";
import {
  createLocalEditingSession,
  submissionFromRevision,
} from "@/application/editing/local-session";
import { buildSyntheticScenario } from "@/application/planning/preview-planner";
import type { CatalogueRepository, EvidenceRef } from "@/domain/contracts";
import { normalizePreferences } from "@/domain/normalization";
import { planItinerary } from "@/domain/planner";
import { getSyntheticRouting } from "@/infrastructure/synthetic/routing";
import {
  getLocalRepository,
  SYNTHETIC_MEAL_ALLOWANCE,
} from "@/infrastructure/synthetic/catalogue";
import { SYNTHETIC_MEAL_SERVICES } from "@/infrastructure/synthetic/meal-services";
import { createEditorialSession, SIMULATED_CURATOR } from "./session";

const AS_OF = "2026-10-23T10:00:00.000Z";
function mealPreferences() {
  const submission = buildSyntheticScenario("feasible", "2026-10-23");
  submission.days[0].meals.lunch.scheduling = {
    mode: "scheduled",
    serviceId: "syn-meal-service-food-01",
    window: { start: "12:00", end: "13:00" },
    windowConfirmed: true,
  };
  const normalized = normalizePreferences(
    { ...submission.input, cityId: "palembang", days: submission.days },
    { today: "2026-10-23" },
  );
  if (!normalized.ok) throw new Error("Invalid synthetic meal fixture.");
  return normalized.value;
}
const dependencies = (repository: CatalogueRepository) => ({
  repository,
  routing: getSyntheticRouting(),
  evaluatedAt: AS_OF,
  now: () => 0,
});

describe("E2 meals across editorial authority and immutable revisions", () => {
  it("keeps service-backed dietary meals available through editing when generic allowance suitability is unknown", async () => {
    const input = mealPreferences();
    input.dietaryRequirement = "halal";
    input.days[0].meals.forEach((meal, index) => {
      meal.scheduling = {
        mode: "scheduled",
        serviceId: `syn-meal-service-food-0${index + 1}`,
        window: {
          startMinute: [480, 720, 960][index],
          endMinute: [540, 780, 1020][index],
        },
        windowConfirmed: true,
      };
    });
    const allowance = structuredClone(SYNTHETIC_MEAL_ALLOWANCE);
    allowance.dietaryEvidence.state = "unknown";
    const deps = dependencies(getLocalRepository({ allowance }));
    const result = await planItinerary(input, deps);
    expect(result.status).toBe("validated");
    expect(result.issues).toEqual([]);
    expect(
      result.days[0].meals.every(
        (meal) => meal.schedulingStatus === "scheduled",
      ),
    ).toBe(true);
    expect(
      result.evidenceRefs.some(
        (ref) => ref.assertionId === allowance.dietaryEvidence.assertionId,
      ),
    ).toBe(false);
    expect(
      result.evidenceRefs.some(
        (ref) => ref.assertionId === allowance.evidence.assertionId,
      ),
    ).toBe(true);
    const editing = createLocalEditingSession(result, deps);
    expect(editing.getSnapshot().current.availability).toBe("available");
    const original = editing.getSnapshot().current;
    const originalBody = JSON.stringify(original);
    const submission = submissionFromRevision(original);
    submission.input.budget = "1600000";
    await editing.previewPreferences(original.id, submission);
    const preview = editing.getSnapshot().preview!;
    expect(preview.proposed.result.status).toBe("validated");
    await editing.commit(preview.id);
    expect(editing.getSnapshot().current.availability).toBe("available");
    expect(editing.getSnapshot().history).toHaveLength(2);
    expect(JSON.stringify(original)).toBe(originalBody);
  });

  it("does not pin unused service dietary/access fields, while every required field stays authoritative", async () => {
    const services = structuredClone(SYNTHETIC_MEAL_SERVICES);
    services[0].evidence.dietary.state = "unknown";
    services[0].evidence.accessibility.state = "unknown";
    const deps = dependencies(getLocalRepository({ mealServices: services }));
    const result = await planItinerary(mealPreferences(), deps);
    expect(result.status).toBe("validated");
    const lunch = result.days[0].meals.find((meal) => meal.id === "lunch")!;
    expect(
      lunch.evidenceRefs
        .filter((ref) => ref.sourceId === `fixture-source:${lunch.serviceId}`)
        .map((ref) => ref.field),
    ).toEqual(["location", "service", "portions", "charges"]);
    const editing = createLocalEditingSession(result, deps);
    editing.refreshEvidence();
    expect(editing.getSnapshot().current.availability).toBe("available");

    services[0].evidence.portions.state = "unknown";
    const missingPortions = await planItinerary(
      mealPreferences(),
      dependencies(getLocalRepository({ mealServices: services })),
    );
    expect(missingPortions.status).toBe("draft");
    expect(
      missingPortions.issues.some(
        (issue) => issue.code === "MEAL_SERVICE_EVIDENCE_UNKNOWN",
      ),
    ).toBe(true);
  });

  it("keeps allowance price evidence essential even when a scheduled service supplies dietary suitability", async () => {
    const allowance = structuredClone(SYNTHETIC_MEAL_ALLOWANCE);
    allowance.evidence.state = "unknown";
    const result = await planItinerary(
      mealPreferences(),
      dependencies(getLocalRepository({ allowance })),
    );
    expect(result.status).toBe("draft");
    expect(result.cost.totalUpperIdr).toBeNull();
    expect(
      result.issues.some((issue) => issue.code === "MEAL_PRICE_UNKNOWN"),
    ).toBe(true);
  });

  it("uses separate service heads without creating a simulated or independent approval", async () => {
    const editorial = createEditorialSession({ now: () => AS_OF });
    const repo = editorial.getRepository();
    const services = await repo.listMealServices!();
    const result = await planItinerary(mealPreferences(), dependencies(repo));
    expect(result.status).toBe("validated");
    const lunch = result.days[0].meals.find((meal) => meal.id === "lunch")!;
    expect(lunch).toMatchObject({
      schedulingStatus: "scheduled",
      placeId: "syn-food-01",
      startMinute: 720,
      endMinute: 750,
      necessary: 2,
      purchased: 2,
    });
    expect(repo.isCurrent(lunch.evidenceRefs)).toBe(true);
    expect(services.every((service) => !service.independentlyReviewed)).toBe(
      true,
    );
    expect(
      editorial
        .getSnapshot()
        .events.every((event) => event.action === "baseline_fixture"),
    ).toBe(true);
    services[0].evidence.service.state = "revoked";
    expect((await repo.listMealServices!())[0].evidence.service.state).toBe(
      "fixture",
    );
  });

  it("suppresses a scheduled meal after venue withdrawal while the frozen historical body stays exact", async () => {
    const editorial = createEditorialSession({ now: () => AS_OF });
    const deps = dependencies(editorial.getRepository());
    const result = await planItinerary(mealPreferences(), deps);
    expect(result.status).toBe("validated");
    const editing = createLocalEditingSession(result, deps);
    const original = editing.getSnapshot().current;
    const frozen = JSON.stringify(original);
    expect(
      editorial.withdraw(
        SIMULATED_CURATOR,
        "syn-food-01",
        "Penarikan layanan dan lokasi sintetis.",
      ),
    ).toEqual({ ok: true });
    editing.refreshEvidence();
    expect(editing.getSnapshot().current).toMatchObject({
      id: original.id,
      availability: "withdrawn",
      result: { status: "draft", days: [], cost: { totalUpperIdr: null } },
    });
    expect(JSON.stringify(original)).toBe(frozen);
    expect(
      original.result.days[0].meals.find((meal) => meal.id === "lunch")!
        .schedulingStatus,
    ).toBe("scheduled");
  });

  it("rejects a pending commit when separate service evidence is revoked, without appending a revision", async () => {
    const editorial = createEditorialSession({ now: () => AS_OF });
    const source = editorial.getRepository();
    let revoked = false;
    const isService = (ref: EvidenceRef) =>
      ref.fieldHeadId.startsWith("syn-meal-service-");
    const repo: CatalogueRepository = {
      ...source,
      isCurrent: (refs) =>
        source.isCurrent(refs) && !(revoked && refs.some(isService)),
    };
    const deps = dependencies(repo);
    const result = await planItinerary(mealPreferences(), deps);
    expect(result.status).toBe("validated");
    const editing = createLocalEditingSession(result, deps);
    const original = editing.getSnapshot().current;
    const submission = submissionFromRevision(original);
    submission.input.budget = "1600000";
    await editing.previewPreferences(original.id, submission);
    const preview = editing.getSnapshot().preview!;
    expect(preview.proposed.result.status).toBe("validated");
    expect(submission.days[0].meals.lunch.scheduling).toMatchObject({
      mode: "scheduled",
      window: { start: "12:00", end: "13:00" },
    });
    revoked = true;
    await editing.commit(preview.id);
    expect(editing.getSnapshot().history).toHaveLength(1);
    expect(editing.getSnapshot().current.id).toBe(original.id);
    expect(editing.getSnapshot().current.availability).toBe("withdrawn");
    expect(original.result.status).toBe("validated");
    expect(Object.isFrozen(original.result.days[0].meals)).toBe(true);
  });

  it("keeps a locked service visit and last valid revision when a new requested window conflicts", async () => {
    const editorial = createEditorialSession({ now: () => AS_OF });
    const deps = dependencies(editorial.getRepository());
    const result = await planItinerary(mealPreferences(), deps);
    const editing = createLocalEditingSession(result, deps);
    const first = editing.getSnapshot().current;
    const food = first.intent.days[0].stops.find(
      (stop) => stop.placeId === "syn-food-01",
    )!;
    await editing.previewEdit(first.id, {
      type: "lock",
      stopId: food.id,
      locked: true,
    });
    await editing.commit(editing.getSnapshot().preview!.id);
    const locked = editing.getSnapshot().current;
    const originalBody = JSON.stringify(locked);
    const submission = submissionFromRevision(locked);
    submission.days[0].meals.lunch.scheduling = {
      mode: "scheduled",
      serviceId: "syn-meal-service-food-01",
      window: { start: "13:00", end: "14:00" },
      windowConfirmed: true,
    };
    await editing.previewPreferences(locked.id, submission);
    const preview = editing.getSnapshot().preview!;
    expect(preview.proposed.result.status).toBe("blocked");
    expect(
      preview.proposed.result.issues.some(
        (issue) => issue.code === "MEAL_SCHEDULE_CONFLICT",
      ),
    ).toBe(true);
    expect(
      preview.proposed.intent.days[0].stops.find((stop) => stop.id === food.id)!
        .lock,
    ).toEqual(
      locked.intent.days[0].stops.find((stop) => stop.id === food.id)!.lock,
    );
    await editing.commit(preview.id);
    expect(editing.getSnapshot().current.id).toBe(locked.id);
    expect(editing.getSnapshot().lastValidRevisionId).toBe(locked.id);
    expect(editing.getSnapshot().history).toHaveLength(2);
    expect(JSON.stringify(locked)).toBe(originalBody);
  });
});
