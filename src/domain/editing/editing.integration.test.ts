import { describe, expect, it, vi } from "vitest";
import {
  createLocalEditingSession,
  listEligibleSwapOptions,
} from "@/application/editing/local-session";
import { buildSyntheticScenario } from "@/application/planning/preview-planner";
import {
  getLocalRepository,
  SYNTHETIC_PLACES,
} from "@/infrastructure/synthetic/catalogue";
import { getSyntheticRouting } from "@/infrastructure/synthetic/routing";
import { fixtureEvidence } from "@/infrastructure/synthetic/evidence-fixture";
import type {
  CatalogueRepository,
  NormalizedPreferences,
  RouteRequest,
  RoutingProvider,
  SyntheticPlace,
} from "../contracts";
import { addCalendarDays, normalizePreferences } from "../normalization";
import { planItinerary, type PlannerDependencies } from "../planner";
import type { PlanResult } from "../planner/types";

const today = "2026-10-23";
const evaluatedAt = "2026-10-23T00:00:00.000Z";
type Session = ReturnType<typeof createLocalEditingSession>;

function preferences(): NormalizedPreferences {
  const sample = buildSyntheticScenario("feasible", today);
  const input = normalizePreferences(
    { ...sample.input, cityId: "palembang", days: sample.days },
    { today },
  );
  if (!input.ok) throw new Error(JSON.stringify(input.issues));
  return input.value;
}

async function setup(
  options: {
    input?: NormalizedPreferences;
    repository?: CatalogueRepository;
    routing?: RoutingProvider;
    now?: () => number;
  } = {},
) {
  const input = options.input ?? preferences();
  const requests: RouteRequest[] = [];
  const router = options.routing ?? getSyntheticRouting();
  const routing: RoutingProvider = {
    id: "instrumented-edit-fixture",
    ...(router.isCurrent ? { isCurrent: router.isCurrent.bind(router) } : {}),
    async resolve(request) {
      requests.push(structuredClone(request));
      return router.resolve(request);
    },
  };
  const repository = options.repository ?? getLocalRepository();
  const dependencies: PlannerDependencies = {
    repository,
    routing,
    evaluatedAt,
    now: options.now ?? (() => 0),
  };
  const initial = await planItinerary(input, dependencies);
  expect(initial.status).toBe("validated");
  const session = createLocalEditingSession(initial, dependencies);
  requests.length = 0;
  return { session, initial, input, requests, repository, dependencies };
}

function preview(session: Session) {
  const proposed = session.getSnapshot().preview;
  expect(proposed).not.toBeNull();
  if (!proposed) throw new Error("Expected a completed edit preview.");
  return proposed;
}
function codes(result: PlanResult) {
  return result.issues.map((issue) => issue.code);
}
async function commitPreview(session: Session, allowNonValidated = false) {
  const proposed = preview(session);
  await session.commit(proposed.id, { allowNonValidated });
  return session.getSnapshot();
}
function firstStop(session: Session) {
  return session.getSnapshot().current.result.days[0].stops[0];
}

