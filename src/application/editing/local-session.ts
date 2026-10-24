import { z } from "zod";
import {
  NormalizedPreferencesSchema,
  SyntheticPlaceSchema,
  type NormalizedMeal,
  type NormalizedPreferences,
  type SyntheticPlace,
} from "@/domain/contracts";
import { normalizePreferences, addCalendarDays } from "@/domain/normalization";
import { evaluateEvidence } from "@/domain/evidence";
import {
  emptyResult,
  freezeDeep,
  planItinerary,
  type PlannerDependencies,
} from "@/domain/planner";
import { PlanResultSchema } from "@/domain/planner/result-schema";
import type { PlanResult } from "@/domain/planner/types";
import { WorkBudget } from "@/domain/planner/work";
import { placeEligibility } from "@/domain/planner/selection";
import {
  applyOperation,
  assertLocksPreserved,
  EditConflict,
  initialIntent,
} from "@/domain/editing/operations";
import {
  EditIntentSchema,
  EditOperationSchema,
} from "@/domain/editing/contracts";
import type {
  EditingSnapshot,
  EditIntent,
  EditOperation,
  EditPreview,
  ItineraryRevision,
} from "@/domain/editing/types";
import type { SyntheticSubmission } from "@/application/planning/preview-planner";
import { getLocalRepository } from "@/infrastructure/synthetic/catalogue";
import { getSyntheticRouting } from "@/infrastructure/synthetic/routing";
import { siteConfig } from "@/config/site";

export type {
  EditingSnapshot,
  EditIntent,
  EditOperation,
  EditPreview,
  ItineraryRevision,
} from "@/domain/editing/types";
const clock = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
const portions = (meal: NormalizedMeal) => ({
  necessary: meal.necessary,
  provided: meal.provided,
  prepaid: meal.prepaid,
  confirmedZero: meal.confirmedZero,
  scheduling:
    meal.scheduling?.mode === "scheduled"
      ? {
          mode: "scheduled" as const,
          serviceId: meal.scheduling.serviceId,
          window: {
            start: clock(meal.scheduling.window.startMinute),
            end: clock(meal.scheduling.window.endMinute),
          },
          windowConfirmed: meal.scheduling.windowConfirmed,
        }
      : { mode: "unscheduled" as const },
});
function cityToday(asOf: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: siteConfig.city.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(asOf));
}
export function submissionFromRevision(
  revision: ItineraryRevision,
): SyntheticSubmission {
  const input = revision.input;
  return {
    input: {
      startDate: input.startDate,
      endDate: input.endDate,
      party: input.party,
      budget: String(input.budgetIdr),
      transport: input.transport,
      pace: input.pace,
      planningStyle: input.planningStyle,
      walkingLimit: input.walkingLimit,
      interests: [...input.interests],
      mandatoryInterests: [...input.mandatoryInterests],
      foodPreference: input.foodPreference,
      dietaryRequirement: input.dietaryRequirement,
      accessibilityRequirement: input.accessibilityRequirement,
    },
    days: input.days.map((day) => ({
      date: day.date,
      start: clock(day.startMinute),
      end: clock(day.endMinute),
      startAnchor: day.startAnchor,
      endAnchor: day.endAnchor,
      coverage: day.coverage,
      inventoryConfirmed: day.inventoryConfirmed,
      meals: {
        breakfast: portions(day.meals.find((meal) => meal.id === "breakfast")!),
        lunch: portions(day.meals.find((meal) => meal.id === "lunch")!),
        dinner: portions(day.meals.find((meal) => meal.id === "dinner")!),
      },
      extraMeals: day.meals
        .filter((meal) => meal.id.startsWith("extra-"))
        .map((meal) => ({
          id: meal.id,
          label: meal.label,
          portions: portions(meal),
        })),
    })),
  };
}
function unavailable(result: PlanResult, asOf: string): PlanResult {
  return freezeDeep({
    ...emptyResult(asOf, [
      {
        code: "EVIDENCE_WITHDRAWN",
        severity: "unknown",
        message:
          "Bukti versi ini sudah berubah, kedaluwarsa atau ditarik. Klaim, jadwal dan angka lama disembunyikan; pulihkan hanya melalui pemeriksaan terkini.",
      },
    ]),
    status: "draft",
    input: result.input,
    catalogueVersion: result.catalogueVersion,
    cost: {
      lines: [],
      budgetIdr: result.input?.budgetIdr ?? null,
      lowerSubtotalIdr: null,
      upperSubtotalIdr: null,
      contingencyIdr: null,
      totalUpperIdr: null,
    },
  });
}

