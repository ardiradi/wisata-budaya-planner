import { z } from "zod";
import {
  DateSchema,
  EvidenceRefSchema,
  IntegerSchema,
  NormalizedPreferencesSchema,
  RangeSchema,
  TransportSchema,
  WindowSchema,
} from "../contracts";
import type { PlanResult } from "./types";
import { summarizeCost } from "./cost";
import { arrivalBuffer } from "./schedule";
import { RecommendationReportSchema } from "../recommendations/contracts";
import { evaluateEvidence } from "../evidence";

const refs = z.array(EvidenceRefSchema).max(1000);
const nullableMoney = IntegerSchema.nullable();
const StopSchema = z.strictObject({
  id: z.string().min(1),
  placeId: z.string().regex(/^syn-/),
  name: z.string().min(1),
  kind: z.enum(["culture", "food"]),
  categoryIds: z.array(z.string()).max(3),
  startMinute: IntegerSchema,
  endMinute: IntegerSchema,
  durationMinutes: IntegerSchema.positive(),
  openingWindow: WindowSchema,
  admissionIdr: RangeSchema,
  walkingMeters: RangeSchema,
  evidenceRefs: refs,
});
const LegSchema = z.strictObject({
  fromId: z.string().min(1),
  toId: z.string().min(1),
  mode: TransportSchema,
  departureMinute: IntegerSchema,
  arrivalMinute: IntegerSchema.nullable(),
  durationMinutes: RangeSchema.nullable(),
  walkingMeters: RangeSchema.nullable(),
  costIdr: RangeSchema.nullable(),
  status: z.enum(["known", "unknown", "error"]),
  evidenceRefs: refs,
});
const MealSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  date: DateSchema,
  necessary: IntegerSchema.max(8),
  provided: IntegerSchema.max(8),
  prepaid: IntegerSchema.max(8),
  purchased: IntegerSchema.max(8),
  lowerIdr: nullableMoney,
  upperIdr: nullableMoney,
  evidenceRefs: refs,
  schedulingStatus: z
    .enum(["unscheduled", "scheduled", "unresolved"])
    .optional(),
  serviceId: z.string().nullable().optional(),
  placeId: z.string().nullable().optional(),
  requestedWindow: WindowSchema.nullable().optional(),
  startMinute: IntegerSchema.nullable().optional(),
  endMinute: IntegerSchema.nullable().optional(),
  durationMinutes: IntegerSchema.positive().nullable().optional(),
  serviceChargeIdr: RangeSchema.nullable().optional(),
});
const CostLineSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  date: DateSchema.optional(),
  quantity: IntegerSchema,
  unit: z.enum(["person", "group", "portion"]),
  lowerIdr: nullableMoney,
  upperIdr: nullableMoney,
  evidenceRefs: refs,
});