describe("explicit editing and immutable before/after revisions", () => {
  it("offers only unused, evidence-current replacements preserving mandatory interest suitability", async () => {
    const { session, dependencies } = await setup();
    const revision = session.getSnapshot().current;
    const options = await listEligibleSwapOptions(
      revision,
      firstStop(session).id,
      dependencies,
    );
    expect(options.map((place) => place.id)).toContain("syn-culture-02");
    expect(options.map((place) => place.id)).not.toContain("syn-craft-01");
    expect(options.map((place) => place.id)).not.toContain("syn-history-01");
    expect(
      options.every((place) => place.categoryIds.includes("history-example")),
    ).toBe(true);
    const withdrawnRepository: CatalogueRepository = {
      ...dependencies.repository,
      isCurrent: () => false,
    };
    expect(
      await listEligibleSwapOptions(revision, firstStop(session).id, {
        ...dependencies,
        repository: withdrawnRepository,
      }),
    ).toEqual([]);
  });
  it("previews a successful eligible swap without changing current, then commits a new frozen revision", async () => {
    const { session, requests } = await setup();
    const original = session.getSnapshot().current;
    const before = JSON.stringify(original);
    const stopId = firstStop(session).id;
    await session.previewEdit(original.id, {
      type: "swap",
      stopId,
      placeId: "syn-culture-02",
    });
    const proposal = preview(session);
    expect(session.getSnapshot().current).toBe(original);
    expect(proposal.before.id).toBe(original.id);
    expect(proposal.proposed.result.status).toBe("validated");
    expect(proposal.proposed.result.days[0].stops[0]).toMatchObject({
      id: stopId,
      placeId: "syn-culture-02",
      startMinute: 540,
      endMinute: 600,
    });
    expect(proposal.proposed.result.cost.totalUpperIdr).toBe(302500);
    expect(original.result.cost.totalUpperIdr).toBe(280500);
    expect(requests).toHaveLength(3);
    const after = await commitPreview(session);
    expect(after.current.id).not.toBe(original.id);
    expect(after.current.parentId).toBe(original.id);
    expect(after.current.number).toBe(original.number + 1);
    expect(
      after.history.find((revision) => revision.id === original.id),
    ).toEqual(original);
    expect(JSON.stringify(original)).toBe(before);
    expect(Object.isFrozen(after.current)).toBe(true);
    expect(Object.isFrozen(after.current.result.days[0].stops[0])).toBe(true);
    expect(after.lastValidRevisionId).toBe(after.current.id);
    expect(after.preview).toBeNull();
  });

  it("blocks removal of the only mandatory cultural visit instead of silently replacing it", async () => {
    const { session } = await setup();
    const before = session.getSnapshot().current;
    await session.previewEdit(before.id, {
      type: "remove",
      stopId: firstStop(session).id,
    });
    const proposal = preview(session);
    expect(proposal.proposed.result.status).toBe("blocked");
    expect(
      proposal.proposed.result.days[0].stops.every(
        (stop) => stop.kind === "food",
      ),
    ).toBe(true);
    expect(proposal.proposed.result.coverage.missingCategoryIds).toContain(
      "history-example",
    );
    expect(session.getSnapshot().current).toBe(before);
    await session.commit(proposal.id, { allowNonValidated: false });
    expect(session.getSnapshot().current).toBe(before);
    expect(session.getSnapshot().history).toHaveLength(1);
  });

  it("retains necessary purchased meals after removing the culinary destination", async () => {
    const { session } = await setup();
    const before = session.getSnapshot().current;
    const food = before.result.days[0].stops.find(
      (stop) => stop.kind === "food",
    )!;
    await session.previewEdit(before.id, { type: "remove", stopId: food.id });
    const result = preview(session).proposed.result;
    expect(result.status).toBe("blocked");
    expect(result.days[0].culinaryCovered).toBe(false);
    expect(
      result.days[0].meals.reduce((sum, meal) => sum + meal.purchased, 0),
    ).toBe(4);
    expect(
      result.days[0].meals.reduce((sum, meal) => sum + meal.upperIdr!, 0),
    ).toBe(160000);
    expect(result.issues.some((issue) => issue.severity === "violation")).toBe(
      true,
    );
    expect(session.getSnapshot().lastValidRevisionId).toBe(before.id);
  });

  it("allows a nonvalidated revision only explicitly and preserves the earlier last-valid revision", async () => {
    const { session } = await setup();
    const original = session.getSnapshot().current;
    const input = structuredClone(original.input);
    input.budgetIdr = 10000;
    await session.previewEdit(original.id, { type: "preferences", input });
    const proposal = preview(session);
    expect(proposal.proposed.result.status).toBe("blocked");
    expect(codes(proposal.proposed.result)).toContain("BUDGET_EXCEEDED");
    expect(proposal.proposed.result.cost.totalUpperIdr).toBe(280500);
    await session.commit(proposal.id, { allowNonValidated: false });
    expect(session.getSnapshot().current.id).toBe(original.id);
    await session.commit(proposal.id, { allowNonValidated: true });
    const after = session.getSnapshot();
    expect(after.current.result.status).toBe("blocked");
    expect(after.lastValidRevisionId).toBe(original.id);
    expect(
      after.history.find((revision) => revision.id === original.id)?.result
        .status,
    ).toBe("validated");
    expect(
      after.current.result.days[0].meals.reduce(
        (sum, meal) => sum + meal.purchased,
        0,
      ),
    ).toBe(4);
  });

  it("recalculates exactly documented prepaid portions through the raw preference boundary", async () => {
    const { session } = await setup();
    const original = session.getSnapshot().current;
    const submission = buildSyntheticScenario("feasible", today);
    submission.days[0].meals.lunch.prepaid = 1;
    await session.previewPreferences(original.id, submission);
    const result = preview(session).proposed.result;
    expect(result.status).toBe("validated");
    expect(
      result.days[0].meals.find((meal) => meal.id === "lunch"),
    ).toMatchObject({
      necessary: 2,
      provided: 0,
      prepaid: 1,
      purchased: 1,
      upperIdr: 40000,
    });
    expect(
      result.days[0].meals.reduce((sum, meal) => sum + meal.purchased, 0),
    ).toBe(3);
    expect(result.cost.totalUpperIdr).toBe(236500);
    expect(
      original.result.days[0].meals.find((meal) => meal.id === "lunch")
        ?.purchased,
    ).toBe(2);
    expect(original.result.cost.totalUpperIdr).toBe(280500);
  });

  it("does not promote an edited meal inventory whose confirmation has been withdrawn", async () => {
    const { session } = await setup();
    const original = session.getSnapshot().current;
    const input = structuredClone(original.input);
    input.days[0].inventoryConfirmed = false;
    await session.previewEdit(original.id, { type: "preferences", input });
    const proposed = preview(session);
    expect(proposed.proposed.result.status).toBe("draft");
    expect(codes(proposed.proposed.result)).toContain(
      "MEAL_INVENTORY_UNCONFIRMED",
    );
    await session.commit(proposed.id, { allowNonValidated: false });
    expect(session.getSnapshot().current).toBe(original);
  });

  it("retains unresolved dietary evidence for provided meals after a mandatory diet edit", async () => {
    const { session } = await setup();
    const current = session.getSnapshot().current;
    const input = structuredClone(current.input);
    input.dietaryRequirement = "halal";
    await session.previewEdit(current.id, { type: "preferences", input });
    const proposed = preview(session);
    expect(proposed.proposed.result.status).toBe("draft");
    expect(codes(proposed.proposed.result)).toContain(
      "PROVIDED_MEAL_DIETARY_UNKNOWN",
    );
    expect(proposed.proposed.result.input?.dietaryRequirement).toBe("halal");
    expect(proposed.proposed.result.days[0].meals[0].provided).toBe(2);
    expect(session.getSnapshot().current).toBe(current);
  });

  it("does not introduce a food-repeat policy through a destination swap", async () => {
    const input = preferences();
    input.endDate = addCalendarDays(input.startDate, 1);
    input.dates.push(input.endDate);
    input.days.push({ ...structuredClone(input.days[0]), date: input.endDate });
    const { session } = await setup({ input });
    const current = session.getSnapshot().current;
    const firstFood = current.result.days[0].stops.find(
      (stop) => stop.kind === "food",
    )!;
    const nextFood = current.result.days[1].stops.find(
      (stop) => stop.kind === "food",
    )!;
    await session.previewEdit(current.id, {
      type: "swap",
      stopId: nextFood.id,
      placeId: firstFood.placeId,
    });
    expect(session.getSnapshot().preview).toBeNull();
    expect(session.getSnapshot().message?.kind).toBe("conflict");
    expect(session.getSnapshot().current).toBe(current);
  });

  it("rejects reorder omissions and duplicate logical IDs instead of deleting or duplicating stops", async () => {
    const { session } = await setup();
    const original = session.getSnapshot().current;
    const ids = original.result.days[0].stops.map((stop) => stop.id);
    for (const stopIds of [
      [ids[0]],
      [ids[0], ids[0]],
      [...ids, "unknown-stop"],
    ]) {
      await session.previewEdit(original.id, {
        type: "reorder",
        date: original.input.dates[0],
        stopIds,
      });
      const state = session.getSnapshot();
      expect(state.current).toBe(original);
      expect(
        state.preview === null ||
          state.preview.proposed.result.status === "blocked",
      ).toBe(true);
      if (state.preview) session.discardPreview();
    }
    expect(session.getSnapshot().history).toHaveLength(1);
  });

  it("treats an explicit fixed schedule that cannot fit as blocked instead of compressing dwell", async () => {
    const { session } = await setup();
    const current = session.getSnapshot().current;
    const input = structuredClone(current.input);
    input.days[0].endMinute = 600;
    await session.previewEdit(current.id, { type: "preferences", input });
    const result = preview(session).proposed.result;
    expect(result.status).toBe("blocked");
    expect(
      result.days[0].stops.every(
        (stop) => stop.durationMinutes === (stop.kind === "food" ? 45 : 60),
      ),
    ).toBe(true);
    expect(session.getSnapshot().current).toBe(current);
  });
});

