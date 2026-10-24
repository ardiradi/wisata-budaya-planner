import {
  summarizeDayTiming,
  summarizeDayMeals,
} from "@/domain/planner/day-summary";
import type { PlanDay } from "@/domain/planner/types";

const clock = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

/** Describes existing slots and gaps; never invents an activity or meal appointment. */
export function DayOverview({ day }: { day: PlanDay }) {
  const time = summarizeDayTiming(day);
  const meals = summarizeDayMeals(day);
  return (
    <section
      className="rounded-2xl border border-primary/15 bg-secondary/70 p-4 sm:p-5"
      aria-label="Cakupan waktu dan makan"
    >
      <h3 className="text-sm font-semibold">
        Seberapa banyak hari ini terencana?
      </h3>
      {day.utilization && (
        <p className="mt-2 text-xs font-semibold text-primary">
          {day.utilization.style === "short"
            ? "Rencana singkat"
            : day.utilization.style === "relaxed"
              ? "Eksplorasi santai"
              : day.utilization.style === "balanced"
                ? "Eksplorasi seimbang"
                : "Eksplorasi aktif"}
          {" · "}
          {day.stops.length} kunjungan
        </p>
      )}
      {time.status === "known" ? (
        <>
          <p className="mt-2 text-sm leading-6">
            {day.legs.length ? (
              <>
                Tiba kembali pukul{" "}
                <strong>{clock(time.returnArrivalMinute!)}</strong>; jeda akhir
                selesai {clock(time.returnReadyMinute!)} WIB.
              </>
            ) : (
              "Tidak ada perjalanan yang dimodelkan."
            )}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Kunjungan</dt>
              <dd className="mt-1 font-semibold">{time.visitMinutes} menit</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Perjalanan (batas atas)</dt>
              <dd className="mt-1 font-semibold">{time.travelMinutes} menit</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Jeda perjalanan</dt>
              <dd className="mt-1 font-semibold">{time.bufferMinutes} menit</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Menunggu jendela waktu</dt>
              <dd className="mt-1 font-semibold">
                {time.waitingMinutes} menit
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Belum dialokasikan</dt>
              <dd className="mt-1 font-semibold">
                {time.unallocatedMinutes} menit
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            {time.modelledMinutes} dari {time.availableMinutes} menit tersedia
            dimodelkan. Waktu kosong tetap kosong; status valid tidak berarti
            seluruh hari sudah diisi.
          </p>
          {!!time.overrunMinutes && (
            <p className="mt-2 text-sm text-destructive">
              Rangkaian melewati waktu tersedia sebanyak {time.overrunMinutes}{" "}
              menit. Periksa alasan hasil.
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm leading-6">
          Cakupan waktu belum dapat dihitung karena jadwal atau rute belum
          lengkap. Waktu yang hilang tidak dianggap waktu bebas.
        </p>
      )}
      {meals.necessaryPortions > 0 && (
        <p className="mt-4 border-t border-primary/10 pt-3 text-xs leading-6">
          <strong>
            {meals.budgetStatus === "accounted"
              ? "Biaya makan tercatat"
              : "Biaya makan belum lengkap"}
            {day.meals.some((meal) => meal.schedulingStatus === "scheduled")
              ? "; jadwal makan diperiksa terpisah."
              : "; jam & tempat makan belum ditetapkan."}
          </strong>{" "}
          {meals.necessaryPortions} porsi diperlukan, {meals.purchasedPortions}{" "}
          dibeli. {meals.scheduledPortions} porsi terjadwal,{" "}
          {meals.unresolvedPortions} porsi dengan jadwal belum terpenuhi.
          Kunjungan kuliner tidak otomatis menjadi jadwal sarapan, makan siang
          atau malam.
        </p>
      )}
      {day.utilization && (
        <div className="mt-4 border-t border-primary/10 pt-3 text-xs leading-6">
          <p className="font-semibold">Mengapa masih ada waktu bebas?</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {day.utilization.reasonCodes.map((reason) => (
              <li key={reason}>
                {reason === "SHORT_PLAN"
                  ? "Anda memilih rencana singkat; kunjungan tambahan tidak dipaksakan."
                  : reason === "PACE_CAP"
                    ? "Batas jumlah kunjungan sesuai ritme sudah tercapai."
                    : reason === "CATALOGUE_RESERVED"
                      ? "Sebagian pilihan disisihkan untuk hari lain agar tempat tidak diulang."
                      : reason === "FREE_DAY"
                        ? "Hari bebas dipertahankan; kebutuhan makan tetap diperiksa."
                        : reason === "EXPLICIT_EDIT"
                          ? "Hasil mengikuti kunjungan yang Anda pilih dalam edit."
                          : reason === "MEAL_SERVICE_REQUIRED"
                            ? "Jadwal memasukkan layanan makan yang Anda minta."
                            : reason === "OPTIONAL_CONSTRAINT"
                              ? "Kunjungan tambahan tidak dimasukkan karena batas waktu, berjalan, biaya, atau sisa pemeriksaan rute; syarat wajib tetap dipertahankan."
                              : "Belum ditemukan kunjungan tambahan yang sesuai dalam pencarian ini."}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-muted-foreground">
            Pencarian terbatas, bukan bukti bahwa semua kemungkinan telah
            dicoba. Anda dapat meninjau waktu atau preferensi sendiri; batas
            wajib tetap berlaku dan tidak diubah otomatis.
          </p>
        </div>
      )}
    </section>
  );
}
