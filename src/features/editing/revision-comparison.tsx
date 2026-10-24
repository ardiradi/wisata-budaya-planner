import type { PlanResult } from "@/domain/planner/types";
import { summarizeDayTiming } from "@/domain/planner/day-summary";
import { MealScheduleStatus } from "@/features/planning/meal-schedule-status";
import {
  dateLabel,
  formatRupiah,
  INTEREST_OPTIONS,
  PACE_OPTIONS,
  TRANSPORT_LABELS,
} from "@/features/preferences/intake-preview";

function clock(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function amount(value: number | null) {
  return value === null ? "Belum diketahui" : formatRupiah(value);
}

export function RevisionSnapshot({
  result,
  label,
}: {
  result: PlanResult;
  label: string;
}) {
  return (
    <section
      className="min-w-0 rounded-2xl border border-border bg-background/70 p-4"
      aria-label={label}
    >
      <h4 className="font-semibold">{label}</h4>
      <dl className="mt-4 space-y-2 text-sm">
        {result.input && (
          <>
            <div className="flex flex-wrap justify-between gap-2">
              <dt>Transportasi</dt>
              <dd>{TRANSPORT_LABELS[result.input.transport]}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt>Ritme & batas jalan kaki</dt>
              <dd>
                {PACE_OPTIONS[result.input.pace].label} ·{" "}
                {result.input.walkingLimit.toLocaleString("id-ID")} m / orang
              </dd>
            </div>
            <div>
              <dt>Minat wajib</dt>
              <dd className="mt-1">
                {result.input.mandatoryInterests
                  .map(
                    (id) =>
                      INTEREST_OPTIONS.find((option) => option.id === id)
                        ?.label ?? id,
                  )
                  .join(", ") || "Tidak ada"}
              </dd>
            </div>
            <div>
              <dt>Persyaratan wajib</dt>
              <dd className="mt-1">
                {result.input.dietaryRequirement === "none"
                  ? "Tanpa persyaratan makanan"
                  : result.input.dietaryRequirement === "halal"
                    ? "Bukti halal"
                    : "Informasi bahan"}{" "}
                ·{" "}
                {result.input.accessibilityRequirement === "step-free"
                  ? "akses tanpa tangga"
                  : "tanpa kebutuhan akses khusus"}
              </dd>
            </div>
          </>
        )}
        <div className="flex flex-wrap justify-between gap-2">
          <dt>Total batas atas + cadangan</dt>
          <dd className="font-semibold">{amount(result.cost.totalUpperIdr)}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <dt>Anggaran grup</dt>
          <dd>{amount(result.cost.budgetIdr)}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <dt>Minat wajib belum tercakup</dt>
          <dd>{result.coverage.missingCategoryIds.length}</dd>
        </div>
      </dl>
      <ul className="mt-5 space-y-5 text-xs leading-6">
        {result.days.map((day) => (
          <li key={day.date}>
            <p className="font-semibold">
              {dateLabel(day.date, true)} · {clock(day.startMinute)}–
              {clock(day.endMinute)} WIB
            </p>
            <p className="break-words text-muted-foreground">
              {day.startAnchor} → {day.endAnchor}
            </p>
            <ol className="mt-2 space-y-2">
              {day.stops.map((stop, index) => (
                <li key={stop.id} className="rounded-xl bg-white px-3 py-2">
                  <span className="font-semibold">
                    {index + 1}. {stop.name}
                  </span>
                  <span className="block">
                    {clock(stop.startMinute)}–{clock(stop.endMinute)} ·{" "}
                    {stop.durationMinutes} menit
                  </span>
                </li>
              ))}
              {day.stops.length === 0 && (
                <li>Tidak ada kunjungan terjadwal.</li>
              )}
            </ol>
            <p className="mt-2">
              Budaya: {day.culturalCovered ? "tercakup" : "belum tercakup"} ·
              kuliner: {day.culinaryCovered ? "tercakup" : "belum tercakup"}
            </p>
            <p>
              Jalan kaki:{" "}
              {day.walkingUpperMeters === null
                ? "belum diketahui"
                : `${day.walkingUpperMeters.toLocaleString("id-ID")} m / orang`}
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer font-semibold">
                Semua porsi makan ({day.meals.length} waktu)
              </summary>
              <ul className="mt-2 space-y-2">
                {day.meals.map((meal) => (
                  <li key={meal.id}>
                    {meal.label}: {meal.necessary} diperlukan · {meal.provided}{" "}
                    dibawa · {meal.prepaid} prabayar · {meal.purchased} dibeli
                    <br />
                    {amount(meal.lowerIdr)}–{amount(meal.upperIdr)}
                    <MealScheduleStatus
                      meal={meal}
                      placeName={
                        day.stops.find((stop) => stop.placeId === meal.placeId)
                          ?.name
                      }
                    />
                  </li>
                ))}
              </ul>
            </details>
            <details className="mt-2">
              <summary className="cursor-pointer font-semibold">
                Rute terarah ({day.legs.length})
              </summary>
              <ul className="mt-2 space-y-2">
                {day.legs.map((leg, index) => (
                  <li
                    key={`${leg.fromId}-${leg.toId}-${index}`}
                    className="break-words"
                  >
                    {leg.fromId} → {leg.toId}
                    <br />
                    {clock(leg.departureMinute)}–
                    {leg.arrivalMinute === null
                      ? "?"
                      : clock(leg.arrivalMinute)}{" "}
                    ·{" "}
                    {leg.status === "known"
                      ? "fixture tersedia"
                      : "bukti belum lengkap"}
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A preview never changes the committed timeline displayed outside this comparison. */
export function RevisionComparison({
  before,
  after,
}: {
  before: PlanResult;
  after: PlanResult;
}) {
  const difference =
    before.cost.totalUpperIdr !== null && after.cost.totalUpperIdr !== null
      ? after.cost.totalUpperIdr - before.cost.totalUpperIdr
      : null;
  return (
    <div className="mt-5">
      <p className="rounded-xl bg-secondary p-3 text-sm leading-6">
        {difference === null
          ? "Selisih biaya belum diketahui; data yang hilang tidak diganti nol."
          : difference === 0
            ? "Total batas atas tetap sama. Jadwal dan rute tetap diperiksa ulang."
            : `Perubahan total batas atas: ${difference > 0 ? "+" : "−"}${formatRupiah(Math.abs(difference))}, termasuk cadangan.`}
      </p>
      <section
        aria-label="Perubahan jadwal, rute dan berjalan"
        className="mt-4 rounded-2xl border border-border bg-white p-4 text-xs leading-6"
      >
        <h4 className="font-semibold">Apa yang berubah?</h4>
        <ul className="mt-2 space-y-2">
          {after.days.map((day) => {
            const prior = before.days.find(
              (previous) => previous.date === day.date,
            );
            const slots = Math.max(prior?.legs.length ?? 0, day.legs.length);
            const changedRoutes = Array.from(
              { length: slots },
              (_, index) =>
                JSON.stringify(prior?.legs[index]) !==
                JSON.stringify(day.legs[index]),
            ).filter(Boolean).length;
            const changedTimes = day.stops.filter((stop) => {
              const old = prior?.stops.find(
                (previous) => previous.id === stop.id,
              );
              return (
                !old ||
                old.placeId !== stop.placeId ||
                old.startMinute !== stop.startMinute ||
                old.endMinute !== stop.endMinute
              );
            }).length;
            const walking =
              prior?.walkingUpperMeters != null &&
              day.walkingUpperMeters !== null
                ? day.walkingUpperMeters - prior.walkingUpperMeters
                : null;
            const changedMeals = day.meals.filter((meal) => {
              const old = prior?.meals.find(
                (previous) => previous.id === meal.id,
              );
              return JSON.stringify(old) !== JSON.stringify(meal);
            }).length;
            const beforeTime = prior ? summarizeDayTiming(prior) : null;
            const afterTime = summarizeDayTiming(day);
            return (
              <li key={day.date}>
                <strong>{dateLabel(day.date, true)}:</strong> {changedTimes}{" "}
                kunjungan baru/berubah waktu atau tujuan; {changedRoutes} posisi
                rute berubah. Selisih jalan kaki{" "}
                {walking === null
                  ? "belum diketahui"
                  : `${walking > 0 ? "+" : ""}${walking} m/orang`}
                . Semua rute tetap dihitung ulang sebelum komit.
                <p className="mt-1">
                  {changedMeals} kebutuhan makan berubah biaya, porsi atau
                  jadwal. Waktu belum dialokasikan:{" "}
                  {beforeTime?.unallocatedMinutes == null
                    ? "belum diketahui"
                    : `${beforeTime.unallocatedMinutes} menit`}
                  {" → "}
                  {afterTime.unallocatedMinutes == null
                    ? "belum diketahui"
                    : `${afterTime.unallocatedMinutes} menit`}
                  .
                </p>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-muted-foreground">
          Rute berarah mencakup waktu keberangkatan, moda, biaya dan referensi
          bukti. Lihat rincian sebelum/sesudah; perubahan ini belum diterapkan.
        </p>
      </section>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <RevisionSnapshot label="Sebelum perubahan" result={before} />
        <RevisionSnapshot
          label="Usulan setelah dihitung ulang"
          result={after}
        />
      </div>
    </div>
  );
}
