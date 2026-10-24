import {
  RouteOutcomeSchema,
  type EvidenceRef,
  type MealService,
  type NormalizedPreferences,
  type RouteData,
  type RouteRequest,
  type RoutingProvider,
  type SyntheticPlace,
} from "../contracts";
import { evaluateEvidence } from "../evidence";
import { charge } from "./cost";
import { WorkBudget, WorkLimitError } from "./work";
import type { CostLine, PlanDay, PlanIssue, PlanLeg } from "./types";
import type { PlanningDaySelection } from "./explicit-selection";

export const arrivalBuffer = (upperMinutes: number) =>
  Math.max(10, Math.ceil(upperMinutes / 4));
const sameRequest = (a: RouteRequest, b: RouteRequest) =>
  a.fromId === b.fromId &&
  a.toId === b.toId &&
  a.mode === b.mode &&
  a.date === b.date &&
  a.departureMinute === b.departureMinute &&
  a.party === b.party;

export async function resolveLeg(
  request: RouteRequest,
  provider: RoutingProvider,
  work: WorkBudget,
  asOf: string,
  issues: PlanIssue[],
): Promise<PlanLeg> {
  let data: RouteData | undefined;
  let status: PlanLeg["status"] = "unknown";
  let issueCode = "ROUTE_UNKNOWN";
  let message =
    "Bukti rute sintetis belum tersedia; durasi, jarak berjalan dan biaya tidak diisi.";
  // At most one retry, only when it fits the same immutable operation's work ceiling.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const parsed = RouteOutcomeSchema.safeParse(
        await work.route(() => provider.resolve(request)),
      );
      if (!parsed.success) {
        issueCode = "ROUTE_INVALID";
        break;
      }
      const result = parsed.data;
      if (result.status === "ok") {
        if (
          !sameRequest(result.data.binding, request) ||
          !evaluateEvidence(result.data.evidence, request.date, asOf).usable ||
          (request.mode === "walk" &&
            result.data.walkingMeters.upper < result.data.distanceMeters.upper)
        ) {
          issueCode = "ROUTE_BINDING_OR_EVIDENCE";
          break;
        }
        data = result.data;
        status = "known";
        break;
      }
      if (result.status === "unreachable") {
        status = "error";
        issueCode = "ROUTE_UNREACHABLE";
        message =
          "Rute pilihan terhalang pada fixture sintetis; moda atau syarat tidak diubah otomatis.";
        break;
      }
      if (result.retryable && attempt === 0 && work.routeAttempts < 42)
        continue;
      status = result.status === "error" ? "error" : "unknown";
      break;
    } catch (error) {
      issueCode =
        error instanceof WorkLimitError ? error.message : "ROUTE_ERROR";
      status = "unknown";
      break;
    }
  }
  if (!data)
    issues.push({
      code: issueCode,
      severity: issueCode === "ROUTE_UNREACHABLE" ? "violation" : "unknown",
      date: request.date,
      message,
    });
  const refs: EvidenceRef[] = data ? [data.evidence] : [];
  return {
    fromId: request.fromId,
    toId: request.toId,
    mode: request.mode,
    departureMinute: request.departureMinute,
    arrivalMinute: data
      ? request.departureMinute + data.durationMinutes.upper
      : null,
    durationMinutes: data?.durationMinutes ?? null,
    walkingMeters: data?.walkingMeters ?? null,
    costIdr: data
      ? { lower: data.costIdr.lower, upper: data.costIdr.upper }
      : null,
    status,
    evidenceRefs: refs,
  };
}

