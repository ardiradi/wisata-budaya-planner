"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Compass,
  Footprints,
  Info,
  Landmark,
  LoaderCircle,
  Route,
  ShieldQuestion,
  Users,
  Utensils,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  buildSyntheticScenario,
  buildRecommendationProfile,
} from "@/application/planning/preview-planner";
import { RecommendationPanel } from "@/features/recommendations/recommendation-panel";
import { GeminiControls } from "@/features/recommendations/gemini-controls";
import { SimulationControls } from "@/features/recommendations/simulation-controls";
import type { PlanResult } from "@/domain/planner/types";
import {
  cityToday,
  dateLabel,
  formatRupiah,
  INTEREST_OPTIONS,
  PACE_OPTIONS,
  TRANSPORT_LABELS,
} from "@/features/preferences/intake-preview";
import { usePlanning } from "./planning-provider";
import { EditingWorkspace } from "@/features/editing/editing-workspace";
import { DayOverview } from "./day-overview";
import { MealScheduleStatus } from "./meal-schedule-status";
import { ItineraryDownload } from "./itinerary-download";
import { COMPETITION_DEMO, DEMO_LABEL } from "@/config/demo";

const card = "rounded-3xl border border-primary/10 bg-white p-5 sm:p-7";
const statuses = {
  validated: "Valid dalam simulasi sintetis",
  draft: "Draf · bukti simulasi belum lengkap",
  blocked: "Terblokir · batas wajib belum terpenuhi",
} as const;

