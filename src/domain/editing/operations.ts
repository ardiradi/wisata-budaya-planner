import { EditIntentSchema, EditOperationSchema } from "./contracts";
import type { EditIntent, EditOperation, ItineraryRevision } from "./types";
import type { NormalizedPreferences } from "../contracts";

export class EditConflict extends Error {}
export function initialIntent(result: ItineraryRevision["result"]): EditIntent {
  if (!result.input)
    throw new EditConflict("Hasil tanpa preferensi sah belum dapat diedit.");
  let number = 0;
  return EditIntentSchema.parse({
    days: result.input.days.map((day) => ({
      date: day.date,
      stops: (
        result.days.find((actual) => actual.date === day.date)?.stops ?? []
      ).map((stop) => ({
        id: `stop-${String(++number).padStart(3, "0")}`,
        placeId: stop.placeId,
        lock: null,
      })),
    })),
  });
}
export function assertLocksPreserved(current: EditIntent, next: EditIntent) {
  for (const day of current.days)
    for (const [index, stop] of day.stops.entries()) {
      if (!stop.lock) continue;
      const targetDay = next.days.find(
        (candidate) => candidate.date === day.date,
      );
      const target = targetDay?.stops[index];
      if (
        !target ||
        target.id !== stop.id ||
        target.placeId !== stop.placeId ||
        !target.lock ||
        JSON.stringify(target.lock) !== JSON.stringify(stop.lock)
      )
        throw new EditConflict(
          "Tempat terkunci harus mempertahankan tempat, tanggal, urutan, jam mulai dan durasi. Buka kunci secara eksplisit sebelum mengubahnya.",
        );
    }
}
export function applyOperation(
  base: ItineraryRevision,
  raw: EditOperation,
): { input: NormalizedPreferences; intent: EditIntent } {
  const parsed = EditOperationSchema.safeParse(raw);
  if (!parsed.success)
    throw new EditConflict(
      "Format perubahan tidak sah. Periksa isian dan buat pratinjau baru.",
    );
  const operation = parsed.data;
  const intent = structuredClone(base.intent);
  let input = structuredClone(base.input);
  if (operation.type === "preferences") {
    if (
      operation.input.party !== base.input.party ||
      JSON.stringify(operation.input.dates) !== JSON.stringify(base.input.dates)
    )
      throw new EditConflict(
        "B2 mempertahankan tanggal dan jumlah peserta dalam riwayat ini. Mulai rencana baru secara eksplisit untuk mengubah keduanya.",
      );
    input = operation.input;
  } else if (operation.type === "revert")
    throw new EditConflict(
      "Pemulihan harus memilih revisi melalui sesi riwayat.",
    );
  else if (operation.type === "reorder") {
    const day = intent.days.find((entry) => entry.date === operation.date);
    if (
      !day ||
      new Set(operation.stopIds).size !== operation.stopIds.length ||
      operation.stopIds.length !== day.stops.length ||
      operation.stopIds.some((id) => !day.stops.some((stop) => stop.id === id))
    )
      throw new EditConflict(
        "Urutan harus memuat setiap kunjungan hari ini tepat satu kali.",
      );
    day.stops = operation.stopIds.map((id) =>
      day.stops.find((stop) => stop.id === id)!,
    );
    assertLocksPreserved(base.intent, intent);
  } else {
    const day = intent.days.find((entry) =>
      entry.stops.some((stop) => stop.id === operation.stopId),
    );
    const index =
      day?.stops.findIndex((stop) => stop.id === operation.stopId) ?? -1;
    if (!day || index < 0)
      throw new EditConflict("Kunjungan tidak ditemukan pada revisi dasar.");
    const stop = day.stops[index];
    if (operation.type !== "lock" && stop.lock)
      throw new EditConflict(
        "Kunjungan terkunci. Buka kunci secara eksplisit sebelum menukar atau menghapusnya.",
      );
    if (operation.type === "swap") {
      if (
        intent.days.some((entry) =>
          entry.stops.some(
            (other) =>
              other.id !== stop.id && other.placeId === operation.placeId,
          ),
        )
      )
        throw new EditConflict(
          "Tempat sudah ada dalam perjalanan; pengulangan tidak diizinkan otomatis.",
        );
      stop.placeId = operation.placeId;
    } else if (operation.type === "remove") {
      day.stops.splice(index, 1);
      assertLocksPreserved(base.intent, intent);
    } else if (operation.type === "lock") {
      if (!operation.locked) stop.lock = null;
      else {
        const actual = base.result.days
          .find((entry) => entry.date === day.date)
          ?.stops.find((entry) => entry.placeId === stop.placeId);
        if (!actual || base.availability !== "available")
          throw new EditConflict(
            "Kunci memerlukan kunjungan terjadwal dengan bukti yang masih berlaku.",
          );
        stop.lock = {
          placeId: stop.placeId,
          date: day.date,
          index,
          startMinute: actual.startMinute,
          durationMinutes: actual.durationMinutes,
        };
      }
    }
  }
  return { input, intent: EditIntentSchema.parse(intent) };
}
