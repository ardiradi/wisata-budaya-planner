import { z } from "zod";
import {
  MealAllowanceSchema,
  MealServiceSchema,
  NormalizedPreferencesSchema,
  OPERATING_LIMITS,
  SyntheticPlaceSchema,
  type CatalogueRepository,
  type EvidenceRef,
  type NormalizedPreferences,
  type RoutingProvider,
} from "../contracts";
import { evaluateEvidence } from "../evidence";
import { charge, summarizeCost } from "./cost";
import { scheduleDay } from "./schedule";
import { placeEligibility, selectDayPlaces } from "./selection";
import type { CostLine, PlanDay, PlanIssue, PlanResult } from "./types";
import { WorkBudget, WorkLimitError } from "./work";
import { PlanResultSchema } from "./result-schema";
import { rankCandidates } from "../recommendations/orchestrator";
import type { RecommendationProvider } from "../recommendations/contracts";
import {
  PlanningSelectionSchema,
  explicitDaySelection,
  type PlanningDaySelection,
} from "./explicit-selection";
import {
  eligibleMealServices,
  futureMealUpperCost,
  requiredMealServiceEvidence,
} from "./meals";

export type PlannerDependencies = {
  repository: CatalogueRepository;
  routing: RoutingProvider;
  evaluatedAt: string;
  now?: () => number;
  selection?: PlanningDaySelection[];
  signal?: AbortSignal;
  recommendationProvider?: RecommendationProvider;
};
export function freezeDeep<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}
export function emptyResult(
  evaluatedAt: string,
  issues: PlanIssue[],
): PlanResult {
  return {
    status: "blocked",
    synthetic: true,
    independentlyReviewed: false,
    input: null,
    days: [],
    issues,
    cost: summarizeCost([], null),
    coverage: {
      requiredCategoryIds: [],
      fulfilledCategoryIds: [],
      missingCategoryIds: [],
    },
    work: {
      routeAttempts: 0,
      modelCalls: 0,
      matrixElements: 0,
      apiCostMicroUsd: 0,
      elapsedMs: 0,
    },
    evidenceRefs: [],
    catalogueVersion: "unavailable",
    evaluatedAt,
  };
}