function clock(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
function money(value: number | null) {
  return value === null ? "Belum diketahui" : formatRupiah(value);
}
function categoryLabel(id: string) {
  return INTEREST_OPTIONS.find((interest) => interest.id === id)?.label ?? id;
}

function EvidenceDetails({ refs }: { refs: PlanResult["evidenceRefs"] }) {
  return (
    <details className="mt-4 rounded-xl border border-border bg-background/70 p-3 text-xs">
      <summary className="cursor-pointer font-semibold text-primary">
        Referensi fixture & batas informasi ({refs.length})
      </summary>
      <p className="mt-3 leading-5 text-muted-foreground">
        Referensi immutable ini berasal dari fixture pengujian sintetis. Tidak
        ada persetujuan independen atau fakta destinasi nyata.
      </p>
      {refs.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {refs.map((ref, index) => (
            <li key={index}>
              <code className="block whitespace-pre-wrap break-all rounded-lg bg-white p-2 leading-5">
                {JSON.stringify(ref)}
              </code>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2">
          Referensi tidak tersedia; tidak diasumsikan lolos.
        </p>
      )}
    </details>
  );
}

function RoutingRow({
  leg,
}: {
  leg: PlanResult["days"][number]["legs"][number];
}) {
  return (
    <li className="rounded-2xl border border-dashed border-primary/20 bg-secondary/50 p-4 text-xs leading-6">
      <div className="flex items-start gap-2">
        <Route
          className="mt-1 size-4 shrink-0 text-primary"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="break-words font-semibold">
            {leg.fromId} → {leg.toId}
          </p>
          <p>
            {clock(leg.departureMinute)}–
            {leg.arrivalMinute === null ? "?" : clock(leg.arrivalMinute)} WIB ·{" "}
            {leg.durationMinutes
              ? `${leg.durationMinutes.lower}–${leg.durationMinutes.upper} menit`
              : "Durasi belum diketahui"}
          </p>
          <p className="text-muted-foreground">
            Jalan kaki{" "}
            {leg.walkingMeters
              ? `${leg.walkingMeters.lower}–${leg.walkingMeters.upper} m / orang`
              : "belum diketahui"}
            {" · "}Biaya grup{" "}
            {leg.costIdr
              ? `${money(leg.costIdr.lower)}–${money(leg.costIdr.upper)}`
              : "belum diketahui"}
          </p>
          {leg.status !== "known" && (
            <p className="mt-1 font-semibold text-amber-900">
              Rute belum terbukti; tidak diganti dengan waktu atau biaya nol.
            </p>
          )}
          <EvidenceDetails refs={leg.evidenceRefs} />
        </div>
      </div>
    </li>
  );
}

function ResultContent({ result }: { result: PlanResult }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [activeDay, setActiveDay] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const dayIndex = Math.min(activeDay, Math.max(0, result.days.length - 1));
  const day = result.days[dayIndex];
  const preferences = result.input;
  const walkingFromRoutes =
    day?.legs.reduce((sum, leg) => sum + (leg.walkingMeters?.upper ?? 0), 0) ??
    0;
  const walkingInside =
    day?.stops.reduce((sum, stop) => sum + stop.walkingMeters.upper, 0) ?? 0;

  useEffect(() => {
    heading.current?.focus();
  }, []);

  function keyboardDay(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % result.days.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + result.days.length) % result.days.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = result.days.length - 1;
    else return;
    event.preventDefault();
    setActiveDay(next);
    tabs.current[next]?.focus();
  }

  return (
    <>
      <section
        className="mb-8 rounded-3xl bg-primary p-6 text-primary-foreground sm:p-9"
        aria-label="Ringkasan hasil sintetis"
      >
        <Badge variant="warning">{statuses[result.status]}</Badge>
        <h1
          ref={heading}
          tabIndex={-1}
          className="mt-5 rounded font-display text-4xl leading-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-foreground sm:text-5xl"
        >
          Ruang, rasa, dan ritme Anda.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-primary-foreground/80">
          Dihitung dari pilihan sintetis Anda. Seluruh destinasi, klasifikasi,
          jam, rute, dan biaya di bawah adalah fixture sintetis; tidak untuk
          perjalanan nyata.
        </p>
        {preferences && (
          <dl className="mt-7 grid gap-5 border-t border-white/20 pt-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="flex items-center gap-2 text-primary-foreground/70">
                <CalendarDays className="size-4" aria-hidden="true" />
                Perjalanan
              </dt>
              <dd className="mt-2 font-semibold">
                {preferences.dates.length} hari ·{" "}
                {dateLabel(preferences.startDate, true)}–
                {dateLabel(preferences.endDate, true)}
              </dd>
              <dd className="mt-1 text-xs">Asia/Jakarta · WIB</dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-primary-foreground/70">
                <Users className="size-4" aria-hidden="true" />
                Grup & transportasi
              </dt>
              <dd className="mt-2 font-semibold">
                {preferences.party} orang ·{" "}
                {TRANSPORT_LABELS[preferences.transport]}
              </dd>
              <dd className="mt-1 text-xs">
                {PACE_OPTIONS[preferences.pace].label} · maks.{" "}
                {preferences.stopCap} tempat / hari ·{" "}
                {preferences.planningStyle === "pace"
                  ? "eksplorasi sesuai ritme"
                  : "rencana singkat"}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-primary-foreground/70">
                <Wallet className="size-4" aria-hidden="true" />
                Anggaran total grup
              </dt>
              <dd className="mt-2 font-semibold">
                {money(preferences.budgetIdr)}
              </dd>
              <dd className="mt-1 text-xs">
                Aktivitas, semua makan, transportasi lokal
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-primary-foreground/70">
                <Footprints className="size-4" aria-hidden="true" />
                Batas jalan kaki
              </dt>
              <dd className="mt-2 font-semibold">
                {preferences.walkingLimit.toLocaleString("id-ID")} m / orang /
                hari
              </dd>
              <dd className="mt-1 text-xs">
                Termasuk rute, akses, dan area kunjungan
              </dd>
            </div>
          </dl>
        )}
      </section>

      <p className="mb-3 text-xs text-muted-foreground">
        {result.recommendation?.source === "gemini_live"
          ? "Rekomendasi dari inferensi Gemini yang lolos validasi."
          : result.recommendation?.source === "mock_ai"
            ? "Rekomendasi: simulasi mock offline, bukan inferensi model nyata."
            : result.recommendation?.source === "deterministic_fallback"
              ? "Rekomendasi: fallback deterministik; kebutuhan wajib tetap dijaga."
              : "Versi ini diperiksa secara deterministik."}
      </p>
      <nav
        aria-label="Bagian rencana"
        className="mb-6 flex flex-wrap gap-3 text-sm font-semibold text-primary"
      >
        <a
          className="rounded-lg border border-border bg-white px-4 py-3"
          href={`#day-panel-${dayIndex}`}
        >
          Jadwal harian
        </a>
        <a
          className="rounded-lg border border-border bg-white px-4 py-3"
          href="#cost-heading"
        >
          Biaya grup
        </a>
        <a
          className="rounded-lg border border-border bg-white px-4 py-3"
          href="#recommendation-heading"
        >
          Alasan rekomendasi
        </a>
      </nav>
      <EditingWorkspace />
      <div className="mb-6">
        <ItineraryDownload />
      </div>

      {result.issues.length > 0 && (
        <section
          className="mb-7 rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:p-7"
          aria-labelledby="issues-heading"
          role={result.status === "blocked" ? "alert" : undefined}
        >
          <h2
            id="issues-heading"
            className="flex items-center gap-2 font-semibold text-amber-950"
          >
            <ShieldQuestion className="size-5 shrink-0" aria-hidden="true" />
            Yang masih perlu diselesaikan
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-amber-950">
            {result.issues.map((issue, index) => (
              <li key={`${issue.code}-${index}`}>
                <span className="font-semibold">
                  {issue.severity === "unknown"
                    ? "Belum diketahui"
                    : "Batas belum terpenuhi"}
                </span>
                {issue.date ? ` · ${dateLabel(issue.date, true)}` : ""}:{" "}
                {issue.message}
                <span className="mt-1 block break-all text-xs opacity-75">
                  {issue.code}
                  {issue.placeId ? ` · ${issue.placeId}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-6">
            Tidak ada kebutuhan wajib, porsi makan, atau batas yang dihapus
            otomatis. Total parsial tidak menyatakan keterjangkauan.
          </p>
        </section>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {result.days.length > 0 && (
            <>
              <div
                className="flex flex-wrap gap-2"
                role="tablist"
                aria-label="Hari perjalanan sintetis"
              >
                {result.days.map((entry, index) => (
                  <button
                    key={entry.date}
                    ref={(element) => {
                      tabs.current[index] = element;
                    }}
                    type="button"
                    role="tab"
                    id={`day-tab-${index}`}
                    aria-controls={`day-panel-${index}`}
                    aria-selected={index === dayIndex}
                    tabIndex={index === dayIndex ? 0 : -1}
                    onClick={() => setActiveDay(index)}
                    onKeyDown={(event) => keyboardDay(event, index)}
                    className={`min-h-12 rounded-2xl border px-4 py-3 text-left text-sm ${index === dayIndex ? "border-primary bg-primary text-primary-foreground" : "border-border bg-white"}`}
                  >
                    <span className="block font-semibold">
                      Hari {index + 1}
                    </span>
                    <span className="mt-1 block text-xs opacity-80">
                      {dateLabel(entry.date, true)}
                    </span>
                  </button>
                ))}
              </div>
              {day && (
                <section
                  id={`day-panel-${dayIndex}`}
                  role="tabpanel"
                  tabIndex={-1}
                  aria-labelledby={`day-tab-${dayIndex}`}
                  className="space-y-5"
                >
                  <div className={card}>
                    <h2 className="font-display text-2xl">
                      Hari {dayIndex + 1} · {dateLabel(day.date)}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {clock(day.startMinute)}–{clock(day.endMinute)} WIB ·{" "}
                      {day.startAnchor} → {day.endAnchor}
                    </p>
                    <p className="mt-3 text-xs leading-6 text-muted-foreground">
                      {day.coverage === "free"
                        ? "Hari bebas dipilih secara eksplisit. Kebutuhan makan tetap dihitung."
                        : "Jadwal mempertahankan durasi kunjungan, jendela buka, perjalanan pergi/pulang, serta jeda yang dihitung."}
                    </p>
                    <ul
                      className="mt-5 flex flex-wrap gap-2 text-xs"
                      aria-label="Cakupan harian"
                    >
                      <li className="rounded-full bg-secondary px-3 py-2">
                        Budaya:{" "}
                        {day.culturalCovered ? "tercakup" : "tidak dijadwalkan"}
                      </li>
                      <li className="rounded-full bg-secondary px-3 py-2">
                        Kuliner:{" "}
                        {day.culinaryCovered ? "tercakup" : "tidak dijadwalkan"}
                      </li>
                      <li className="rounded-full bg-secondary px-3 py-2">
                        {day.stops.length} tempat terjadwal
                      </li>
                    </ul>
                  </div>
                  <DayOverview day={day} />
                  <ol
                    aria-label={`Linimasa hasil hari ${dayIndex + 1}`}
                    className="space-y-4"
                  >
                    {day.stops.map((stop, index) => {
                      const incoming = day.legs[index];
                      const previousEnd = index
                        ? day.stops[index - 1].endMinute
                        : day.startMinute;
                      return (
                        <li key={stop.id} className="space-y-4">
                          {incoming && (
                            <ol
                              className="list-none space-y-3"
                              aria-label={`Perjalanan ke ${stop.name}`}
                            >
                              {incoming.departureMinute > previousEnd && (
                                <li className="px-4 text-xs text-muted-foreground">
                                  Jeda sebelum perjalanan:{" "}
                                  {incoming.departureMinute - previousEnd} menit
                                </li>
                              )}
                              <RoutingRow leg={incoming} />
                              {incoming.arrivalMinute !== null &&
                                stop.startMinute > incoming.arrivalMinute && (
                                  <li className="px-4 text-xs text-muted-foreground">
                                    Jeda / menunggu jendela buka:{" "}
                                    {stop.startMinute - incoming.arrivalMinute}{" "}
                                    menit
                                  </li>
                                )}
                            </ol>
                          )}
                          <article className={card}>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <Badge variant="secondary">
                                {stop.kind === "culture" ? (
                                  <Landmark
                                    className="size-3.5"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <Utensils
                                    className="size-3.5"
                                    aria-hidden="true"
                                  />
                                )}
                                {stop.kind === "culture"
                                  ? "Budaya sintetis"
                                  : "Kuliner sintetis"}
                              </Badge>
                              <span className="text-sm font-semibold tabular-nums">
                                {clock(stop.startMinute)}–
                                {clock(stop.endMinute)} WIB
                              </span>
                            </div>
                            <h3 className="mt-4 font-display text-2xl">
                              {stop.name}
                            </h3>
                            <p className="mt-2 break-all text-xs text-muted-foreground">
                              ID sintetis: {stop.placeId}
                            </p>
                            <dl className="mt-5 grid gap-4 text-xs sm:grid-cols-2">
                              <div>
                                <dt className="text-muted-foreground">
                                  Durasi & jendela buka fixture
                                </dt>
                                <dd className="mt-1 font-semibold">
                                  {stop.durationMinutes} menit · buka{" "}
                                  {clock(stop.openingWindow.startMinute)}–
                                  {clock(stop.openingWindow.endMinute)}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">
                                  Biaya aktivitas grup
                                </dt>
                                <dd className="mt-1 font-semibold">
                                  {money(stop.admissionIdr.lower)}–
                                  {money(stop.admissionIdr.upper)}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">
                                  Jalan di area kunjungan
                                </dt>
                                <dd className="mt-1 font-semibold">
                                  {stop.walkingMeters.lower}–
                                  {stop.walkingMeters.upper} m / orang
                                </dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">
                                  Kategori fixture
                                </dt>
                                <dd className="mt-1 font-semibold">
                                  {stop.categoryIds
                                    .map(categoryLabel)
                                    .join(", ") || "Tidak ada kategori budaya"}
                                </dd>
                              </div>
                            </dl>
                            {day.meals
                              .filter(
                                (meal) =>
                                  meal.schedulingStatus === "scheduled" &&
                                  meal.placeId === stop.placeId,
                              )
                              .map((meal) => (
                                <div key={meal.id} className="mt-4">
                                  <p className="text-xs font-semibold">
                                    {meal.label}
                                  </p>
                                  <MealScheduleStatus
                                    meal={meal}
                                    placeName={stop.name}
                                  />
                                </div>
                              ))}
                            <EvidenceDetails refs={stop.evidenceRefs} />
                          </article>
                        </li>
                      );
                    })}
                    {day.legs.slice(day.stops.length).map((leg, index) => (
                      <RoutingRow key={`return-${index}`} leg={leg} />
                    ))}
                    {day.stops.length === 0 && (
                      <li className={card}>
                        <p className="text-sm leading-7">
                          Belum ada kunjungan terjadwal.{" "}
                          {day.coverage === "free"
                            ? "Hari bebas dipilih, bukan pemenuhan otomatis kebutuhan budaya atau kuliner."
                            : "Lihat alasan di atas; hasil kosong tidak dianggap memenuhi pengalaman yang diminta."}
                        </p>
                      </li>
                    )}
                  </ol>
                  <section className={card} aria-labelledby="walking-heading">
                    <h3
                      id="walking-heading"
                      className="flex items-center gap-2 font-semibold"
                    >
                      <Footprints className="size-5" aria-hidden="true" />
                      Seluruh jalan kaki, per orang
                    </h3>
                    <p className="mt-3 text-2xl font-semibold">
                      {day.walkingUpperMeters === null
                        ? "Belum diketahui"
                        : `${day.walkingUpperMeters.toLocaleString("id-ID")} m batas atas`}
                    </p>
                    <p className="mt-2 text-xs leading-6 text-muted-foreground">
                      Komponen rute & akses diketahui: {walkingFromRoutes} m ·
                      area kunjungan: {walkingInside} m. Bukan jumlah meter
                      dikalikan peserta. Komponen yang hilang membuat kepatuhan
                      belum terbukti. Angka fixture bukan penilaian keselamatan
                      atau aksesibilitas nyata.
                    </p>
                  </section>
                  <section className={card} aria-labelledby="meals-heading">
                    <h3
                      id="meals-heading"
                      className="flex items-center gap-2 font-semibold"
                    >
                      <Utensils className="size-5" aria-hidden="true" />
                      Semua kebutuhan makan hari ini
                    </h3>
                    <p className="mt-2 text-xs leading-6 text-muted-foreground">
                      Termasuk makan di luar jadwal kunjungan dan hari parsial.
                      Dibawa/prabayar adalah deklarasi porsi; bukan harga
                      destinasi nol.
                    </p>
                    <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-950">
                      Biaya dan jadwal makan diperiksa terpisah. Hanya baris
                      “Makan terjadwal” yang memiliki waktu serta layanan yang
                      diperiksa dalam simulasi. Ini bukan reservasi nyata.
                    </p>
                    <ul className="mt-5 divide-y divide-border">
                      {day.meals.map((meal) => (
                        <li key={meal.id} className="py-4 first:pt-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-sm font-semibold">
                              {meal.label}
                            </h4>
                            <span className="text-sm font-semibold">
                              <span className="mr-1 text-xs font-normal text-muted-foreground">
                                Porsi:
                              </span>
                              {money(meal.lowerIdr)}–{money(meal.upperIdr)}
                            </span>
                          </div>
                          <p className="mt-2 text-xs leading-6">
                            {meal.necessary} diperlukan · {meal.provided} dibawa
                            · {meal.prepaid} prabayar · {meal.purchased} dibeli
                          </p>
                          <MealScheduleStatus
                            meal={meal}
                            placeName={
                              day.stops.find(
                                (stop) => stop.placeId === meal.placeId,
                              )?.name
                            }
                          />
                          <EvidenceDetails refs={meal.evidenceRefs} />
                        </li>
                      ))}
                    </ul>
                  </section>
                </section>
              )}
            </>
          )}
          <section className={card} aria-labelledby="mandatory-heading">
            <h2 id="mandatory-heading" className="font-semibold">
              Minat wajib sepanjang perjalanan
            </h2>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              Setiap kategori wajib memerlukan setidaknya satu kunjungan
              terjadwal yang sesuai. Klasifikasi di sini sintetis, belum
              ditinjau budaya secara independen.
            </p>
            {result.coverage.requiredCategoryIds.length ? (
              <ul className="mt-4 space-y-3 text-sm">
                {result.coverage.requiredCategoryIds.map((id) => (
                  <li key={id} className="flex flex-wrap justify-between gap-2">
                    <span>{categoryLabel(id)}</span>
                    <strong>
                      {result.coverage.fulfilledCategoryIds.includes(id)
                        ? "Tercakup dalam simulasi"
                        : "Belum terpenuhi"}
                    </strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm">
                Tidak ada kategori wajib yang dideklarasikan.
              </p>
            )}
          </section>
        </div>
        <aside
          className="space-y-5 lg:sticky lg:top-6"
          aria-label="Biaya dan batas perhitungan"
        >
          <section className={card} aria-labelledby="cost-heading">
            <p className="eyebrow mb-2 text-accent">
              Setiap rupiah punya tempat
            </p>
            <h2 id="cost-heading" className="font-display text-2xl">
              Anggaran, dengan jelas.
            </h2>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              Rentang fixture sintetis untuk seluruh grup, dalam IDR. Batas atas
              ditambah cadangan 10% menentukan pemeriksaan anggaran.
            </p>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              Allowance sintetis tiap porsi mencakup seluruh biaya wajib
              fixture. Porsi diasumsikan tersedia di anchor atau tempat kuliner
              terjadwal, tanpa perjalanan pengambilan tambahan. Ini asumsi
              fixture, bukan harga atau layanan nyata.
            </p>
            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <dt>Subtotal bawah</dt>
                <dd className="font-semibold">
                  {money(result.cost.lowerSubtotalIdr)}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt>Subtotal atas</dt>
                <dd className="font-semibold">
                  {money(result.cost.upperSubtotalIdr)}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt>Cadangan 10% (dibulatkan naik)</dt>
                <dd className="font-semibold">
                  {money(result.cost.contingencyIdr)}
                </dd>
              </div>
              <div className="border-t border-border pt-4">
                <dt>Total batas atas + cadangan</dt>
                <dd
                  className="mt-2 text-2xl font-semibold text-primary"
                  data-testid="total-upper"
                >
                  {money(result.cost.totalUpperIdr)}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4">
                <dt>Anggaran Anda</dt>
                <dd className="font-semibold">
                  {money(result.cost.budgetIdr)}
                </dd>
              </div>
            </dl>
            <details className="mt-5 border-t border-border pt-4">
              <summary className="cursor-pointer text-sm font-semibold">
                Rincian biaya hasil ({result.cost.lines.length})
              </summary>
              <ul className="mt-4 space-y-4">
                {result.cost.lines.map((line) => (
                  <li
                    key={line.id}
                    className="border-b border-border pb-4 text-xs last:border-0"
                  >
                    <p className="font-semibold">{line.label}</p>
                    <p className="mt-1 text-muted-foreground">
                      {line.date ? `${dateLabel(line.date, true)} · ` : ""}
                      {line.quantity}{" "}
                      {line.unit === "portion"
                        ? "porsi"
                        : line.unit === "person"
                          ? "orang"
                          : "grup"}
                    </p>
                    <p className="mt-2 font-semibold">
                      {money(line.lowerIdr)}–{money(line.upperIdr)}
                    </p>
                    <EvidenceDetails refs={line.evidenceRefs} />
                  </li>
                ))}
              </ul>
            </details>
            <p className="mt-4 text-xs leading-6 text-muted-foreground">
              Biaya tak diketahui tidak diganti nol. Penginapan dan perjalanan
              antarkota di luar cakupan.
            </p>
          </section>
          <section className="rounded-3xl border border-border bg-secondary p-5">
            <h2 className="text-sm font-semibold">Batas kerja tetap dijaga</h2>
            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between gap-3">
                <dt>Percobaan rute fixture</dt>
                <dd>{result.work.routeAttempts} / 42</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>AI / elemen matriks</dt>
                <dd>
                  {result.work.modelCalls} / {result.work.matrixElements}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>
                  {result.recommendation?.modelId
                    ? "Rekonsiliasi biaya provider"
                    : "Biaya API nyata"}
                </dt>
                <dd>
                  {result.recommendation?.modelId ? "Belum tersedia" : "USD 0"}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-6 text-muted-foreground">
              Sisa {Math.max(0, 42 - result.work.routeAttempts)} percobaan dalam
              operasi ini. Tujuh hari × lima tempat memerlukan 42 rute awal:
              tanpa ruang retry sebelum akses tambahan. Kepadatan lebih rendah
              hanya dipilih bila semua kebutuhan terpenuhi.
            </p>
          </section>
          <details className={`${card} text-xs`}>
            <summary className="cursor-pointer font-semibold">
              Jejak hasil & fixture
            </summary>
            <p className="mt-3 break-all leading-6">
              Versi katalog: {result.catalogueVersion}
              <br />
              Dievaluasi: {result.evaluatedAt}
              <br />
              Persetujuan independen: tidak ada.
            </p>
            <EvidenceDetails refs={result.evidenceRefs} />
          </details>
        </aside>
      </div>
      <div className="mt-7">
        <RecommendationPanel result={result} />
      </div>
    </>
  );
}

export function GeneratedItinerary() {
  const planning = usePlanning();
  const busy = planning.phase === "loading";
  return (
    <div className="page-shell pb-20 pt-8 sm:pt-12">
      <div className="content-container">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/rencanakan"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {planning.submission
              ? "Kembali ke preferensi sintetis"
              : "Isi preferensi sintetis"}
          </Link>
          {planning.result && (
            <Button variant="outline" onClick={planning.clear}>
              Hapus hasil dari memori
            </Button>
          )}
        </div>
        {busy ? (
          <section
            className={`${card} py-16 text-center`}
            role="status"
            aria-live="polite"
          >
            <LoaderCircle
              className="mx-auto size-10 animate-spin text-primary"
              aria-hidden="true"
            />
            <h1 className="mt-5 font-display text-3xl">
              Menghitung rencana sintetis…
            </h1>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Memeriksa jadwal, semua makan, anggaran, rute fixture, dan
              kebutuhan wajib. Ranking kandidat menggunakan adapter rekomendasi
              terpilih sebelum pemeriksaan deterministik. Mode offline memakai
              mock.{" "}
              {COMPETITION_DEMO
                ? "Semua API langsung dinonaktifkan pada demo kompetisi."
                : "Satu uji Gemini memerlukan izin gratis terpisah di server."}
            </p>
          </section>
        ) : planning.result ? (
          <ResultContent result={planning.result} />
        ) : (
          <section
            className={`${card} py-12 sm:py-16`}
            aria-labelledby="empty-heading"
          >
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-secondary">
                <Compass className="size-8 text-primary" aria-hidden="true" />
              </div>
              <p className="eyebrow mt-6 text-accent">
                Rencana dimulai dari pilihan Anda
              </p>
              <h1 id="empty-heading" className="mt-3 font-display text-4xl">
                Belum ada hasil di sesi ini.
              </h1>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                Isi preferensi sintetis untuk menghitung rencana. Halaman
                langsung atau muat ulang tidak memulihkan isian atau hasil.
                Tidak ada contoh tetap yang dianggap sebagai hasil Anda.
              </p>
              {planning.error && (
                <p
                  role="alert"
                  className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-destructive"
                >
                  {planning.error}
                </p>
              )}
              <Button asChild className="mt-6">
                <Link href="/rencanakan">
                  Mulai preferensi{" "}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <div className="mx-auto mt-10 max-w-3xl border-t border-border pt-7">
              <h2 className="text-center text-sm font-semibold">
                Atau jalankan skenario sintetis untuk meninjau perhitungan
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-center text-xs leading-6 text-muted-foreground">
                Skenario ini mengirim isian fixture melalui mesin yang sama.
                Tidak memakai data atau tarif destinasi nyata.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {(
                  [
                    {
                      id: "feasible",
                      label: "Layak dalam simulasi",
                      note: "1 hari · 2 orang · mobil · anggaran longgar",
                    },
                    {
                      id: "low-budget",
                      label: "Anggaran tidak cukup",
                      note: "Isian yang sama, batas anggaran lebih kecil",
                    },
                    {
                      id: "missing-route",
                      label: "Bukti rute hilang",
                      note: "Waktu dan biaya rute tidak diasumsikan nol",
                    },
                  ] as const
                ).map((scenario) => (
                  <button
                    type="button"
                    key={scenario.id}
                    className="rounded-2xl border border-border bg-background p-4 text-left transition hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                    onClick={() => {
                      const submission = buildSyntheticScenario(
                        scenario.id,
                        cityToday(),
                      );
                      void planning.generate(
                        submission,
                        scenario.id === "missing-route"
                          ? "missing-route"
                          : "normal",
                      );
                    }}
                  >
                    <span className="block text-sm font-semibold">
                      Jalankan: {scenario.label}
                    </span>
                    <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                      {scenario.note}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}
        {!planning.result && (
          <div className="mb-6">
            <SimulationControls
              scenario={planning.recommendationScenario}
              onScenarioChange={planning.setRecommendationScenario}
              disabled={busy}
              onProfile={(profile) =>
                void planning.generate(
                  buildRecommendationProfile(profile, cityToday()),
                )
              }
            />
            {!COMPETITION_DEMO && (
              <details className="mt-4 rounded-2xl border border-border bg-white p-4 text-sm">
                <summary className="cursor-pointer font-semibold text-primary">
                  Status uji Gemini · opsional
                </summary>
                <GeminiControls
                  disabled={busy}
                  onRun={(model) =>
                    void planning.generate(
                      buildRecommendationProfile("history", cityToday()),
                      "normal",
                      "normal",
                      model,
                    )
                  }
                />
              </details>
            )}
          </div>
        )}
        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-border bg-secondary/70 p-4 text-xs leading-6 text-muted-foreground">
          <Info className="mt-1 size-4 shrink-0" aria-hidden="true" />
          <p>
            {COMPETITION_DEMO ? `${DEMO_LABEL}.` : "Demo lokal."} Status valid
            hanya berarti pemeriksaan deterministik lulus atas fixture sintetis,
            bukan verifikasi budaya, hak data, aksesibilitas, atau kelayakan
            provider. M1 tetap OPEN; penerimaan M2 belum diberikan. Mode ranking
            dan fallback dijelaskan pada panel rekomendasi.{" "}
            {COMPETITION_DEMO
              ? "Gemini dan semua API langsung dinonaktifkan. Tidak ada akun atau penyimpanan rencana di server; gunakan isian contoh saja."
              : "Mock offline tetap tersedia; satu uji Gemini gratis dibatasi server. Akun, penyimpanan produksi dan penyedia berbayar belum aktif."}
          </p>
        </div>
      </div>
    </div>
  );
}
