import { PlanResultSchema } from "@/domain/planner/result-schema";
import { summarizeDayTiming } from "@/domain/planner/day-summary";

const clock = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const label = (s: string) =>
  Array.from(s, (character) =>
    character.codePointAt(0)! < 32 || character.codePointAt(0) === 127
      ? " "
      : character,
  ).join("");
const amount = (n: number | null) =>
  n === null ? "belum diketahui" : `Rp ${n.toLocaleString("id-ID")}`;

/** Scriptless UTF-8 text, current projection only. No storage or provider request. */
export function createItineraryTextExport(
  value: unknown,
  revisionId: string,
  exportedAt: string,
) {
  const result = PlanResultSchema.parse(value);
  if (!Number.isFinite(Date.parse(exportedAt)))
    throw new Error("Invalid export timestamp");
  const states = {
    validated: "VALID DALAM SIMULASI",
    draft: "DRAF",
    blocked: "TERBLOKIR",
  };
  const lines = [
    "WISATA BUDAYA PLANNER — ITINERARI SINTETIS",
    "Bukan panduan perjalanan nyata. Tidak ada persetujuan manusia independen.",
    `Status: ${states[result.status]}`,
    `Revisi: ${label(revisionId)}`,
    `Dihitung/diperiksa: ${result.evaluatedAt}`,
    `Diekspor: ${exportedAt}`,
    "Zona waktu: Asia/Jakarta (WIB)",
    `Total grup termasuk cadangan: ${amount(result.cost.totalUpperIdr)}`,
    `Anggaran grup: ${amount(result.cost.budgetIdr)}`,
    "Penginapan dan perjalanan antarkota di luar cakupan.",
    "",
  ];
  for (const [index, day] of result.days.entries()) {
    const time = summarizeDayTiming(day);
    lines.push(
      `HARI ${index + 1} — ${day.date}`,
      `Tersedia ${clock(day.startMinute)}–${clock(day.endMinute)} WIB`,
      `Titik: ${label(day.startAnchor)} → ${label(day.endAnchor)}`,
    );
    for (const stop of day.stops)
      lines.push(
        `${clock(stop.startMinute)}–${clock(stop.endMinute)} ${label(stop.name)} [${label(stop.placeId)}]`,
      );
    lines.push("Rute berarah:");
    for (const leg of day.legs)
      lines.push(
        `  ${label(leg.fromId)} → ${label(leg.toId)}: ${clock(leg.departureMinute)}–${leg.arrivalMinute === null ? "?" : clock(leg.arrivalMinute)}; biaya grup ${amount(leg.costIdr?.upper ?? null)}`,
      );
    lines.push(
      time.status === "known"
        ? `Selesai termasuk jeda akhir: ${clock(time.returnReadyMinute!)}; ${time.unallocatedMinutes} menit belum dialokasikan.`
        : "Cakupan waktu belum diketahui.",
      `Jalan kaki: ${day.walkingUpperMeters === null ? "belum diketahui" : `${day.walkingUpperMeters} m/orang batas atas`}`,
      "Makan — biaya dan jadwal diperiksa terpisah; bukan reservasi:",
    );
    for (const meal of day.meals)
      lines.push(
        `  ${label(meal.label)}: ${meal.necessary} perlu; ${meal.provided} dibawa; ${meal.prepaid} prabayar; ${meal.purchased} dibeli; ${amount(meal.lowerIdr)}–${amount(meal.upperIdr)}. ${
          meal.schedulingStatus === "scheduled" &&
          meal.startMinute != null &&
          meal.endMinute != null
            ? `Makan terjadwal dalam simulasi ${clock(meal.startMinute)}–${clock(meal.endMinute)} WIB; ${meal.durationMinutes} menit; ${label(day.stops.find((stop) => stop.placeId === meal.placeId)?.name ?? "layanan sintetis")}. Biaya layanan grup terpisah ${amount(meal.serviceChargeIdr?.lower ?? null)}–${amount(meal.serviceChargeIdr?.upper ?? null)}.`
            : meal.schedulingStatus === "unresolved"
              ? `Jadwal makan belum terpenuhi.${meal.requestedWindow ? ` Rentang diminta ${clock(meal.requestedWindow.startMinute)}–${clock(meal.requestedWindow.endMinute)} WIB.` : ""} Porsi tetap dihitung.`
              : "Biaya tanpa jadwal makan. Jam/tempat belum ditetapkan."
        }`,
      );
    if (day.utilization)
      lines.push(
        `Gaya hari: ${{ short: "singkat", relaxed: "santai", balanced: "seimbang", active: "aktif" }[day.utilization.style]}; ${day.stops.length} kunjungan.`,
        "Pencarian terbatas; waktu kosong bukan bukti bahwa semua kemungkinan telah dicoba. Syarat wajib tidak diubah otomatis.",
      );
    lines.push("");
  }
  if (result.issues.length)
    lines.push(
      "HAL YANG PERLU DIPERIKSA",
      ...result.issues.map((i) => `- ${label(i.code)}: ${label(i.message)}`),
      "",
    );
  lines.push(
    "REFERENSI BUKTI SINTETIS (bukan verifikasi nyata)",
    ...result.evidenceRefs.map((r) => JSON.stringify(r)),
    "",
    "Salinan unduhan tidak diperbarui setelah bukti berubah. Buka aplikasi dan periksa ulang sebelum menggunakan hasil.",
    "M1 OPEN; penerimaan M2 dan produksi belum diberikan.",
  );
  return {
    filename: `wisata-budaya-sintetis-${exportedAt.replace(/[:.]/g, "-")}.txt`,
    text: lines.join("\n"),
  };
}