/** Already-normalized input comes only from the runtime-validated application boundary. No SDK/framework dependency. */
export async function planItinerary(
  input: NormalizedPreferences,
  dependencies: PlannerDependencies,
): Promise<PlanResult> {
  const { repository, routing, evaluatedAt } = dependencies;
  const parsedInput = NormalizedPreferencesSchema.safeParse(input);
  if (!parsedInput.success)
    return freezeDeep(
      emptyResult(evaluatedAt, [
        {
          code: "NORMALIZED_INPUT_INVALID",
          severity: "violation",
          message:
            "Preferensi ternormalisasi tidak memenuhi kontrak runtime; perhitungan tidak dijalankan.",
        },
      ]),
    );
  input = parsedInput.data;
  const work = new WorkBudget(dependencies.now, dependencies.signal);
  const issues: PlanIssue[] = [];
  const lines: CostLine[] = [];
  const days: PlanDay[] = [];
  const catalogueRefs: EvidenceRef[] = [];
  const remaining = new Set<string>(input.mandatoryInterests);
  const usedPlaceIds = new Set<string>();
  const explicitUnknownCategories = new Set<string>();
  const result = emptyResult(evaluatedAt, issues);
  result.input = structuredClone(input);
  result.catalogueVersion = repository.version;
  result.days = days;
  try {
    const explicit =
      dependencies.selection === undefined
        ? undefined
        : PlanningSelectionSchema.parse(dependencies.selection);
    if (
      explicit &&
      (explicit.length !== input.days.length ||
        explicit.some((day, index) => day.date !== input.days[index].date))
    )
      throw new Error("EXPLICIT_DATES_INVALID");
    const rawPlaces: unknown = await work.run(() =>
      repository.list(input.cityId),
    );
    const places = z
      .array(SyntheticPlaceSchema)
      .max(OPERATING_LIMITS.maxCandidates)
      .parse(rawPlaces);
    if (
      new Set(places.map((place) => place.id)).size !== places.length ||
      places.some(
        (place) =>
          place.cityId !== input.cityId || place.price.unit === "portion",
      )
    )
      throw new Error("CATALOGUE_INVALID");
    const allowance = MealAllowanceSchema.parse(
      await work.run(() => repository.getMealAllowance()),
    );
    const mealServices = z
      .array(MealServiceSchema)
      .max(60)
      .parse(
        repository.listMealServices
          ? await work.run(() => repository.listMealServices!())
          : [],
      );
    // Explicit B2 edits bypass ranking. The same operation budget spans retrieval,
    // mock recommendation attempts and every subsequent route calculation.
    if (dependencies.recommendationProvider && !explicit) {
      result.recommendation = await rankCandidates(input, places, {
        repository,
        provider: dependencies.recommendationProvider,
        evaluatedAt,
        work,
        signal: dependencies.signal,
      });
      const recommended = new Set(
        result.recommendation.rankings.map((row) => row.placeId),
      );
      catalogueRefs.push(
        ...places
          .filter((place) => recommended.has(place.id))
          .flatMap((place) => Object.values(place.evidence)),
      );
    }
    for (const dayInput of input.days) {
      work.check();
      const day: PlanDay = {
        date: dayInput.date,
        startMinute: dayInput.startMinute,
        endMinute: dayInput.endMinute,
        startAnchor: dayInput.startAnchor,
        endAnchor: dayInput.endAnchor,
        coverage: dayInput.coverage,
        stops: [],
        legs: [],
        meals: [],
        walkingUpperMeters: 0,
        culturalCovered: false,
        culinaryCovered: false,
      };
      days.push(day);
      const activeMealServices = eligibleMealServices(
        dayInput.meals,
        mealServices,
        input,
        day.date,
        evaluatedAt,
        (refs) => repository.isCurrent(refs),
        issues,
      );
      const priceKnown = evaluateEvidence(
        allowance.evidence,
        day.date,
        evaluatedAt,
      ).usable;
      const dietaryKnown =
        input.dietaryRequirement === "none" ||
        (evaluateEvidence(allowance.dietaryEvidence, day.date, evaluatedAt)
          .usable &&
          allowance.dietary.includes(input.dietaryRequirement));
      const accessKnown =
        input.accessibilityRequirement === "none" ||
        (evaluateEvidence(
          allowance.accessibilityEvidence,
          day.date,
          evaluatedAt,
        ).usable &&
          allowance.stepFree);
      if (
        !dayInput.inventoryConfirmed ||
        dayInput.meals.some(
          (meal) => meal.necessary === 0 && !meal.confirmedZero,
        )
      )
        issues.push({
          code: "MEAL_INVENTORY_UNCONFIRMED",
          severity: "unknown",
          date: day.date,
          message:
            "Potensi kebutuhan makan, termasuk nol porsi pada hari parsial, harus dikonfirmasi sebelum validasi.",
        });
      for (const meal of dayInput.meals) {
        if (
          input.dietaryRequirement !== "none" &&
          meal.provided + meal.prepaid > 0 &&
          !activeMealServices.has(meal.id)
        ) {
          issues.push({
            code: "PROVIDED_MEAL_DIETARY_UNKNOWN",
            severity: "unknown",
            date: day.date,
            message:
              "Deklarasi porsi dibawa/prabayar hanya membuktikan cakupan biaya dalam simulasi. Belum ada bukti kesesuaian diet untuk porsi tersebut; persyaratan makanan wajib tidak dikecualikan.",
          });
        }
        const mealService = activeMealServices.get(meal.id);
        const evidenceRefs = meal.purchased
          ? [
              allowance.evidence,
              ...(input.dietaryRequirement === "none" || mealService
                ? []
                : [allowance.dietaryEvidence]),
              ...(input.accessibilityRequirement === "none" || mealService
                ? []
                : [allowance.accessibilityEvidence]),
            ]
          : [];
        if (mealService)
          evidenceRefs.push(
            ...requiredMealServiceEvidence(mealService, input).map(
              ({ ref }) => ref,
            ),
          );
        const known =
          !meal.purchased ||
          (priceKnown &&
            (dietaryKnown || Boolean(mealService)) &&
            (accessKnown || Boolean(mealService)));
        const lowerIdr = known
          ? charge(allowance.price.lower, meal.purchased)
          : null;
        const upperIdr = known
          ? charge(allowance.price.upper, meal.purchased)
          : null;
        day.meals.push({
          id: meal.id,
          label: meal.label,
          date: day.date,
          necessary: meal.necessary,
          provided: meal.provided,
          prepaid: meal.prepaid,
          purchased: meal.purchased,
          lowerIdr,
          upperIdr,
          evidenceRefs,
          schedulingStatus:
            meal.scheduling?.mode === "scheduled"
              ? "unresolved"
              : "unscheduled",
          serviceId:
            meal.scheduling?.mode === "scheduled"
              ? meal.scheduling.serviceId
              : null,
          placeId: activeMealServices.get(meal.id)?.placeId ?? null,
          requestedWindow:
            meal.scheduling?.mode === "scheduled"
              ? meal.scheduling.window
              : null,
          startMinute: null,
          endMinute: null,
          durationMinutes: null,
          serviceChargeIdr:
            meal.scheduling?.mode === "scheduled"
              ? (mealService?.additionalChargeIdr ?? null)
              : undefined,
        });
        lines.push({
          id: `meal-${day.date}-${meal.id}`,
          label: meal.label,
          date: day.date,
          quantity: meal.purchased,
          unit: "portion",
          lowerIdr,
          upperIdr,
          evidenceRefs,
        });
        catalogueRefs.push(...evidenceRefs);
        if (meal.scheduling?.mode === "scheduled")
          lines.push({
            id: `meal-service-${day.date}-${meal.id}`,
            label: `Layanan ${meal.label}`,
            date: day.date,
            quantity: 1,
            unit: "group",
            lowerIdr: mealService?.additionalChargeIdr.lower ?? null,
            upperIdr: mealService?.additionalChargeIdr.upper ?? null,
            evidenceRefs: mealService ? [mealService.evidence.charges] : [],
          });
        if (meal.purchased && !priceKnown)
          issues.push({
            code: "MEAL_PRICE_UNKNOWN",
            severity: "unknown",
            date: day.date,
            message:
              "Biaya porsi makan yang perlu dibeli belum memiliki bukti aktif; tidak diganti nol.",
          });
        if (meal.purchased && !mealService && (!dietaryKnown || !accessKnown))
          issues.push({
            code: "MEAL_REQUIREMENT_UNSUPPORTED",
            severity: "unknown",
            date: day.date,
            message:
              "Kebutuhan diet atau akses untuk seluruh porsi makan belum dapat dibuktikan oleh fixture.",
          });
      }
      const availablePlaces = places.filter(
        (place) => !usedPlaceIds.has(place.id),
      );
      const approvedIds = new Set(
        result.recommendation?.rankings.map((row) => row.placeId),
      );
      const knownMealFloor = lines
        .filter((line) => line.id.startsWith("meal-"))
        .reduce((sum, line) => sum + BigInt(line.lowerIdr ?? 0), 0n);
      const diagnosticOnly =
        Boolean(result.recommendation) &&
        knownMealFloor > BigInt(input.budgetIdr);
      if (
        diagnosticOnly &&
        !issues.some((issue) => issue.code === "MEAL_BUDGET_FLOOR")
      )
        issues.push({
          code: "MEAL_BUDGET_FLOOR",
          severity: "violation",
          message:
            "Biaya minimum porsi makan yang sudah diketahui melampaui anggaran. Agenda berikut hanya diagnosis deterministik terblokir, bukan rekomendasi yang lolos filter.",
        });
      const futureMealVenues = new Set(
        input.days
          .slice(input.days.indexOf(dayInput) + 1)
          .flatMap((futureDay) =>
            futureDay.meals.flatMap((meal) => {
              const request = meal.scheduling;
              return request?.mode === "scheduled"
                ? mealServices
                    .filter((service) => service.id === request.serviceId)
                    .map((service) => service.placeId)
                : [];
            }),
          ),
      );
      const activeMealVenues = new Set(
        [...activeMealServices.values()].map((service) => service.placeId),
      );
      const rankingPlaces =
        result.recommendation && !diagnosticOnly
          ? availablePlaces.filter(
              (place) =>
                approvedIds.has(place.id) &&
                (!futureMealVenues.has(place.id) ||
                  activeMealVenues.has(place.id)),
            )
          : availablePlaces.filter(
              (place) =>
                !futureMealVenues.has(place.id) ||
                activeMealVenues.has(place.id),
            );
      const fixedDay = explicit?.find((entry) => entry.date === day.date);
      const selection = fixedDay
        ? explicitDaySelection(
            fixedDay,
            places,
            usedPlaceIds,
            input,
            evaluatedAt,
            issues,
            explicitUnknownCategories,
          )
        : selectDayPlaces(
            rankingPlaces,
            input,
            day.date,
            remaining,
            evaluatedAt,
            result.recommendation?.rankings,
            [...activeMealServices.values()].map((service) => service.placeId),
            {
              fillOptional: false,
              serviceWindows: new Map(
                [...activeMealServices.entries()].flatMap(
                  ([mealId, service]) => {
                    const request = dayInput.meals.find(
                      (meal) => meal.id === mealId,
                    )!.scheduling;
                    return request?.mode === "scheduled"
                      ? [[service.placeId, request.window] as const]
                      : [];
                  },
                ),
              ),
            },
          );
      for (const [mealId, service] of activeMealServices) {
        if (!selection.chosen.some((place) => place.id === service.placeId)) {
          const venue = places.find((place) => place.id === service.placeId);
          const unknownVenue =
            !venue ||
            placeEligibility(venue, input, day.date, evaluatedAt).unknown;
          issues.push({
            code: fixedDay
              ? "MEAL_SERVICE_EDIT_REMOVED"
              : "MEAL_SERVICE_PLACE_UNAVAILABLE",
            severity: fixedDay || !unknownVenue ? "violation" : "unknown",
            date: day.date,
            placeId: service.placeId,
            message: `${dayInput.meals.find((meal) => meal.id === mealId)!.label}: lokasi layanan yang diminta tidak ada dalam kunjungan terpilih. Makan tetap diperhitungkan; syarat tidak diubah otomatis.`,
          });
        }
      }
      if (
        activeMealVenues.size +
          Number(day.coverage === "both" || day.coverage === "culture-only") >
        input.stopCap
      )
        issues.push({
          code: "MEAL_STOP_CAP",
          severity: "violation",
          date: day.date,
          message:
            "Jumlah lokasi layanan makan yang diminta melampaui batas kunjungan harian; layanan tidak dihapus dari kebutuhan atau anggaran.",
        });
      if (selection.chosen.length > input.stopCap)
        issues.push({
          code: "MEAL_STOP_CAP",
          severity: "violation",
          date: day.date,
          message:
            "Seluruh layanan makan dan kunjungan yang diminta melampaui batas kunjungan harian. Batas tidak dinaikkan otomatis.",
        });
      day.utilization = {
        style: input.planningStyle === "pace" ? input.pace : "short",
        searchIncomplete: true,
        reasonCodes: [
          fixedDay
            ? "EXPLICIT_EDIT"
            : day.coverage === "free"
              ? "FREE_DAY"
              : input.planningStyle !== "pace"
                ? "SHORT_PLAN"
                : selection.chosen.length >= input.stopCap
                  ? "PACE_CAP"
                  : "reserved" in selection && selection.reserved
                    ? "CATALOGUE_RESERVED"
                    : "NO_MORE_ELIGIBLE",
          ...(activeMealServices.size
            ? ["MEAL_SERVICE_REQUIRED" as const]
            : []),
        ],
      };
      await scheduleDay(
        day,
        selection.chosen,
        input,
        routing,
        work,
        evaluatedAt,
        issues,
        lines,
        fixedDay,
        activeMealServices,
        new Set(),
        futureMealUpperCost(
          input.days.slice(input.days.indexOf(dayInput) + 1),
          allowance,
          mealServices,
        ),
      );
      if (fixedDay)
        day.stops.forEach((stop) => {
          stop.id = fixedDay.stops.find(
            (entry) => entry.placeId === stop.placeId,
          )!.id;
        });
      // The local route contract contains duration/distance/cost evidence, not a
      // competent step-free assessment of every route connector and daily anchor.
      if (input.accessibilityRequirement === "step-free" && day.legs.length) {
        issues.push({
          code: "ROUTE_ACCESSIBILITY_UNKNOWN",
          severity: "unknown",
          date: day.date,
          message:
            "Kesesuaian tanpa tangga untuk seluruh rute, titik awal dan titik akhir belum dimodelkan. Bukti akses tempat atau jarak pendek tidak membuktikannya; kebutuhan tetap dipertahankan.",
        });
      }
      day.stops.forEach((stop) => {
        stop.categoryIds.forEach((id) => remaining.delete(id));
        usedPlaceIds.add(stop.placeId);
        catalogueRefs.push(...stop.evidenceRefs);
      });
      const needsCulture =
        day.coverage === "both" || day.coverage === "culture-only";
      const needsFood = day.coverage === "both" || day.coverage === "food-only";
      const unresolvedFoodRepeats =
        needsFood &&
        !day.culinaryCovered &&
        places.some(
          (place) =>
            place.kind === "food" &&
            usedPlaceIds.has(place.id) &&
            placeEligibility(place, input, day.date, evaluatedAt).eligible,
        );
      if (unresolvedFoodRepeats)
        issues.push({
          code: "FOOD_REPEAT_POLICY_UNRESOLVED",
          severity: "unknown",
          date: day.date,
          message:
            "Tempat kuliner yang tersisa sudah pernah dikunjungi. Preview belum memiliki kebijakan preferensi untuk mengizinkan pengulangan; tempat tidak diulang otomatis.",
        });
      if (
        (needsCulture && !day.culturalCovered) ||
        (needsFood && !day.culinaryCovered)
      ) {
        const missingKinds = [
          ...(needsCulture && !day.culturalCovered ? ["culture"] : []),
          ...(needsFood && !day.culinaryCovered ? ["food"] : []),
        ];
        for (const kind of missingKinds) {
          const uncertainty = fixedDay
            ? ("unknownKinds" in selection &&
                selection.unknownKinds.has(kind)) ||
              (selection.eligible.some((place) => place.kind === kind) &&
                day.legs.some((leg) => leg.status !== "known") &&
                issues.some(
                  (issue) =>
                    issue.date === day.date && issue.severity === "unknown",
                ))
            : selection.eligible.some((place) => place.kind === kind) ||
              availablePlaces.some(
                (place) =>
                  place.kind === kind &&
                  (placeEligibility(place, input, day.date, evaluatedAt)
                    .unknown ||
                    (Boolean(result.recommendation) &&
                      Object.values(place.evidence).some(
                        (ref) =>
                          !evaluateEvidence(ref, day.date, evaluatedAt).usable,
                      ))),
              ) ||
              (kind === "food" && unresolvedFoodRepeats);
          issues.push({
            code: "DAILY_COVERAGE",
            severity: uncertainty ? "unknown" : "violation",
            date: day.date,
            message: `Cakupan ${kind === "culture" ? "budaya" : "kuliner"} harian yang diminta belum terpenuhi oleh kunjungan terjadwal. Pengabaian tidak diterapkan otomatis.`,
          });
        }
        lines.push({
          id: `incomplete-${day.date}`,
          label: "Biaya agenda yang belum terpenuhi",
          date: day.date,
          quantity: 1,
          unit: "group",
          lowerIdr: null,
          upperIdr: null,
          evidenceRefs: [],
        });
      }
    }
    // Establish the complete required trip before optional visits spend money.
    // Every probe below shares the original work budget and recorded deadline.
    if (!explicit && input.planningStyle === "pace" && issues.length === 0) {
      for (const day of days) {
        work.check();
        if (day.coverage === "free" || day.stops.length >= input.stopCap)
          continue;
        const approved = result.recommendation
          ? new Set(result.recommendation.rankings.map((row) => row.placeId))
          : undefined;
        const optionalInput: NormalizedPreferences = {
          ...input,
          days: input.days.map((entry) =>
            entry.date === day.date
              ? { ...entry, coverage: "culture-only" }
              : entry,
          ),
        };
        const additions = selectDayPlaces(
          places.filter(
            (place) =>
              !usedPlaceIds.has(place.id) &&
              (!approved || approved.has(place.id)),
          ),
          optionalInput,
          day.date,
          new Set(),
          evaluatedAt,
          result.recommendation?.rankings,
          [],
          { reserveFutureCoverage: false },
        )
          .chosen.filter((place) => place.kind === "culture")
          .slice(0, input.stopCap - day.stops.length);
        if (!additions.length) {
          if (day.utilization)
            day.utilization.reasonCodes = ["NO_MORE_ELIGIBLE"];
          continue;
        }
        const beforeCount = day.stops.length;
        await scheduleDay(
          day,
          additions,
          input,
          routing,
          work,
          evaluatedAt,
          issues,
          lines,
          undefined,
          new Map(),
          new Set(additions.map((place) => place.id)),
          0n,
          true,
        );
        day.stops.slice(beforeCount).forEach((stop) => {
          usedPlaceIds.add(stop.placeId);
          catalogueRefs.push(...stop.evidenceRefs);
        });
        if (
          day.utilization &&
          !day.utilization.reasonCodes.includes("OPTIONAL_CONSTRAINT")
        )
          day.utilization.reasonCodes = [
            day.stops.length >= input.stopCap ? "PACE_CAP" : "NO_MORE_ELIGIBLE",
          ];
      }
    }
    if (remaining.size) {
      for (const category of remaining) {
        const unresolved = explicit
          ? explicitUnknownCategories.has(category) ||
            explicit.some(
              (entry) =>
                days.some(
                  (day) =>
                    day.date === entry.date &&
                    day.legs.some((leg) => leg.status !== "known"),
                ) &&
                entry.stops.some((stop) => {
                  const place = places.find(
                    (candidate) => candidate.id === stop.placeId,
                  );
                  return (
                    place?.categoryIds.some((id) => id === category) &&
                    placeEligibility(place, input, entry.date, evaluatedAt)
                      .eligible &&
                    !days
                      .flatMap((day) => day.stops)
                      .some((actual) => actual.placeId === place.id)
                  );
                }),
            )
          : places.some(
              (place) =>
                place.kind === "culture" &&
                input.dates.some((date) => {
                  const categoriesKnown = evaluateEvidence(
                    place.evidence.categories,
                    date,
                    evaluatedAt,
                  ).usable;
                  const eligibility = placeEligibility(
                    place,
                    input,
                    date,
                    evaluatedAt,
                  );
                  return (
                    (!categoriesKnown ||
                      place.categoryIds.some((id) => id === category)) &&
                    (eligibility.eligible || eligibility.unknown)
                  );
                }),
            );
        issues.push({
          code: "MANDATORY_COVERAGE",
          severity: unresolved ? "unknown" : "violation",
          message: `Minat budaya wajib ${category} belum dipenuhi oleh kunjungan terjadwal di perjalanan ini.`,
        });
      }
      lines.push({
        id: "mandatory-incomplete",
        label: "Biaya minat wajib yang belum terjadwal",
        quantity: 1,
        unit: "group",
        lowerIdr: null,
        upperIdr: null,
        evidenceRefs: [],
      });
    }
    const routeRefs = days.flatMap((day) =>
      day.legs.flatMap((leg) => leg.evidenceRefs),
    );
    const catalogueCurrent = repository.isCurrent(catalogueRefs);
    const routesCurrent = routing.isCurrent?.(routeRefs) ?? true;
    if (!catalogueCurrent || !routesCurrent) {
      const withdrawn = emptyResult(evaluatedAt, [
        {
          code: catalogueCurrent
            ? "ROUTE_EVIDENCE_CHANGED"
            : "EVIDENCE_HEAD_CHANGED",
          severity: "unknown",
          message: catalogueCurrent
            ? "Bukti rute berubah sebelum hasil selesai. Jadwal, jarak dan angka lama ditarik; hitung ulang dengan bukti rute terkini."
            : "Referensi bukti berubah sebelum hasil selesai. Jadwal dan angka lama ditarik dari hasil; hitung ulang dengan bukti terkini.",
        },
      ]);
      withdrawn.status = "draft";
      if (result.recommendation)
        withdrawn.recommendation = {
          ...result.recommendation,
          source: "unavailable",
          rankings: [],
          rejectionCodes: [
            ...new Set([
              ...result.recommendation.rejectionCodes,
              "EVIDENCE_CHANGED" as const,
            ]),
          ],
        };
      withdrawn.input = structuredClone(input);
      withdrawn.catalogueVersion = repository.version;
      withdrawn.cost = {
        lines: [],
        budgetIdr: input.budgetIdr,
        lowerSubtotalIdr: null,
        upperSubtotalIdr: null,
        contingencyIdr: null,
        totalUpperIdr: null,
      };
      withdrawn.coverage = {
        requiredCategoryIds: [...input.mandatoryInterests],
        fulfilledCategoryIds: [],
        missingCategoryIds: [...input.mandatoryInterests],
      };
      withdrawn.work = {
        routeAttempts: work.routeAttempts,
        elapsedMs: work.elapsedMs,
        modelCalls: result.recommendation?.liveModelCalls ?? 0,
        matrixElements: 0,
        apiCostMicroUsd: 0,
      };
      return freezeDeep(PlanResultSchema.parse(withdrawn));
    }
    result.cost = summarizeCost(lines, input.budgetIdr);
    if (
      result.cost.totalUpperIdr !== null &&
      result.cost.totalUpperIdr > input.budgetIdr
    )
      issues.push({
        code: "BUDGET_EXCEEDED",
        severity: "violation",
        message: `Total batas atas Rp${result.cost.totalUpperIdr.toLocaleString("id-ID")} termasuk cadangan 10% melampaui anggaran. Porsi dan syarat tidak dikurangi.`,
      });
    // Even when an unknown component prevents a total, known costs alone can prove the budget impossible.
    const knownLower = lines.reduce(
      (sum, line) => sum + BigInt(line.lowerIdr ?? 0),
      0n,
    );
    if (
      result.cost.totalUpperIdr === null &&
      knownLower > BigInt(input.budgetIdr)
    )
      issues.push({
        code: "BUDGET_KNOWN_FLOOR",
        severity: "violation",
        message:
          "Biaya minimum yang telah diketahui saja melampaui anggaran; komponen yang belum diketahui tetap kosong.",
      });
    work.check();
  } catch (error) {
    const code =
      error instanceof WorkLimitError
        ? error.message
        : error instanceof Error && error.message === "IDR_OVERFLOW"
          ? "IDR_OVERFLOW"
          : "BOUNDARY_FAILURE";
    issues.push({
      code,
      severity: code === "IDR_OVERFLOW" ? "violation" : "unknown",
      message:
        code === "IDR_OVERFLOW"
          ? "Perhitungan rupiah melampaui rentang bilangan bulat aman; hasil diblokir."
          : "Operasi dihentikan karena batas kerja, kegagalan data atau layanan lokal. Tidak ada hasil yang dilengkapi dengan asumsi tersembunyi.",
    });
    result.cost = {
      lines,
      budgetIdr: input.budgetIdr,
      lowerSubtotalIdr: null,
      upperSubtotalIdr: null,
      contingencyIdr: null,
      totalUpperIdr: null,
    };
  }
  result.coverage = {
    requiredCategoryIds: [...input.mandatoryInterests],
    fulfilledCategoryIds: input.mandatoryInterests.filter(
      (id) => !remaining.has(id),
    ),
    missingCategoryIds: [...remaining],
  };
  result.evidenceRefs = [
    ...new Map(
      [
        ...catalogueRefs,
        ...days.flatMap((day) => day.legs.flatMap((leg) => leg.evidenceRefs)),
      ].map((ref) => [ref.assertionId, ref]),
    ).values(),
  ];
  result.status = issues.some((issue) => issue.severity === "violation")
    ? "blocked"
    : issues.length
      ? "draft"
      : "validated";
  result.work = {
    routeAttempts: work.routeAttempts,
    modelCalls: result.recommendation?.liveModelCalls ?? 0,
    matrixElements: 0,
    apiCostMicroUsd: 0,
    elapsedMs: work.elapsedMs,
  };
  const parsedResult = PlanResultSchema.safeParse(result);
  if (!parsedResult.success)
    return freezeDeep({
      ...emptyResult(evaluatedAt, [
        {
          code: "RESULT_INVALID",
          severity: "unknown",
          message:
            "Hasil gagal pemeriksaan kontrak internal; tidak dipromosikan menjadi rencana valid.",
        },
      ]),
      status: "draft",
    });
  return freezeDeep(parsedResult.data);
}
