import { z } from "zod";
import {
  DateSchema,
  IntegerSchema,
  type NormalizedPreferences,
  type SyntheticPlace,
} from "../contracts";
import { evaluateEvidence } from "../evidence";
import { placeEligibility } from "./selection";
import type { PlanIssue } from "./types";

export const PlanningSelectionSchema = z
  .array(
    z.strictObject({
      date: DateSchema,
      stops: z
        .array(
          z.strictObject({
            id: z.string().min(1).max(120),
            placeId: z.string().min(1).max(120),
            lockedStartMinute: IntegerSchema.max(1439).nullable(),
            lockedDurationMinutes: IntegerSchema.positive().max(480).nullable(),
          }),
        )
        .max(5),
    }),
  )
  .min(1)
  .max(7)
  .superRefine((days, context) => {
    const logicalIds = days.flatMap((day) => day.stops.map((stop) => stop.id));
    if (
      new Set(logicalIds).size !== logicalIds.length ||
      new Set(days.map((day) => day.date)).size !== days.length
    )
      context.addIssue({
        code: "custom",
        message: "Explicit daily selection IDs must be unique.",
      });
  });
export type PlanningDaySelection = z.infer<
  typeof PlanningSelectionSchema
>[number];
export function explicitDaySelection(
  selection: PlanningDaySelection,
  places: SyntheticPlace[],
  used: Set<string>,
  input: NormalizedPreferences,
  asOf: string,
  issues: PlanIssue[],
  unknownCategories: Set<string>,
) {
  const chosen: SyntheticPlace[] = [];
  const unknownKinds = new Set<string>();
  if (selection.stops.length > input.stopCap)
    issues.push({
      code: "STOP_CAP",
      severity: "violation",
      date: selection.date,
      message:
        "Jumlah kunjungan pilihan melebihi batas ritme; kunjungan tidak dihapus otomatis.",
    });
  for (const stop of selection.stops) {
    const place = places.find((entry) => entry.id === stop.placeId);
    if (!place) {
      issues.push({
        code: "EDIT_PLACE_NOT_ALLOWLISTED",
        severity: "violation",
        date: selection.date,
        placeId: stop.placeId,
        message: "Tujuan pilihan tidak ada dalam katalog sintetis kota ini.",
      });
      continue;
    }
    if (used.has(place.id) || chosen.some((entry) => entry.id === place.id)) {
      issues.push({
        code:
          place.kind === "culture"
            ? "CULTURE_REPEAT"
            : "FOOD_REPEAT_POLICY_UNRESOLVED",
        severity: place.kind === "culture" ? "violation" : "unknown",
        date: selection.date,
        placeId: place.id,
        message:
          "Tujuan sudah dipilih dalam perjalanan. Tidak ada izin otomatis untuk mengulangnya.",
      });
      if (place.kind === "food") unknownKinds.add("food");
      continue;
    }
    const eligibility = placeEligibility(place, input, selection.date, asOf);
    if (!eligibility.eligible) {
      issues.push({
        code: eligibility.unknown
          ? "EDIT_EVIDENCE_UNKNOWN"
          : "EDIT_PLACE_INELIGIBLE",
        severity: eligibility.unknown ? "unknown" : "violation",
        date: selection.date,
        placeId: place.id,
        message: eligibility.unknown
          ? "Bukti penting untuk tujuan pilihan belum berlaku atau belum tersedia; klaimnya tidak ditampilkan."
          : "Tujuan pilihan tidak memenuhi jam buka, tanggal, diet atau akses yang diwajibkan.",
      });
      if (eligibility.unknown) {
        unknownKinds.add(place.kind);
        if (place.kind === "culture")
          (evaluateEvidence(place.evidence.categories, selection.date, asOf)
            .usable
            ? place.categoryIds
            : input.mandatoryInterests
          ).forEach((id) => unknownCategories.add(id));
      }
      continue;
    }
    chosen.push(place);
  }
  return { chosen, eligible: chosen, unknownKinds };
}