describe("route invalidation and current request bindings", () => {
  it("reorders both visits and recomputes every directed leg at its new departure", async () => {
    const { session, requests } = await setup();
    const current = session.getSnapshot().current;
    const ids = current.result.days[0].stops.map((stop) => stop.id).reverse();
    await session.previewEdit(current.id, {
      type: "reorder",
      date: current.input.dates[0],
      stopIds: ids,
    });
    const result = preview(session).proposed.result;
    expect(result.status).toBe("validated");
    expect(result.days[0].stops.map((stop) => stop.id)).toEqual(ids);
    expect(requests.map((request) => [request.fromId, request.toId])).toEqual([
      ["anchor-a", "syn-food-01"],
      ["syn-food-01", "syn-history-01"],
      ["syn-history-01", "anchor-a"],
    ]);
    expect(result.work.routeAttempts).toBe(3);
    expect(result.days[0].legs.map((leg) => leg.departureMinute)).toEqual(
      requests.map((request) => request.departureMinute),
    );
    expect(result.days[0].legs[1].departureMinute).not.toBe(
      current.result.days[0].legs[1].departureMinute,
    );
    expect(result.days[0].legs.every((leg) => leg.status === "known")).toBe(
      true,
    );
  });

  it.each(["mode", "start", "anchor"] as const)(
    "invalidates routes after the %s assumption changes",
    async (change) => {
      const { session, requests } = await setup();
      const current = session.getSnapshot().current;
      const input = structuredClone(current.input);
      if (change === "mode") input.transport = "taxi";
      if (change === "start") input.days[0].startMinute += 30;
      if (change === "anchor") input.days[0].startAnchor = "anchor-b";
      await session.previewEdit(current.id, { type: "preferences", input });
      const result = preview(session).proposed.result;
      expect(result.status).toBe("validated");
      expect(requests).toHaveLength(3);
      expect(requests[0]).toMatchObject({
        fromId: input.days[0].startAnchor,
        mode: input.transport,
        departureMinute: input.days[0].startMinute,
        date: input.days[0].date,
        party: input.party,
      });
      if (change === "mode")
        expect(result.days[0].legs.every((leg) => leg.mode === "taxi")).toBe(
          true,
        );
      if (change === "start")
        expect(requests[1].departureMinute).not.toBe(
          current.result.days[0].legs[1].departureMinute,
        );
      expect(session.getSnapshot().current).toBe(current);
    },
  );

  it("leaves a newly missing return route and total unknown while preserving the committed version", async () => {
    let missing = false;
    const fixture = getSyntheticRouting();
    const routing: RoutingProvider = {
      id: "return-disappears",
      async resolve(request) {
        return missing && request.toId.startsWith("anchor-")
          ? {
              status: "unknown",
              reason: "Synthetic return evidence absent",
              retryable: false,
            }
          : fixture.resolve(request);
      },
    };
    const { session } = await setup({ routing });
    const current = session.getSnapshot().current;
    missing = true;
    await session.previewEdit(current.id, {
      type: "swap",
      stopId: firstStop(session).id,
      placeId: "syn-culture-02",
    });
    const proposal = preview(session);
    expect(proposal.proposed.result.status).toBe("draft");
    expect(
      proposal.proposed.result.days[0].legs.at(-1)?.arrivalMinute,
    ).toBeNull();
    expect(proposal.proposed.result.cost.totalUpperIdr).toBeNull();
    await session.commit(proposal.id, { allowNonValidated: false });
    expect(session.getSnapshot().current).toBe(current);
    expect(session.getSnapshot().lastValidRevisionId).toBe(current.id);
  });
});