/** Output guard catches accidental promotion of partial/invalid schedules at the UI boundary. */
export const PlanResultSchema: z.ZodType<PlanResult> = z
  .strictObject({
    recommendation: RecommendationReportSchema.optional(),
    status: z.enum(["validated", "draft", "blocked"]),
    synthetic: z.literal(true),
    independentlyReviewed: z.literal(false),
    input: NormalizedPreferencesSchema.nullable(),
    days: z
      .array(
        z.strictObject({
          date: DateSchema,
          startMinute: IntegerSchema,
          endMinute: IntegerSchema,
          startAnchor: z.string(),
          endAnchor: z.string(),
          coverage: z.string(),
          stops: z.array(StopSchema).max(5),
          legs: z.array(LegSchema).max(6),
          meals: z.array(MealSchema).max(13),
          walkingUpperMeters: IntegerSchema.nullable(),
          culturalCovered: z.boolean(),
          culinaryCovered: z.boolean(),
          utilization: z
            .strictObject({
              style: z.enum(["short", "relaxed", "balanced", "active"]),
              searchIncomplete: z.literal(true),
              reasonCodes: z.array(
                z.enum([
                  "SHORT_PLAN",
                  "PACE_CAP",
                  "CATALOGUE_RESERVED",
                  "NO_MORE_ELIGIBLE",
                  "FREE_DAY",
                  "EXPLICIT_EDIT",
                  "MEAL_SERVICE_REQUIRED",
                  "OPTIONAL_CONSTRAINT",
                ]),
              ),
            })
            .optional(),
        }),
      )
      .max(7),
    issues: z.array(
      z.strictObject({
        code: z.string().min(1),
        severity: z.enum(["unknown", "violation"]),
        message: z.string().min(1),
        date: DateSchema.optional(),
        placeId: z.string().optional(),
      }),
    ),
    cost: z.strictObject({
      lines: z.array(CostLineSchema),
      lowerSubtotalIdr: nullableMoney,
      upperSubtotalIdr: nullableMoney,
      contingencyIdr: nullableMoney,
      totalUpperIdr: nullableMoney,
      budgetIdr: nullableMoney,
    }),
    coverage: z.strictObject({
      requiredCategoryIds: z.array(z.string()),
      fulfilledCategoryIds: z.array(z.string()),
      missingCategoryIds: z.array(z.string()),
    }),
    work: z.strictObject({
      routeAttempts: IntegerSchema.max(42),
      modelCalls: z.number().int().min(0).max(2),
      matrixElements: z.literal(0),
      apiCostMicroUsd: z.literal(0),
      elapsedMs: IntegerSchema,
    }),
    evidenceRefs: refs,
    catalogueVersion: z.string().min(1),
    evaluatedAt: z.iso.datetime(),
  })
  .superRefine((result, context) => {
    const fail = (message: string) =>
      context.addIssue({ code: "custom", message });
    for (const day of result.days) {
      for (const meal of day.meals)
        if (meal.purchased !== meal.necessary - meal.provided - meal.prepaid)
          fail("Meal portions do not reconcile.");
      for (const meal of day.meals) {
        if (meal.schedulingStatus !== "scheduled") {
          if (
            meal.startMinute != null ||
            meal.endMinute != null ||
            meal.durationMinutes != null
          )
            fail("An unscheduled meal cannot claim a meal time.");
          continue;
        }
        const stop = day.stops.find((entry) => entry.placeId === meal.placeId);
        const request = result.input?.days
          .find((entry) => entry.date === day.date)
          ?.meals.find((entry) => entry.id === meal.id)?.scheduling;
        const fields = [
          "location",
          "service",
          "portions",
          "charges",
          ...(result.input?.dietaryRequirement !== "none" ? ["dietary"] : []),
          ...(result.input?.accessibilityRequirement !== "none"
            ? ["accessibility"]
            : []),
        ];
        if (
          !stop ||
          request?.mode !== "scheduled" ||
          !request.windowConfirmed ||
          request.serviceId !== meal.serviceId ||
          !meal.necessary ||
          !meal.requestedWindow ||
          JSON.stringify(request.window) !==
            JSON.stringify(meal.requestedWindow) ||
          meal.startMinute == null ||
          meal.endMinute == null ||
          !meal.durationMinutes ||
          meal.endMinute - meal.startMinute !== meal.durationMinutes ||
          meal.startMinute <
            Math.max(stop.startMinute, request.window.startMinute) ||
          meal.endMinute > Math.min(stop.endMinute, request.window.endMinute) ||
          fields.some(
            (field) =>
              !meal.evidenceRefs.some(
                (ref) =>
                  ref.sourceId === `fixture-source:${meal.serviceId}` &&
                  ref.field === field &&
                  evaluateEvidence(ref, day.date, result.evaluatedAt).usable,
              ),
          )
        )
          fail(
            "A scheduled meal needs an explicit confirmed request, service evidence and a fitting visit interval.",
          );
      }
      for (const stop of day.stops)
        if (
          stop.endMinute - stop.startMinute !== stop.durationMinutes ||
          stop.startMinute < stop.openingWindow.startMinute ||
          stop.endMinute > stop.openingWindow.endMinute
        )
          fail("A scheduled visit violates its opening/dwell contract.");
      for (const leg of day.legs)
        if (
          leg.status === "known" &&
          (leg.durationMinutes === null ||
            leg.arrivalMinute !==
              leg.departureMinute + leg.durationMinutes.upper ||
            !leg.costIdr ||
            !leg.walkingMeters ||
            !leg.evidenceRefs.length)
        )
          fail("A known route is incomplete.");
    }
    if (result.status === "validated") {
      const scheduledIds = result.days.flatMap((day) =>
        day.stops.map((stop) => stop.placeId),
      );
      if (new Set(scheduledIds).size !== scheduledIds.length)
        fail(
          "Cultural venues cannot repeat; food repeats require an explicit policy absent from B1.",
        );
      if (
        result.issues.length ||
        result.coverage.missingCategoryIds.length ||
        !result.input ||
        result.days.length !== result.input.dates.length ||
        result.cost.totalUpperIdr === null ||
        result.cost.totalUpperIdr > result.input.budgetIdr ||
        result.work.elapsedMs >= 45000
      )
        fail("An incomplete or over-budget result cannot be validated.");
      result.days.forEach((day, dayIndex) => {
        if (
          result.input?.dietaryRequirement !== "none" &&
          day.meals.some(
            (meal) =>
              meal.provided + meal.prepaid > 0 &&
              meal.schedulingStatus !== "scheduled",
          )
        )
          fail("Cost coverage declarations do not prove dietary suitability.");
        if (
          result.input?.accessibilityRequirement === "step-free" &&
          day.legs.length
        )
          fail("The preview has no route/anchor step-free evidence contract.");
        if (
          !result.input ||
          day.date !== result.input.dates[dayIndex] ||
          day.stops.length > result.input.stopCap ||
          day.walkingUpperMeters === null ||
          day.walkingUpperMeters > result.input.walkingLimit ||
          day.legs.some((leg) => leg.status !== "known") ||
          day.legs.some((leg) => leg.mode !== result.input!.transport) ||
          day.meals.some((meal) => meal.upperIdr === null)
        )
          fail("A validated day violates a hard constraint.");
        if (
          day.legs.length &&
          (day.legs[0].fromId !== day.startAnchor ||
            day.legs.at(-1)!.toId !== day.endAnchor)
        )
          fail("Both daily anchors must be included.");
        const requested = result.input?.days.find(
          (entry) => entry.date === day.date,
        );
        if (
          !requested ||
          !requested.inventoryConfirmed ||
          requested.meals.some(
            (meal) => meal.necessary === 0 && !meal.confirmedZero,
          )
        )
          fail("Meal inventory must be explicitly confirmed.");
        if (
          requested?.meals.some(
            (meal) =>
              meal.scheduling?.mode === "scheduled" &&
              !day.meals.some(
                (actual) =>
                  actual.id === meal.id &&
                  actual.schedulingStatus === "scheduled",
              ),
          )
        )
          fail(
            "Every explicitly requested meal must be scheduled before validation.",
          );
        if (
          requested &&
          (requested.startMinute !== day.startMinute ||
            requested.endMinute !== day.endMinute ||
            requested.startAnchor !== day.startAnchor ||
            requested.endAnchor !== day.endAnchor ||
            requested.coverage !== day.coverage ||
            requested.meals.length !== day.meals.length ||
            requested.meals.some(
              (meal) =>
                !day.meals.some(
                  (actual) =>
                    actual.id === meal.id &&
                    actual.necessary === meal.necessary &&
                    actual.provided === meal.provided &&
                    actual.prepaid === meal.prepaid &&
                    actual.purchased === meal.purchased,
                ),
            ))
        )
          fail(
            "The result must preserve every submitted daily constraint and meal occasion.",
          );
        const culture = day.stops.some((stop) => stop.kind === "culture");
        const food = day.stops.some((stop) => stop.kind === "food");
        if (
          culture !== day.culturalCovered ||
          food !== day.culinaryCovered ||
          ((day.coverage === "both" || day.coverage === "culture-only") &&
            !culture) ||
          ((day.coverage === "both" || day.coverage === "food-only") && !food)
        )
          fail("Requested daily coverage must be scheduled.");
        if (
          day.stops.some(
            (stop) =>
              stop.startMinute < day.startMinute ||
              stop.endMinute > day.endMinute,
          )
        )
          fail("A stop falls outside daily availability.");
        const walking =
          day.legs.reduce(
            (sum, leg) => sum + BigInt(leg.walkingMeters?.upper ?? 0),
            0n,
          ) +
          day.stops.reduce(
            (sum, stop) => sum + BigInt(stop.walkingMeters.upper),
            0n,
          );
        if (
          day.walkingUpperMeters === null ||
          walking !== BigInt(day.walkingUpperMeters)
        )
          fail("All walking components must reconcile per traveler.");
        if (day.legs.length) {
          if (
            day.legs.length !== day.stops.length + 1 ||
            day.legs[0].departureMinute !== day.startMinute
          )
            fail(
              "Every selected visit and both anchors need a continuous route chain.",
            );
          day.stops.forEach((stop, index) => {
            const inbound = day.legs[index];
            const outbound = day.legs[index + 1];
            if (
              !inbound ||
              !outbound ||
              inbound.toId !== stop.placeId ||
              outbound.fromId !== stop.placeId ||
              outbound.departureMinute !== stop.endMinute ||
              inbound.arrivalMinute === null ||
              !inbound.durationMinutes ||
              inbound.arrivalMinute +
                arrivalBuffer(inbound.durationMinutes.upper) >
                stop.startMinute
            )
              fail("Route continuity or arrival buffer is invalid.");
          });
          const last = day.legs.at(-1)!;
          if (
            last.arrivalMinute === null ||
            !last.durationMinutes ||
            last.arrivalMinute + arrivalBuffer(last.durationMinutes.upper) >
              day.endMinute
          )
            fail("The return leg and final buffer must fit.");
        } else if (day.stops.length || day.startAnchor !== day.endAnchor)
          fail("Different anchors or visits cannot skip travel.");
      });
      const scheduledCategories = new Set(
        result.days.flatMap((day) =>
          day.stops.flatMap((stop) => stop.categoryIds),
        ),
      );
      if (
        result.input?.mandatoryInterests.some(
          (id) => !scheduledCategories.has(id),
        ) ||
        JSON.stringify(result.coverage.requiredCategoryIds) !==
          JSON.stringify(result.input?.mandatoryInterests) ||
        JSON.stringify(result.coverage.fulfilledCategoryIds) !==
          JSON.stringify(result.input?.mandatoryInterests)
      )
        fail("Only scheduled eligible visits fulfill mandatory interests.");
      const costRows = new Map(
        result.cost.lines.map((line) => [line.id, line]),
      );
      const expectedCostIds: string[] = [];
      const reconcileCost = (
        id: string,
        date: string,
        lowerIdr: number | null,
        upperIdr: number | null,
        unit?: "group" | "portion",
        quantity?: number,
      ) => {
        expectedCostIds.push(id);
        const row = costRows.get(id);
        if (
          !row ||
          row.date !== date ||
          row.lowerIdr !== lowerIdr ||
          row.upperIdr !== upperIdr ||
          (unit !== undefined && row.unit !== unit) ||
          (quantity !== undefined && row.quantity !== quantity) ||
          (unit === undefined &&
            (row.unit === "portion" ||
              row.quantity !==
                (row.unit === "person" ? result.input?.party : 1)))
        )
          fail(
            "Every meal, visit and route must retain its exact group cost row.",
          );
      };
      for (const day of result.days) {
        day.meals
          .filter((meal) => meal.schedulingStatus === "scheduled")
          .forEach((meal) =>
            reconcileCost(
              `meal-service-${day.date}-${meal.id}`,
              day.date,
              meal.serviceChargeIdr?.lower ?? null,
              meal.serviceChargeIdr?.upper ?? null,
              "group",
              1,
            ),
          );
        day.meals.forEach((meal) =>
          reconcileCost(
            `meal-${day.date}-${meal.id}`,
            day.date,
            meal.lowerIdr,
            meal.upperIdr,
            "portion",
            meal.purchased,
          ),
        );
        day.stops.forEach((stop) =>
          reconcileCost(
            `visit-${day.date}-${stop.placeId}`,
            day.date,
            stop.admissionIdr.lower,
            stop.admissionIdr.upper,
          ),
        );
        day.legs.forEach((leg, index) =>
          reconcileCost(
            `route-${day.date}-${index + 1}`,
            day.date,
            leg.costIdr?.lower ?? null,
            leg.costIdr?.upper ?? null,
            "group",
            1,
          ),
        );
      }
      if (
        costRows.size !== result.cost.lines.length ||
        expectedCostIds.length !== result.cost.lines.length ||
        new Set(expectedCostIds).size !== expectedCostIds.length
      )
        fail(
          "Cost rows cannot be omitted, duplicated or added to a validated plan.",
        );
      try {
        const expected = summarizeCost(
          result.cost.lines,
          result.input?.budgetIdr ?? null,
        );
        if (
          expected.lowerSubtotalIdr !== result.cost.lowerSubtotalIdr ||
          expected.upperSubtotalIdr !== result.cost.upperSubtotalIdr ||
          expected.contingencyIdr !== result.cost.contingencyIdr ||
          expected.totalUpperIdr !== result.cost.totalUpperIdr ||
          expected.budgetIdr !== result.cost.budgetIdr
        )
          fail("Group costs and contingency must reconcile exactly.");
      } catch {
        fail("Currency arithmetic overflowed.");
      }
    }
  });
