import type { PlanMeal } from "@/domain/planner/types";

const clock = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

export function MealScheduleStatus({
  meal,
  placeName,
}: {
  meal: PlanMeal;
  placeName?: string;
}) {
  if (
    meal.schedulingStatus === "scheduled" &&
    meal.startMinute != null &&
    meal.endMinute != null
  )
    return (
      <p className="mt-2 rounded-xl bg-secondary p-3 text-xs leading-6">
        <strong>Makan terjadwal · simulasi</strong>
        <br />
        {clock(meal.startMinute)}–{clock(meal.endMinute)} WIB ·{" "}
        {meal.durationMinutes} menit
        {placeName ? ` · ${placeName}` : ""}. {meal.necessary} porsi diperiksa
        untuk layanan ini; bukan reservasi nyata.
        <br />
        Biaya layanan grup:{" "}
        {meal.serviceChargeIdr
          ? `Rp ${meal.serviceChargeIdr.lower.toLocaleString("id-ID")}–Rp ${meal.serviceChargeIdr.upper.toLocaleString("id-ID")}, terpisah dari biaya porsi.`
          : "belum diketahui."}
      </p>
    );
  if (meal.schedulingStatus === "unresolved")
    return (
      <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-950">
        <strong>Jadwal makan belum terpenuhi.</strong>{" "}
        {meal.requestedWindow && (
          <>
            Rentang yang diminta {clock(meal.requestedWindow.startMinute)}–
            {clock(meal.requestedWindow.endMinute)} WIB.{" "}
          </>
        )}
        Porsi tetap dihitung; periksa alasan hasil sebelum menerima jadwal.
      </p>
    );
  return (
    <p className="mt-2 text-xs leading-6 text-muted-foreground">
      <strong>Biaya tanpa jadwal makan.</strong> Jam & tempat makan belum
      ditetapkan. Kunjungan kuliner tidak otomatis memenuhi kebutuhan ini.
    </p>
  );
}