describe("locks remain expressed hard constraints", () => {
  it("locks identity, sequence, start and dwell; blocks swapping or removing until an explicit unlock", async () => {
    const { session } = await setup();
    const original = session.getSnapshot().current;
    const stop = firstStop(session);
    await session.previewEdit(original.id, {
      type: "lock",
      stopId: stop.id,
      locked: true,
    });
    await commitPreview(session);
    const locked = session.getSnapshot().current;
    expect(locked.intent.days[0].stops[0].lock).toMatchObject({
      placeId: stop.placeId,
      date: original.input.dates[0],
      index: 0,
      startMinute: stop.startMinute,
      durationMinutes: stop.durationMinutes,
    });
    for (const operation of [
      { type: "swap" as const, stopId: stop.id, placeId: "syn-culture-02" },
      { type: "remove" as const, stopId: stop.id },
    ]) {
      await session.previewEdit(locked.id, operation);
      const state = session.getSnapshot();
      expect(state.current).toBe(locked);
      expect(
        state.preview === null ||
          state.preview.proposed.result.status === "blocked",
      ).toBe(true);
      if (state.preview) session.discardPreview();
    }
    await session.previewEdit(locked.id, {
      type: "lock",
      stopId: stop.id,
      locked: false,
    });
    await commitPreview(session);
    const unlocked = session.getSnapshot().current;
    expect(unlocked.intent.days[0].stops[0].lock).toBeNull();
    await session.previewEdit(unlocked.id, {
      type: "swap",
      stopId: stop.id,
      placeId: "syn-culture-02",
    });
    expect(preview(session).proposed.result.status).toBe("validated");
  });

  it("does not move a locked sequence position during reorder", async () => {
    const { session } = await setup();
    let current = session.getSnapshot().current;
    await session.previewEdit(current.id, {
      type: "lock",
      stopId: firstStop(session).id,
      locked: true,
    });
    await commitPreview(session);
    current = session.getSnapshot().current;
    await session.previewEdit(current.id, {
      type: "reorder",
      date: current.input.dates[0],
      stopIds: current.result.days[0].stops.map((stop) => stop.id).reverse(),
    });
    const state = session.getSnapshot();
    expect(state.current).toBe(current);
    expect(
      state.preview === null ||
        state.preview.proposed.result.status === "blocked",
    ).toBe(true);
    expect(current.intent.days[0].stops[0].lock?.index).toBe(0);
  });

  it("preserves a locked start when waiting is possible and blocks a later arrival rather than moving it", async () => {
    const { session } = await setup();
    let current = session.getSnapshot().current;
    const stop = firstStop(session);
    await session.previewEdit(current.id, {
      type: "lock",
      stopId: stop.id,
      locked: true,
    });
    await commitPreview(session);
    current = session.getSnapshot().current;
    const earlier = structuredClone(current.input);
    earlier.days[0].startMinute -= 30;
    await session.previewEdit(current.id, {
      type: "preferences",
      input: earlier,
    });
    expect(preview(session).proposed.result.status).toBe("validated");
    expect(preview(session).proposed.result.days[0].stops[0].startMinute).toBe(
      stop.startMinute,
    );
    session.discardPreview();
    const later = structuredClone(current.input);
    later.days[0].startMinute += 30;
    await session.previewEdit(current.id, {
      type: "preferences",
      input: later,
    });
    expect(preview(session).proposed.result.status).toBe("blocked");
    expect(session.getSnapshot().current).toBe(current);
  });
});