export async function scheduleDay(
  day: PlanDay,
  chosen: SyntheticPlace[],
  input: NormalizedPreferences,
  routing: RoutingProvider,
  work: WorkBudget,
  asOf: string,
  issues: PlanIssue[],
  lines: CostLine[],
  explicit?: PlanningDaySelection,
  mealServices: ReadonlyMap<string, MealService> = new Map(),
  optionalPlaceIds: ReadonlySet<string> = new Set(),
  reservedFutureMealUpperIdr = 0n,
  resumeOptional = false,
) {
  const baselineReturn = resumeOptional ? day.legs.pop() : undefined;
  if (baselineReturn) {
    const row = lines.findIndex(
      (line) => line.id === `route-${day.date}-${day.legs.length + 1}`,
    );
    if (row >= 0) lines.splice(row, 1);
  }
  let cursor = resumeOptional
    ? (day.stops.at(-1)?.endMinute ?? day.startMinute)
    : day.startMinute;
  let previous = resumeOptional
    ? (day.stops.at(-1)?.placeId ?? day.startAnchor)
    : day.startAnchor;
  let walking = resumeOptional
    ? day.walkingUpperMeters! - (baselineReturn?.walkingMeters?.upper ?? 0)
    : 0;
  let unknown = false;
  let pendingReturn: { binding: RouteRequest; leg: PlanLeg } | undefined =
    baselineReturn
      ? {
          binding: {
            fromId: baselineReturn.fromId,
            toId: baselineReturn.toId,
            mode: baselineReturn.mode,
            date: day.date,
            departureMinute: baselineReturn.departureMinute,
            party: input.party,
          },
          leg: baselineReturn,
        }
      : undefined;
  const noteOptionalConstraint = () => {
    if (!day.utilization) return;
    day.utilization.reasonCodes = [
      ...new Set([
        ...day.utilization.reasonCodes.filter((code) => code !== "PACE_CAP"),
        "OPTIONAL_CONSTRAINT" as const,
      ]),
    ];
  };
  const addLeg = async (
    toId: string,
    resolved?: { binding: RouteRequest; leg: PlanLeg },
  ) => {
    if (cursor > 1439) {
      issues.push({
        code: "DAY_WINDOW",
        severity: "violation",
        date: day.date,
        message: "Perjalanan tidak muat dalam jendela hari yang dipilih.",
      });
      return null;
    }
    const request: RouteRequest = {
      fromId: previous,
      toId,
      mode: input.transport,
      date: day.date,
      departureMinute: cursor,
      party: input.party,
    };
    const leg =
      resolved && sameRequest(resolved.binding, request)
        ? resolved.leg
        : await resolveLeg(request, routing, work, asOf, issues);
    day.legs.push(leg);
    lines.push({
      id: `route-${day.date}-${day.legs.length}`,
      label: `Perjalanan ${previous} → ${toId}`,
      date: day.date,
      quantity: 1,
      unit: "group",
      lowerIdr: leg.costIdr?.lower ?? null,
      upperIdr: leg.costIdr?.upper ?? null,
      evidenceRefs: leg.evidenceRefs,
    });
    if (leg.arrivalMinute === null) {
      unknown = true;
      return null;
    }
    cursor = leg.arrivalMinute;
    walking += leg.walkingMeters!.upper;
    previous = toId;
    return leg;
  };
  for (const place of chosen) {
    const optional = optionalPlaceIds.has(place.id);
    const saved = {
      cursor,
      previous,
      walking,
      unknown,
      legs: day.legs.length,
      stops: day.stops.length,
      lines: lines.length,
      issues: issues.length,
      pendingReturn,
    };
    const discardOptional = () => {
      cursor = saved.cursor;
      previous = saved.previous;
      walking = saved.walking;
      unknown = saved.unknown;
      day.legs.length = saved.legs;
      day.stops.length = saved.stops;
      lines.length = saved.lines;
      issues.length = saved.issues;
      pendingReturn = saved.pendingReturn;
      noteOptionalConstraint();
    };
    const laterDays = resumeOptional
      ? 0
      : input.days.length -
        input.days.findIndex((entry) => entry.date === day.date) -
        1;
    // Keep headroom for a directed optional leg, its return proof and every later
    // day's existing maximum-density route chain. Failed probes still count.
    if (
      optional &&
      (unknown || 42 - work.routeAttempts < 6 + laterDays * (input.stopCap + 1))
    ) {
      noteOptionalConstraint();
      continue;
    }
    pendingReturn = undefined;
    const leg = await addLeg(place.id);
    if (!leg) {
      if (optional) {
        discardOptional();
        continue;
      }
      break;
    }
    const earliest = cursor + arrivalBuffer(leg.durationMinutes!.upper);
    const locked = explicit?.stops.find((entry) => entry.placeId === place.id);
    const heldStart = locked?.lockedStartMinute;
    const requestedMeal = day.meals.find(
      (meal) => mealServices.get(meal.id)?.placeId === place.id,
    );
    const mealService = requestedMeal
      ? mealServices.get(requestedMeal.id)
      : undefined;
    const requestedWindow = requestedMeal?.requestedWindow;
    const duration =
      locked?.lockedDurationMinutes ??
      Math.max(place.minutes, mealService?.durationMinutes ?? 0);
    if (
      (heldStart !== null && heldStart !== undefined && earliest > heldStart) ||
      duration < Math.max(place.minutes, mealService?.durationMinutes ?? 0)
    ) {
      issues.push({
        code: "LOCK_TIME_CONFLICT",
        severity: "violation",
        date: day.date,
        placeId: place.id,
        message:
          "Perjalanan atau durasi minimum terkini tidak cocok dengan jam/durasi terkunci. Kunci tetap dipertahankan; buka kunci untuk mengubahnya.",
      });
      if (optional) {
        discardOptional();
        continue;
      }
      break;
    }
    const windows =
      place.exceptions.find((entry) => entry.date === day.date)?.windows ??
      place.windows;
    const fitsMeal = (start: number) => {
      if (!mealService || !requestedWindow) return true;
      const mealStart = Math.max(start, requestedWindow.startMinute);
      return mealService.windows.some((serviceWindow) => {
        const serviceStart = Math.max(mealStart, serviceWindow.startMinute);
        return (
          serviceStart + mealService.durationMinutes <=
          Math.min(
            start + duration,
            serviceWindow.endMinute,
            requestedWindow.endMinute,
          )
        );
      });
    };
    const proposedStart = (entry: (typeof windows)[number]) =>
      heldStart ??
      Math.max(
        earliest,
        entry.startMinute,
        requestedWindow?.startMinute ?? 0,
        mealService?.windows.find(
          (window) =>
            Math.max(
              earliest,
              entry.startMinute,
              requestedWindow?.startMinute ?? 0,
              window.startMinute,
            ) +
              mealService.durationMinutes <=
            Math.min(
              window.endMinute,
              requestedWindow?.endMinute ?? day.endMinute,
              entry.endMinute,
              day.endMinute,
            ),
        )?.startMinute ?? 0,
      );
    const window = windows.find(
      (entry) =>
        proposedStart(entry) >= entry.startMinute &&
        proposedStart(entry) + duration <=
          Math.min(entry.endMinute, day.endMinute) &&
        fitsMeal(proposedStart(entry)),
    );
    if (!window) {
      issues.push({
        code: requestedMeal
          ? "MEAL_SCHEDULE_CONFLICT"
          : "SEARCH_SELECTION_NO_FIT",
        severity: explicit || requestedMeal ? "violation" : "unknown",
        date: day.date,
        placeId: place.id,
        message: requestedMeal
          ? `${requestedMeal.label}: layanan tidak muat pada urutan, durasi, jam buka atau kunci kunjungan yang dipilih. Jadwal makan dan syarat tidak diubah otomatis.`
          : explicit
            ? "Urutan pilihan tidak muat dalam jendela buka dan waktu tersedia setelah perjalanan serta jeda. Syarat tidak dilonggarkan."
            : "Pilihan deterministik ini tidak muat setelah perjalanan dan jeda. Pencarian terbatas belum membuktikan semua alternatif mustahil; syarat tetap dipertahankan.",
      });
      if (optional) {
        discardOptional();
        continue;
      }
      break;
    }
    const startMinute = proposedStart(window);
    const quantity = place.price.unit === "person" ? input.party : 1;
    const admissionIdr = {
      lower: charge(place.price.lower, quantity),
      upper: charge(place.price.upper, quantity),
    };
    const walkingMeters = {
      lower: place.interiorWalking.lower + place.accessWalking.lower,
      upper: place.interiorWalking.upper + place.accessWalking.upper,
    };
    const evidenceRefs = Object.values(place.evidence);
    day.stops.push({
      id: `${day.date}-${place.id}`,
      placeId: place.id,
      name: place.name,
      kind: place.kind,
      categoryIds: place.kind === "culture" ? place.categoryIds : [],
      startMinute,
      endMinute: startMinute + duration,
      durationMinutes: duration,
      openingWindow: window,
      admissionIdr,
      walkingMeters,
      evidenceRefs,
    });
    if (requestedMeal && mealService && requestedWindow) {
      const serviceWindow = mealService.windows.find(
        (entry) =>
          Math.max(
            startMinute,
            requestedWindow.startMinute,
            entry.startMinute,
          ) +
            mealService.durationMinutes <=
          Math.min(
            startMinute + duration,
            requestedWindow.endMinute,
            entry.endMinute,
          ),
      )!;
      requestedMeal.startMinute = Math.max(
        startMinute,
        requestedWindow.startMinute,
        serviceWindow.startMinute,
      );
      requestedMeal.endMinute =
        requestedMeal.startMinute + mealService.durationMinutes;
      requestedMeal.durationMinutes = mealService.durationMinutes;
      requestedMeal.schedulingStatus = "scheduled";
    }
    lines.push({
      id: `visit-${day.date}-${place.id}`,
      label: `Kunjungan ${place.name}`,
      date: day.date,
      quantity,
      unit: place.price.unit,
      lowerIdr: admissionIdr.lower,
      upperIdr: admissionIdr.upper,
      evidenceRefs: [place.evidence.admission],
    });
    cursor = startMinute + duration;
    walking += walkingMeters.upper;
    if (optional) {
      const probeIssues: PlanIssue[] = [];
      const binding: RouteRequest = {
        fromId: previous,
        toId: day.endAnchor,
        mode: input.transport,
        date: day.date,
        departureMinute: cursor,
        party: input.party,
      };
      const returnLeg = await resolveLeg(
        binding,
        routing,
        work,
        asOf,
        probeIssues,
      );
      const upper =
        lines.reduce(
          (sum, line) => sum + BigInt(line.upperIdr ?? 0),
          BigInt(reservedFutureMealUpperIdr),
        ) + BigInt(returnLeg.costIdr?.upper ?? 0);
      if (
        returnLeg.status !== "known" ||
        returnLeg.arrivalMinute === null ||
        !returnLeg.durationMinutes ||
        !returnLeg.walkingMeters ||
        lines.some((line) => line.upperIdr === null) ||
        walking + returnLeg.walkingMeters.upper > input.walkingLimit ||
        returnLeg.arrivalMinute +
          arrivalBuffer(returnLeg.durationMinutes.upper) >
          day.endMinute ||
        upper + (upper + 9n) / 10n > BigInt(input.budgetIdr)
      ) {
        discardOptional();
        continue;
      }
      pendingReturn = { binding, leg: returnLeg };
    }
  }
  // A free day at one anchor models no travel. Different anchors still require their direct leg.
  if ((day.legs.length || day.startAnchor !== day.endAnchor) && !unknown) {
    const leg = await addLeg(day.endAnchor, pendingReturn);
    if (
      leg &&
      cursor + arrivalBuffer(leg.durationMinutes!.upper) > day.endMinute
    )
      issues.push({
        code: "RETURN_WINDOW",
        severity: "violation",
        date: day.date,
        message:
          "Pilihan ini tidak memiliki cukup waktu untuk kembali dan jeda akhir. Alternatif belum terbukti habis; tidak ada durasi yang dipendekkan.",
      });
  }
  day.walkingUpperMeters = unknown ? null : walking;
  day.culturalCovered = day.stops.some((stop) => stop.kind === "culture");
  day.culinaryCovered = day.stops.some((stop) => stop.kind === "food");
  if (walking > input.walkingLimit)
    issues.push({
      code: "WALKING_LIMIT",
      severity: "violation",
      date: day.date,
      message: `Pilihan ini membutuhkan hingga ${walking} m berjalan per orang, melampaui batas ${input.walkingLimit} m. Batas tidak dilonggarkan; alternatif belum seluruhnya diperiksa.`,
    });
}