/** A single browser-memory lineage. No storage, credentials, authentication or network. */
export class LocalEditingSession {
  private readonly sessionId = `local-${crypto.randomUUID()}`;
  private readonly revisions: ItineraryRevision[] = [];
  private readonly listeners = new Set<() => void>();
  private state: EditingSnapshot;
  private previewNumber = 0;
  private epoch = 0;
  private abort: AbortController | null = null;
  private readonly dependencies: PlannerDependencies;
  private readonly injectedTime: boolean;
  constructor(
    initial: PlanResult,
    dependencies?: PlannerDependencies,
    private readonly currentTime?: () => string,
  ) {
    this.injectedTime = dependencies !== undefined;
    this.dependencies = dependencies ?? {
      repository: getLocalRepository(),
      routing: getSyntheticRouting(),
      evaluatedAt: new Date().toISOString(),
    };
    const parsed = PlanResultSchema.parse(initial);
    if (!parsed.input)
      throw new EditConflict(
        "Rencana tanpa preferensi yang sah belum dapat diedit.",
      );
    const intent = initialIntent(parsed);
    parsed.days.forEach((day) =>
      day.stops.forEach((stop) => {
        stop.id = intent.days
          .find((entry) => entry.date === day.date)!
          .stops.find((entry) => entry.placeId === stop.placeId)!.id;
      }),
    );
    const revision = freezeDeep({
      id: `${this.sessionId}:rev-1`,
      number: 1,
      parentId: null,
      origin: "generated" as const,
      revertedFromId: null,
      createdAt: parsed.evaluatedAt,
      input: parsed.input,
      intent,
      result: parsed,
      availability: "available" as const,
    });
    this.revisions.push(revision);
    this.state = freezeDeep({
      current: revision,
      history: [revision],
      lastValidRevisionId: parsed.status === "validated" ? revision.id : null,
      preview: null,
      busy: false,
      message: null,
    });
    this.refreshEvidence();
  }
  private asOf() {
    if (this.currentTime) return this.currentTime();
    return this.injectedTime
      ? this.dependencies.evaluatedAt
      : new Date().toISOString();
  }
  getSnapshot = (): EditingSnapshot => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<EditingSnapshot>) {
    this.state = freezeDeep({ ...this.state, ...patch });
    this.listeners.forEach((listener) => listener());
  }
  private reject(error: unknown, kind: "conflict" | "error" = "conflict") {
    this.update({
      message: {
        kind,
        text:
          error instanceof Error
            ? error.message
            : "Perubahan belum berhasil. Versi sebelumnya tetap tersedia.",
      },
    });
  }
  private evidenceUsable(result: PlanResult): boolean {
    try {
      const asOf = this.asOf();
      const catalogue = result.days.flatMap((day) => [
        ...day.stops.flatMap((stop) => stop.evidenceRefs),
        ...day.meals.flatMap((meal) => meal.evidenceRefs),
      ]);
      const routes = result.days.flatMap((day) =>
        day.legs.flatMap((leg) => leg.evidenceRefs),
      );
      const routeIds = new Set(routes.map((ref) => ref.assertionId));
      const recommendationRefs = result.recommendation
        ? result.evidenceRefs.filter((ref) => !routeIds.has(ref.assertionId))
        : [];
      catalogue.push(...recommendationRefs);
      if (
        !this.dependencies.repository.isCurrent(catalogue) ||
        (this.dependencies.routing.isCurrent &&
          !this.dependencies.routing.isCurrent(routes))
      )
        return false;
      if (
        recommendationRefs.some(
          (ref) =>
            !result.input?.dates.some(
              (date) => evaluateEvidence(ref, date, asOf).usable,
            ),
        )
      )
        return false;
      return result.days.every((day) =>
        [
          ...day.stops.flatMap((stop) => stop.evidenceRefs),
          ...day.meals.flatMap((meal) => meal.evidenceRefs),
          ...day.legs.flatMap((leg) => leg.evidenceRefs),
        ].every((ref) => evaluateEvidence(ref, day.date, asOf).usable),
      );
    } catch {
      return false;
    }
  }
  refreshEvidence = () => {
    const history = this.revisions.map((revision) =>
      this.evidenceUsable(revision.result)
        ? revision
        : freezeDeep({
            ...revision,
            availability: "withdrawn" as const,
            result: unavailable(revision.result, this.asOf()),
          }),
    );
    const current = history.find(
      (revision) => revision.id === this.state.current.id,
    )!;
    const invalidPreview =
      this.state.preview &&
      (!this.evidenceUsable(this.state.preview.proposed.result) ||
        !this.evidenceUsable(this.state.preview.before.result));
    if (invalidPreview) {
      this.epoch++;
      this.abort?.abort();
    }
    this.update({
      current,
      history,
      ...(invalidPreview
        ? {
            preview: null,
            busy: false,
            message: {
              kind: "conflict" as const,
              text: "Bukti pratinjau telah berubah. Buat pratinjau baru sebelum menerapkan perubahan.",
            },
          }
        : {}),
    });
  };
  discardPreview = () => {
    this.epoch++;
    this.abort?.abort();
    this.abort = null;
    this.update({ preview: null, busy: false, message: null });
  };
  dispose = () => {
    this.discardPreview();
    this.listeners.clear();
  };
  private base(baseId: string) {
    if (this.state.busy)
      throw new EditConflict(
        "Perubahan lain sedang dihitung. Tunggu atau batalkan pratinjau terlebih dahulu.",
      );
    if (baseId !== this.state.current.id)
      throw new EditConflict(
        "Versi dasar sudah berubah. Gunakan versi terbaru dan buat pratinjau ulang.",
      );
    return this.state.current;
  }
  async previewPreferences(baseId: string, submission: SyntheticSubmission) {
    try {
      const parsed = z
        .strictObject({
          input: z.record(z.string(), z.unknown()),
          days: z.array(z.unknown()).min(1).max(7),
        })
        .parse(submission);
      const normalized = normalizePreferences(
        { ...parsed.input, cityId: siteConfig.city.id, days: parsed.days },
        { today: cityToday(this.asOf()) },
      );
      if (!normalized.ok)
        throw new EditConflict(
          normalized.issues
            .map((issue) => `${issue.path}: ${issue.message}`)
            .join(" · "),
        );
      await this.previewEdit(baseId, {
        type: "preferences",
        input: normalized.value,
      });
    } catch (error) {
      this.reject(error, "error");
    }
  }
  async previewRevert(baseId: string, targetId: string) {
    await this.previewEdit(baseId, { type: "revert", revisionId: targetId });
  }
  async previewEdit(baseId: string, raw: EditOperation) {
    let run: number | undefined;
    try {
      this.refreshEvidence();
      const base = this.base(baseId);
      const operation = EditOperationSchema.parse(raw);
      let proposed: { input: NormalizedPreferences; intent: EditIntent };
      let sourceRevisionId: string | null = null;
      if (operation.type === "revert") {
        const target = this.revisions.find(
          (revision) => revision.id === operation.revisionId,
        );
        if (!target)
          throw new EditConflict(
            "Versi tujuan tidak ditemukan dalam sesi ini.",
          );
        const intent = structuredClone(target.intent);
        intent.days.forEach((day) =>
          day.stops.forEach((stop) => {
            stop.lock = structuredClone(
              base.intent.days
                .flatMap((entry) => entry.stops)
                .find((entry) => entry.id === stop.id)?.lock ?? null,
            );
          }),
        );
        assertLocksPreserved(base.intent, intent);
        proposed = {
          input: base.input,
          intent: EditIntentSchema.parse(intent),
        };
        sourceRevisionId = target.id;
      } else proposed = applyOperation(base, operation);
      run = ++this.epoch;
      this.abort = new AbortController();
      const signal = this.abort.signal;
      this.update({ busy: true, preview: null, message: null });
      const input = NormalizedPreferencesSchema.parse(proposed.input);
      const asOf = this.asOf();
      const today = cityToday(asOf);
      let result: PlanResult;
      if (
        input.startDate < today ||
        input.endDate > addCalendarDays(today, 90)
      ) {
        result = {
          ...emptyResult(asOf, [
            {
              code: "EDIT_DATES_EXPIRED",
              severity: "violation",
              message:
                "Tanggal perjalanan tidak lagi berada dalam rentang yang didukung. Versi lama hanya menjadi referensi, bukan validasi terkini.",
            },
          ]),
          input,
          cost: {
            lines: [],
            budgetIdr: input.budgetIdr,
            lowerSubtotalIdr: null,
            upperSubtotalIdr: null,
            contingencyIdr: null,
            totalUpperIdr: null,
          },
        };
      } else
        result = await planItinerary(input, {
          ...this.dependencies,
          evaluatedAt: asOf,
          signal,
          selection: proposed.intent.days.map((day) => ({
            date: day.date,
            stops: day.stops.map((stop) => ({
              id: stop.id,
              placeId: stop.placeId,
              lockedStartMinute: stop.lock?.startMinute ?? null,
              lockedDurationMinutes: stop.lock?.durationMinutes ?? null,
            })),
          })),
        });
      if (run !== this.epoch) return;
      // A source may change while routing awaits. Do not publish an obsolete
      // before/after comparison even when the planner already withdrew its result.
      this.refreshEvidence();
      if (run !== this.epoch) return;
      if (!this.evidenceUsable(base.result) || !this.evidenceUsable(result))
        throw new EditConflict(
          "Bukti berubah selama perhitungan. Klaim lama ditarik; buat pratinjau baru dengan bukti terkini.",
        );
      if (this.state.current.id !== baseId)
        throw new EditConflict(
          "Versi dasar berubah selama perhitungan. Pratinjau lama tidak diterapkan.",
        );
      const preview: EditPreview = freezeDeep({
        id: `${this.sessionId}:preview-${++this.previewNumber}`,
        baseRevisionId: baseId,
        operation,
        sourceRevisionId,
        before: base,
        proposed: {
          input,
          intent: proposed.intent,
          result: PlanResultSchema.parse(result),
        },
        createdAt: asOf,
      });
      this.update({ busy: false, preview, message: null });
    } catch (error) {
      if (run !== undefined && run !== this.epoch) return;
      // A rejected competing request does not own the active calculation's lock.
      if (run !== undefined) this.update({ busy: false });
      this.reject(error);
    }
  }
  async commit(
    previewId: string,
    options: { allowNonValidated: boolean } = { allowNonValidated: false },
  ) {
    let started = false;
    let run: number | undefined;
    try {
      this.refreshEvidence();
      if (this.state.busy)
        throw new EditConflict(
          "Operasi lain sedang berjalan. Versi tidak diubah.",
        );
      const preview = this.state.preview;
      if (
        !preview ||
        preview.id !== previewId ||
        preview.baseRevisionId !== this.state.current.id
      )
        throw new EditConflict(
          "Pratinjau kedaluwarsa atau sudah digunakan. Buat pratinjau baru dari versi terbaru.",
        );
      if (
        preview.proposed.result.status !== "validated" &&
        options.allowNonValidated !== true
      )
        throw new EditConflict(
          "Hasil belum valid. Hanya tindakan eksplisit untuk menyimpan versi draf/terblokir yang diizinkan; versi valid sebelumnya tetap tersedia.",
        );
      this.update({ busy: true, message: null });
      started = true;
      run = this.epoch;
      await Promise.resolve();
      this.refreshEvidence();
      if (
        run !== this.epoch ||
        this.state.current.id !== preview.baseRevisionId ||
        this.state.preview?.id !== previewId
      )
        throw new EditConflict(
          "Pratinjau berubah sebelum diterapkan. Tidak ada versi yang ditimpa.",
        );
      if (
        !this.evidenceUsable(preview.proposed.result) ||
        !this.evidenceUsable(preview.before.result)
      )
        throw new EditConflict(
          "Bukti telah berubah atau kedaluwarsa. Hitung ulang pratinjau; hasil lama tidak dapat diterapkan.",
        );
      const committedAt = this.asOf();
      const today = cityToday(committedAt);
      if (
        preview.proposed.input.startDate < today ||
        preview.proposed.input.endDate > addCalendarDays(today, 90)
      ) {
        this.update({ preview: null });
        throw new EditConflict(
          "Tanggal perjalanan tidak lagi didukung saat penerapan. Buat rencana baru dengan tanggal dan inventaris makan yang dikonfirmasi; versi lama tetap menjadi riwayat.",
        );
      }
      const result = freezeDeep(
        PlanResultSchema.parse(preview.proposed.result),
      );
      const number = this.revisions.length + 1;
      const revision: ItineraryRevision = freezeDeep({
        id: `${this.sessionId}:rev-${number}`,
        number,
        parentId: this.state.current.id,
        origin: preview.operation.type === "revert" ? "revert" : "edit",
        revertedFromId: preview.sourceRevisionId,
        createdAt: committedAt,
        input: preview.proposed.input,
        intent: preview.proposed.intent,
        result,
        availability: "available",
      });
      this.revisions.push(revision);
      this.epoch++;
      this.update({
        current: revision,
        history: [...this.state.history, revision],
        preview: null,
        busy: false,
        lastValidRevisionId:
          result.status === "validated"
            ? revision.id
            : this.state.lastValidRevisionId,
        message: {
          kind: "success",
          text: `Versi ${number} diterapkan dalam memori. Versi sebelumnya tetap tersedia.`,
        },
      });
    } catch (error) {
      if (started && run !== this.epoch) return;
      if (started) this.update({ busy: false });
      this.reject(error);
    }
  }
}
export function createLocalEditingSession(
  initial: PlanResult,
  dependencies?: PlannerDependencies,
  currentTime?: () => string,
) {
  return new LocalEditingSession(initial, dependencies, currentTime);
}
export async function listEligibleSwapOptions(
  revision: ItineraryRevision,
  stopId: string,
  dependencies?: PlannerDependencies,
): Promise<SyntheticPlace[]> {
  const day = revision.intent.days.find((entry) =>
    entry.stops.some((stop) => stop.id === stopId),
  );
  const target = day?.stops.find((stop) => stop.id === stopId);
  if (!day || !target || target.lock || revision.availability !== "available")
    return [];
  const repository = dependencies?.repository ?? getLocalRepository();
  const work = new WorkBudget(dependencies?.now, dependencies?.signal);
  const places = z
    .array(SyntheticPlaceSchema)
    .max(60)
    .parse(await work.run(() => repository.list(revision.input.cityId)));
  const current = places.find((place) => place.id === target.placeId);
  const used = new Set(
    revision.intent.days.flatMap((entry) =>
      entry.stops.map((stop) => stop.placeId),
    ),
  );
  const asOf = dependencies?.evaluatedAt ?? new Date().toISOString();
  const retainedCategories = new Set(
    revision.intent.days.flatMap((entry) =>
      entry.stops.flatMap((stop) => {
        if (stop.id === stopId) return [];
        const place = places.find((candidate) => candidate.id === stop.placeId);
        return place?.kind === "culture" &&
          placeEligibility(place, revision.input, entry.date, asOf).eligible &&
          repository.isCurrent(Object.values(place.evidence))
          ? place.categoryIds
          : [];
      }),
    ),
  );
  return places.filter(
    (place) =>
      place.kind === current?.kind &&
      !used.has(place.id) &&
      placeEligibility(place, revision.input, day.date, asOf).eligible &&
      repository.isCurrent(Object.values(place.evidence)) &&
      revision.input.mandatoryInterests.every(
        (category) =>
          retainedCategories.has(category) ||
          (place.kind === "culture" && place.categoryIds.includes(category)),
      ),
  );
}