describe("revert preserves current lock intent", () => {
  it("cannot use reverting history to unlock a current locked place", async () => {
    const { session } = await setup();
    const original = session.getSnapshot().current;
    await session.previewEdit(original.id, {
      type: "swap",
      stopId: firstStop(session).id,
      placeId: "syn-culture-02",
    });
    await commitPreview(session);
    let current = session.getSnapshot().current;
    await session.previewEdit(current.id, {
      type: "lock",
      stopId: firstStop(session).id,
      locked: true,
    });
    await commitPreview(session);
    current = session.getSnapshot().current;
    await session.previewRevert(current.id, original.id);
    expect(session.getSnapshot().current).toBe(current);
    expect(session.getSnapshot().preview).toBeNull();
    expect(session.getSnapshot().message?.kind).toBe("conflict");
    expect(current.intent.days[0].stops[0].lock?.placeId).toBe(
      "syn-culture-02",
    );
  });
});

describe("preview admission, stale bases, replay and revert", () => {
  it("rejects stale-base preview and stale/replayed commits without adding history", async () => {
    const { session } = await setup();
    const base = session.getSnapshot().current;
    await session.previewEdit(base.id, {
      type: "swap",
      stopId: firstStop(session).id,
      placeId: "syn-culture-02",
    });
    const oldPreviewId = preview(session).id;
    await commitPreview(session);
    const current = session.getSnapshot().current;
    await session.commit(oldPreviewId, { allowNonValidated: true });
    expect(session.getSnapshot().current).toBe(current);
    expect(session.getSnapshot().history).toHaveLength(2);
    await session.previewEdit(base.id, {
      type: "remove",
      stopId: base.result.days[0].stops[0].id,
    });
    expect(session.getSnapshot().current).toBe(current);
    expect(session.getSnapshot().message?.kind).toBe("conflict");
    expect(session.getSnapshot().preview).toBeNull();
  });

  it("does not create duplicate revisions from simultaneous commit attempts", async () => {
    const { session } = await setup();
    const current = session.getSnapshot().current;
    await session.previewEdit(current.id, {
      type: "swap",
      stopId: firstStop(session).id,
      placeId: "syn-culture-02",
    });
    const proposal = preview(session);
    await Promise.all([
      session.commit(proposal.id, { allowNonValidated: false }),
      session.commit(proposal.id, { allowNonValidated: false }),
    ]);
    expect(session.getSnapshot().history).toHaveLength(2);
    expect(session.getSnapshot().current.number).toBe(current.number + 1);
    expect(session.getSnapshot().preview).toBeNull();
  });

  it("does not let a canceled commit release a newer preview's busy lock", async () => {
    const { session, dependencies } = await setup();
    const original = session.getSnapshot().current;
    await session.previewEdit(original.id, {
      type: "swap",
      stopId: firstStop(session).id,
      placeId: "syn-culture-02",
    });
    const oldPreview = preview(session);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const resolve = dependencies.routing.resolve.bind(dependencies.routing);
    dependencies.routing.resolve = async (request) => {
      await gate;
      return resolve(request);
    };
    const oldCommit = session.commit(oldPreview.id, {
      allowNonValidated: false,
    });
    session.discardPreview();
    const next = session.previewEdit(original.id, {
      type: "reorder",
      date: original.input.dates[0],
      stopIds: [...original.intent.days[0].stops]
        .reverse()
        .map((stop) => stop.id),
    });
    await oldCommit;
    expect(session.getSnapshot().busy).toBe(true);
    expect(session.getSnapshot().current.id).toBe(original.id);
    await session.previewEdit(original.id, {
      type: "remove",
      stopId: firstStop(session).id,
    });
    expect(session.getSnapshot().busy).toBe(true);
    release();
    await next;
    expect(preview(session).operation.type).toBe("reorder");
    expect(session.getSnapshot().history).toHaveLength(1);
  });

  it("rejects a formerly valid preview after travel dates expire in the city timezone", async () => {
    const { session, dependencies } = await setup();
    const original = session.getSnapshot().current;
    await session.previewEdit(original.id, {
      type: "swap",
      stopId: firstStop(session).id,
      placeId: "syn-culture-02",
    });
    const proposed = preview(session);
    dependencies.evaluatedAt = "2026-10-24T17:00:00.000Z";
    await session.commit(proposed.id, { allowNonValidated: false });
    expect(session.getSnapshot().history).toHaveLength(1);
    expect(session.getSnapshot().current.id).toBe(original.id);
    expect(session.getSnapshot().preview).toBeNull();
    expect(session.getSnapshot().busy).toBe(false);
    expect(session.getSnapshot().message?.text).toMatch(/tanggal/i);
  });

  it("admits only one concurrent preview and keeps its original operation", async () => {
    let release: (() => void) | undefined;
    let hold = false;
    const fixture = getSyntheticRouting();
    const routing: RoutingProvider = {
      id: "held-preview",
      async resolve(request) {
        if (hold) {
          hold = false;
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        return fixture.resolve(request);
      },
    };
    const { session } = await setup({ routing });
    const current = session.getSnapshot().current;
    hold = true;
    const first = session.previewEdit(current.id, {
      type: "swap",
      stopId: firstStop(session).id,
      placeId: "syn-culture-02",
    });
    await vi.waitFor(() => expect(release).toBeDefined());
    expect(session.getSnapshot().busy).toBe(true);
    await session.previewEdit(current.id, {
      type: "remove",
      stopId: firstStop(session).id,
    });
    expect(session.getSnapshot().message?.kind).toBe("conflict");
    expect(session.getSnapshot().busy).toBe(true);
    await session.previewEdit(current.id, {
      type: "reorder",
      date: current.input.dates[0],
      stopIds: current.result.days[0].stops.map((stop) => stop.id).reverse(),
    });
    expect(session.getSnapshot().busy).toBe(true);
    expect(session.getSnapshot().preview).toBeNull();
    release!();
    await first;
    expect(preview(session).operation.type).toBe("swap");
    expect(preview(session).proposed.result.days[0].stops[0].placeId).toBe(
      "syn-culture-02",
    );
    expect(session.getSnapshot().current).toBe(current);
  });

  it("cancels an in-flight preview and ignores its late completion", async () => {
    let release: (() => void) | undefined;
    let hold = false;
    const fixture = getSyntheticRouting();
    const routing: RoutingProvider = {
      id: "cancelled-preview",
      async resolve(request) {
        if (hold) {
          hold = false;
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        return fixture.resolve(request);
      },
    };
    const { session } = await setup({ routing });
    const current = session.getSnapshot().current;
    hold = true;
    const pending = session.previewEdit(current.id, {
      type: "swap",
      stopId: firstStop(session).id,
      placeId: "syn-culture-02",
    });
    await vi.waitFor(() => expect(release).toBeDefined());
    session.discardPreview();
    await vi.waitFor(() => expect(session.getSnapshot().busy).toBe(false));
    await session.previewEdit(current.id, {
      type: "reorder",
      date: current.input.dates[0],
      stopIds: current.result.days[0].stops.map((stop) => stop.id).reverse(),
    });
    const replacement = preview(session);
    expect(replacement.operation.type).toBe("reorder");
    release!();
    await pending;
    expect(session.getSnapshot().preview?.id).toBe(replacement.id);
    expect(session.getSnapshot().current).toBe(current);
    expect(session.getSnapshot().history).toHaveLength(1);
  });

  it("reverts an earlier version through a newly recomputed immutable revision", async () => {
    const { session, requests } = await setup();
    const original = session.getSnapshot().current;
    await session.previewEdit(original.id, {
      type: "swap",
      stopId: firstStop(session).id,
      placeId: "syn-culture-02",
    });
    await commitPreview(session);
    const swapped = session.getSnapshot().current;
    requests.length = 0;
    await session.previewRevert(swapped.id, original.id);
    const proposed = preview(session);
    expect(proposed.proposed.result.status).toBe("validated");
    expect(proposed.proposed.result.cost.totalUpperIdr).toBe(280500);
    expect(requests).toHaveLength(3);
    const after = await commitPreview(session);
    expect(after.current.id).not.toBe(original.id);
    expect(after.current.id).not.toBe(swapped.id);
    expect(after.current.parentId).toBe(swapped.id);
    expect(after.current.origin).toBe("revert");
    expect(after.current.revertedFromId).toBe(original.id);
    expect(after.history).toHaveLength(3);
    expect(after.current.result.days[0].stops[0].placeId).toBe(
      original.result.days[0].stops[0].placeId,
    );
  });

  it("rechecks field heads at commit and rejects an obsolete preview", async () => {
    const repository = getLocalRepository();
    const checkCurrent = repository.isCurrent.bind(repository);
    let current = true;
    repository.isCurrent = (refs) => current && checkCurrent(refs);
    const { session } = await setup({ repository });
    const original = session.getSnapshot().current;
    await session.previewEdit(original.id, {
      type: "swap",
      stopId: firstStop(session).id,
      placeId: "syn-culture-02",
    });
    const proposed = preview(session);
    expect(proposed.proposed.result.status).toBe("validated");
    current = false;
    await session.commit(proposed.id, { allowNonValidated: false });
    expect(session.getSnapshot().current.id).toBe(original.id);
    expect(session.getSnapshot().history).toHaveLength(1);
    expect(session.getSnapshot().message?.kind).toMatch(/conflict|error/);
  });

  it("suppresses obsolete before facts if publication changes while preview routing awaits", async () => {
    const repository = getLocalRepository();
    const isCurrent = repository.isCurrent.bind(repository);
    let changed = false;
    repository.isCurrent = (refs) => !changed && isCurrent(refs);
    const { session, dependencies } = await setup({ repository });
    const original = session.getSnapshot().current;
    const resolve = dependencies.routing.resolve.bind(dependencies.routing);
    dependencies.routing.resolve = async (request) => {
      const outcome = await resolve(request);
      changed = true;
      return outcome;
    };
    await session.previewEdit(original.id, {
      type: "swap",
      stopId: firstStop(session).id,
      placeId: "syn-culture-02",
    });
    const after = session.getSnapshot();
    expect(after.preview).toBeNull();
    expect(after.busy).toBe(false);
    expect(after.current.id).toBe(original.id);
    expect(after.current.availability).toBe("withdrawn");
    expect(after.current.result.days).toEqual([]);
    expect(after.current.result.cost.totalUpperIdr).toBeNull();
    expect(after.history).toHaveLength(1);
    expect(after.message?.kind).toBe("conflict");
    expect(original.result.days[0].stops[0].name).toContain("Galeri Sejarah");
    expect(Object.isFrozen(original)).toBe(true);
  });

  it("withdraws current and comparison facts if evidence changes during the commit yield", async () => {
    const repository = getLocalRepository();
    const isCurrent = repository.isCurrent.bind(repository);
    let changed = false;
    repository.isCurrent = (refs) => !changed && isCurrent(refs);
    const { session } = await setup({ repository });
    const original = session.getSnapshot().current;
    await session.previewEdit(original.id, {
      type: "swap",
      stopId: firstStop(session).id,
      placeId: "syn-culture-02",
    });
    const pending = session.commit(preview(session).id, {
      allowNonValidated: false,
    });
    changed = true;
    await pending;
    expect(session.getSnapshot().current.id).toBe(original.id);
    expect(session.getSnapshot().current.availability).toBe("withdrawn");
    expect(session.getSnapshot().current.result.days).toEqual([]);
    expect(session.getSnapshot().preview).toBeNull();
    expect(session.getSnapshot().busy).toBe(false);
    expect(session.getSnapshot().history).toHaveLength(1);
  });

  it("rejects revoked route evidence at commit even when catalogue evidence is still current", async () => {
    let revoked = false;
    const fixture = getSyntheticRouting();
    const routing: RoutingProvider = {
      ...fixture,
      isCurrent(refs) {
        return !revoked && (fixture.isCurrent?.(refs) ?? true);
      },
    };
    const { session } = await setup({ routing });
    const current = session.getSnapshot().current;
    await session.previewEdit(current.id, {
      type: "swap",
      stopId: firstStop(session).id,
      placeId: "syn-culture-02",
    });
    const proposed = preview(session);
    expect(proposed.proposed.result.status).toBe("validated");
    revoked = true;
    await session.commit(proposed.id, { allowNonValidated: false });
    expect(session.getSnapshot().current.id).toBe(current.id);
    expect(session.getSnapshot().current.availability).toBe("withdrawn");
    expect(session.getSnapshot().current.result.days).toEqual([]);
    expect(session.getSnapshot().history).toHaveLength(1);
    expect(session.getSnapshot().preview).toBeNull();
  });

  it("revalidates earlier stop choices against the current budget instead of restoring an obsolete higher budget", async () => {
    const { session } = await setup();
    const original = session.getSnapshot().current;
    const input = structuredClone(original.input);
    input.budgetIdr = 10000;
    await session.previewEdit(original.id, { type: "preferences", input });
    await commitPreview(session, true);
    const constrained = session.getSnapshot().current;
    expect(constrained.result.status).toBe("blocked");
    await session.previewRevert(constrained.id, original.id);
    const proposed = preview(session);
    expect(proposed.proposed.input.budgetIdr).toBe(10000);
    expect(proposed.proposed.result.status).toBe("blocked");
    expect(codes(proposed.proposed.result)).toContain("BUDGET_EXCEEDED");
    expect(session.getSnapshot().current).toBe(constrained);
    expect(session.getSnapshot().lastValidRevisionId).toBe(original.id);
  });

  it.each(["unknown", "revoked"] as const)(
    "does not schedule a selected replacement with %s hours evidence",
    async (state) => {
      const base = getLocalRepository();
      let changed = false;
      const repository: CatalogueRepository = {
        ...base,
        async list(cityId) {
          const places = await base.list(cityId);
          if (changed)
            places.find(
              (place) => place.id === "syn-culture-02",
            )!.evidence.hours.state = state;
          return places;
        },
      };
      const { session } = await setup({ repository });
      const original = session.getSnapshot().current;
      changed = true;
      await session.previewEdit(original.id, {
        type: "swap",
        stopId: firstStop(session).id,
        placeId: "syn-culture-02",
      });
      const proposed = preview(session);
      expect(proposed.proposed.result.status).not.toBe("validated");
      expect(
        proposed.proposed.result.days
          .flatMap((day) => day.stops)
          .some((stop) => stop.placeId === "syn-culture-02"),
      ).toBe(false);
      expect(session.getSnapshot().current).toBe(original);
    },
  );

  it("does not resurrect revoked historical identities when reverting or showing history", async () => {
    const base = getLocalRepository();
    let revoked = false;
    const repository: CatalogueRepository = {
      version: base.version,
      async list(cityId) {
        const places = await base.list(cityId);
        if (revoked)
          places.find(
            (place) => place.id === "syn-history-01",
          )!.evidence.identity.state = "revoked";
        return places;
      },
      getMealAllowance: () => base.getMealAllowance(),
      isCurrent: (refs) =>
        base.isCurrent(refs) &&
        (!revoked ||
          refs.every((ref) => !ref.assertionId.includes("syn-history-01"))),
    };
    const { session } = await setup({ repository });
    const original = session.getSnapshot().current;
    await session.previewEdit(original.id, {
      type: "swap",
      stopId: firstStop(session).id,
      placeId: "syn-culture-02",
    });
    await commitPreview(session);
    const current = session.getSnapshot().current;
    revoked = true;
    await session.refreshEvidence();
    const historic = session
      .getSnapshot()
      .history.find((revision) => revision.id === original.id)!;
    expect(historic.availability).toBe("withdrawn");
    expect(historic.result.days).toEqual([]);
    expect(historic.result.cost.totalUpperIdr).toBeNull();
    await session.previewRevert(current.id, original.id);
    const proposed = session.getSnapshot().preview;
    expect(
      proposed === null || proposed.proposed.result.status !== "validated",
    ).toBe(true);
    if (proposed)
      expect(
        proposed.proposed.result.days
          .flatMap((day) => day.stops)
          .some((stop) => stop.placeId === "syn-history-01"),
      ).toBe(false);
    expect(session.getSnapshot().current.id).toBe(current.id);
  });
});

describe("unchanged operation bounds on edit recalculation", () => {
  it("rejects the forty-third fixture attempt during a full edit revalidation", async () => {
    const input = preferences();
    input.pace = "active";
    input.stopCap = 5;
    input.walkingLimit = 8000;
    input.budgetIdr = 50000000;
    input.dates = Array.from({ length: 7 }, (_, index) =>
      addCalendarDays(input.startDate, index),
    );
    input.endDate = input.dates[6];
    const firstDay = structuredClone(input.days[0]);
    input.days = input.dates.map((date) => ({
      ...structuredClone(firstDay),
      date,
    }));
    const culture = SYNTHETIC_PLACES.find(
      (place) => place.id === "syn-history-01",
    )!;
    const food = SYNTHETIC_PLACES.find((place) => place.id === "syn-food-01")!;
    const places: SyntheticPlace[] = Array.from({ length: 35 }, (_, index) => {
      const source = index % 5 === 4 ? food : culture;
      const place = structuredClone(source);
      place.id = `syn-density-${index}`;
      place.name = `Density fixture ${index} · sintetis`;
      place.minutes = 45;
      for (const field of Object.keys(
        place.evidence,
      ) as (keyof SyntheticPlace["evidence"])[])
        place.evidence[field] = fixtureEvidence(place.id, field);
      return place;
    });
    const selection = input.dates.map((date, day) => ({
      date,
      stops: places.slice(day * 5, day * 5 + 5).map((place, index) => ({
        id: `dense-${day}-${index}`,
        placeId: place.id,
        lockedStartMinute: null,
        lockedDurationMinutes: null,
      })),
    }));
    const fixture = getSyntheticRouting();
    let retryNext = false;
    const requests: RouteRequest[] = [];
    const routing: RoutingProvider = {
      id: "counted-edit-retries",
      async resolve(request) {
        requests.push(structuredClone(request));
        if (retryNext) {
          retryNext = false;
          return {
            status: "error",
            reason: "Synthetic one-time retry",
            retryable: true,
          };
        }
        const route = await fixture.resolve({
          ...request,
          fromId: "anchor-a",
          toId: "syn-history-01",
        });
        if (route.status !== "ok")
          throw new Error("Expected known synthetic fixture.");
        return {
          ...route,
          data: {
            ...route.data,
            binding: request,
            evidence: fixtureEvidence(
              `density-route-${request.fromId}-${request.toId}-${request.departureMinute}`,
              "duration-distance-walking-group-cost",
            ),
          },
        };
      },
    };
    const repository = getLocalRepository({ places });
    const dependencies: PlannerDependencies = {
      repository,
      routing,
      evaluatedAt,
      now: () => 0,
    };
    const initial = await planItinerary(input, { ...dependencies, selection });
    expect(initial.status).toBe("validated");
    expect(initial.work.routeAttempts).toBe(42);
    expect(
      initial.days.every(
        (day) => day.stops.length === 5 && day.legs.length === 6,
      ),
    ).toBe(true);
    const session = createLocalEditingSession(initial, dependencies);
    const current = session.getSnapshot().current;
    requests.length = 0;
    retryNext = true;
    await session.previewEdit(current.id, {
      type: "preferences",
      input: structuredClone(current.input),
    });
    const proposed = preview(session);
    expect(proposed.proposed.result.status).toBe("draft");
    expect(codes(proposed.proposed.result)).toContain("ROUTE_LIMIT");
    expect(requests.length).toBe(42);
    expect(proposed.proposed.result.work.routeAttempts).toBe(requests.length);
    expect(proposed.proposed.result.work.apiCostMicroUsd).toBe(0);
    expect(proposed.proposed.result.work.modelCalls).toBe(0);
    expect(session.getSnapshot().current).toBe(current);
  });

  it("terminates an edit that crosses the 45-second deadline without committing", async () => {
    let clock = 0;
    let late = false;
    const fixture = getSyntheticRouting();
    const routing: RoutingProvider = {
      id: "deadline-edit",
      async resolve(request) {
        const result = await fixture.resolve(request);
        if (late) clock = 45000;
        return result;
      },
    };
    const { session } = await setup({ routing, now: () => clock });
    const current = session.getSnapshot().current;
    late = true;
    await session.previewEdit(current.id, {
      type: "swap",
      stopId: firstStop(session).id,
      placeId: "syn-culture-02",
    });
    const result = preview(session).proposed.result;
    expect(result.status).toBe("draft");
    expect(codes(result)).toContain("DEADLINE");
    expect(result.work.routeAttempts).toBeLessThanOrEqual(1);
    expect(result.cost.totalUpperIdr).toBeNull();
    expect(session.getSnapshot().current).toBe(current);
    expect(session.getSnapshot().busy).toBe(false);
  });
});
