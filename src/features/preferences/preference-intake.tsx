"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CarFront,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Footprints,
  Info,
  MapPin,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { usePlanning } from "@/features/planning/planning-provider";
import {
  addDays,
  cityToday,
  dateLabel,
  formatRupiah,
  initialDay,
  initialIntake,
  INTEREST_OPTIONS,
  mealPreviewRows,
  MEAL_LABELS,
  PACE_OPTIONS,
  previewDates,
  purchasedPortions,
  TRANSPORT_LABELS,
  validateDayForms,
  validatePaceForm,
  validateTripForm,
  type DayPreview,
  type FormIssue,
  type IntakePreview,
  type MealKey,
  type MealPortions,
  type MealPreviewRow,
  type MealScheduling,
  type Pace,
  type Transport,
} from "./intake-preview";
import { MealSchedulingFields } from "./meal-scheduling-fields";
import { COMPETITION_DEMO, DEMO_LABEL } from "@/config/demo";

const STEPS = ["Perjalanan", "Minat & ritme", "Kebutuhan harian", "Tinjau"];
const fieldClass =
  "mt-2 w-full rounded-xl border border-border bg-white px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
const labelClass = "text-sm font-semibold text-foreground";
const sectionClass = "rounded-3xl border border-border bg-white p-5 sm:p-8";
const coverageLabels: Record<DayPreview["coverage"], string> = {
  both: "Budaya & kuliner",
  free: "Hari bebas",
  "culture-only": "Budaya saja (opt-out kuliner)",
  "food-only": "Kuliner saja (opt-out budaya)",
};

function Note({
  children,
  warning = false,
}: {
  children: ReactNode;
  warning?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl p-4 text-xs leading-relaxed sm:text-sm",
        warning ? "bg-amber-50 text-amber-950" : "bg-secondary text-foreground",
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
function FieldError({ id, issues }: { id: string; issues: FormIssue[] }) {
  const issue = issues.find((item) => item.id === id);
  return issue ? (
    <p id={`${id}-error`} className="mt-2 text-sm text-destructive">
      {issue.message}
    </p>
  ) : null;
}

type PortionProperty = "necessary" | "provided" | "prepaid" | "confirmedZero";

function MealOccasionFields({
  row,
  party,
  onChange,
  onRemove,
  onSchedulingChange,
}: {
  row: MealPreviewRow;
  party: number;
  onChange: (property: PortionProperty, value: number | boolean) => void;
  onRemove?: () => void;
  onSchedulingChange: (value: MealScheduling) => void;
}) {
  const { id, label, portions } = row;
  const canRemove =
    portions.necessary === 0 &&
    portions.provided === 0 &&
    portions.prepaid === 0 &&
    portions.confirmedZero;
  return (
    <fieldset className="rounded-2xl border border-border p-4">
      <legend className="px-2 text-sm font-semibold">
        {label}
        {row.extra && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            · contoh tambahan
          </span>
        )}
      </legend>
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            { property: "necessary", label: "Diperlukan" },
            { property: "provided", label: "Dibawa" },
            { property: "prepaid", label: "Prabayar" },
          ] as const
        ).map(({ property, label: portionLabel }) => (
          <div key={property}>
            <label
              htmlFor={`${id}-${property}`}
              className="text-xs text-muted-foreground"
            >
              {portionLabel} (porsi)
            </label>
            <input
              id={`${id}-${property}`}
              aria-label={`${label}: ${portionLabel.toLowerCase()} (porsi)`}
              type="number"
              min={0}
              max={party}
              inputMode="numeric"
              value={
                Number.isFinite(portions[property]) ? portions[property] : ""
              }
              onChange={(event) =>
                onChange(
                  property,
                  event.target.value === ""
                    ? Number.NaN
                    : Number(event.target.value),
                )
              }
              className={fieldClass}
            />
          </div>
        ))}
      </div>
      {portions.necessary === 0 && (
        <label className="mt-4 flex items-start gap-2 text-xs leading-relaxed">
          <input
            id={`${id}-zero`}
            type="checkbox"
            checked={portions.confirmedZero}
            onChange={(event) =>
              onChange("confirmedZero", event.target.checked)
            }
            className="mt-0.5 accent-primary"
          />
          <span>
            Saya mengonfirmasi bahwa inventaris contoh {label.toLowerCase()}{" "}
            hari ini memang tidak memiliki porsi yang diperlukan. Ini bukan
            pengecualian biaya untuk makan yang tetap diperlukan.
          </span>
        </label>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        {Number.isFinite(portions.necessary) &&
        portions.provided + portions.prepaid <= portions.necessary
          ? `${portions.necessary - portions.provided - portions.prepaid} porsi masih perlu dibeli · biaya belum diketahui`
          : "Periksa jumlah porsi: pembagian belum valid."}
      </p>
      <MealSchedulingFields
        id={id}
        label={label}
        value={portions.scheduling}
        onChange={onSchedulingChange}
      />
      {onRemove && (
        <div className="mt-4 border-t border-border pt-3">
          <button
            type="button"
            onClick={onRemove}
            disabled={!canRemove}
            className="text-xs font-semibold text-primary underline underline-offset-4 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
            aria-describedby={`${id}-removal-help`}
          >
            Hapus {label.toLowerCase()}
          </button>
          <p
            id={`${id}-removal-help`}
            className="mt-2 text-xs leading-relaxed text-muted-foreground"
          >
            Hanya dapat dihapus setelah semua porsi nol dan inventaris nol
            dikonfirmasi secara khusus. Kebutuhan yang masih ada tetap harus
            masuk anggaran.
          </p>
        </div>
      )}
    </fieldset>
  );
}

const subscribeToReadiness = () => () => undefined;
const clientReady = () => true;
const serverReady = () => false;

export function PreferenceIntake({ initialToday }: { initialToday?: string }) {
  const ready = useSyncExternalStore(
    subscribeToReadiness,
    clientReady,
    serverReady,
  );
  const planning = usePlanning();
  const router = useRouter();
  const [today] = useState(() => initialToday ?? cityToday());
  const [input, setInput] = useState<IntakePreview>(
    () => planning.submission?.input ?? initialIntake(today),
  );
  const [dayValues, setDayValues] = useState<Record<string, DayPreview>>(() =>
    Object.fromEntries(
      (planning.submission?.days ?? []).map((value) => [value.date, value]),
    ),
  );
  const [step, setStep] = useState(0);
  const [activeDay, setActiveDay] = useState(0);
  const [issues, setIssues] = useState<FormIssue[]>([]);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [dailyMessage, setDailyMessage] = useState("");
  const dailyHeading = useRef<HTMLHeadingElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const dates = previewDates(input.startDate, input.endDate);
  const days = dates.map(
    (date) => dayValues[date] ?? initialDay(date, input.party),
  );
  const selectedDayIndex = Math.min(activeDay, Math.max(0, days.length - 1));
  const day = days[selectedDayIndex];
  const purchased = days.reduce(
    (total, value) => total + purchasedPortions(value),
    0,
  );

  function submit() {
    const found = [
      ...validateTripForm(input, today),
      ...validatePaceForm(input),
      ...validateDayForms(days, input.party),
    ];
    if (found.length) {
      setIssues(found);
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    if (!reviewConfirmed || planning.phase === "loading") return;
    void planning.generate({ input, days });
    router.push("/rencana");
  }

  function update<K extends keyof IntakePreview>(
    key: K,
    value: IntakePreview[K],
  ) {
    setInput((current) => ({ ...current, [key]: value }));
    if (key === "party")
      setDayValues((current) =>
        Object.fromEntries(
          Object.entries(current).map(([date, value]) => [
            date,
            { ...value, inventoryConfirmed: false },
          ]),
        ),
      );
    setReviewConfirmed(false);
    setIssues([]);
  }
  function updateDay(patch: Partial<DayPreview>) {
    if (!day) return;
    setDayValues((current) => ({
      ...current,
      [day.date]: { ...day, ...patch },
    }));
    setReviewConfirmed(false);
    setIssues([]);
    setDailyMessage("");
  }
  function copyWindowToOtherDays() {
    if (!day) return;
    const timeIssues = validateDayForms([day], input.party)
      .filter((issue) => issue.id === "day-start")
      .map((issue) => ({
        ...issue,
        message: issue.message.replace(
          "Hari 1:",
          `Hari ${selectedDayIndex + 1}:`,
        ),
      }));
    if (timeIssues.length) {
      setIssues(timeIssues);
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setDayValues((current) => ({
      ...current,
      ...Object.fromEntries(
        days
          .filter((target) => target.date !== day.date)
          .map((target) => [
            target.date,
            {
              ...target,
              start: day.start,
              end: day.end,
              startAnchor: day.startAnchor,
              endAnchor: day.endAnchor,
              inventoryConfirmed: false,
            },
          ]),
      ),
    }));
    setReviewConfirmed(false);
    setIssues([]);
    setDailyMessage(
      `Waktu dan titik perjalanan disalin ke ${days.length - 1} hari lain. Kebutuhan makan dan pilihan pengalaman tetap; periksa dan konfirmasi inventaris tiap hari kembali.`,
    );
  }
  function updateMeal(
    key: string,
    property: PortionProperty,
    value: number | boolean,
  ) {
    if (!day) return;
    const changedPortions = (portions: MealPortions): MealPortions => ({
      ...portions,
      ...(property === "necessary" ? { confirmedZero: false } : {}),
      [property]: value,
    });
    if (key in MEAL_LABELS)
      updateDay({
        meals: {
          ...day.meals,
          [key]: changedPortions(day.meals[key as MealKey]),
        },
        inventoryConfirmed: false,
      });
    else
      updateDay({
        extraMeals: day.extraMeals.map((occasion) =>
          occasion.id === key
            ? { ...occasion, portions: changedPortions(occasion.portions) }
            : occasion,
        ),
        inventoryConfirmed: false,
      });
  }
  function addExtraMeal() {
    if (!day) return;
    const number =
      Math.max(
        0,
        ...day.extraMeals.map((occasion) =>
          Number(occasion.id.slice("extra-".length)),
        ),
      ) + 1;
    const id = `extra-${number}`;
    updateDay({
      extraMeals: [
        ...day.extraMeals,
        {
          id,
          label: `Makan tambahan ${number}`,
          portions: {
            necessary: input.party,
            provided: 0,
            prepaid: 0,
            confirmedZero: false,
          },
        },
      ],
      inventoryConfirmed: false,
    });
    requestAnimationFrame(() =>
      document.getElementById(`${id}-necessary`)?.focus(),
    );
  }
  function updateMealScheduling(key: string, scheduling: MealScheduling) {
    if (!day) return;
    if (key in MEAL_LABELS)
      updateDay({
        meals: {
          ...day.meals,
          [key]: { ...day.meals[key as MealKey], scheduling },
        },
        inventoryConfirmed: false,
      });
    else
      updateDay({
        extraMeals: day.extraMeals.map((occasion) =>
          occasion.id === key
            ? { ...occasion, portions: { ...occasion.portions, scheduling } }
            : occasion,
        ),
        inventoryConfirmed: false,
      });
  }
  function removeExtraMeal(id: string) {
    if (!day) return;
    const portions = day.extraMeals.find(
      (occasion) => occasion.id === id,
    )?.portions;
    if (
      !portions ||
      portions.necessary !== 0 ||
      portions.provided !== 0 ||
      portions.prepaid !== 0 ||
      !portions.confirmedZero
    )
      return;
    updateDay({
      extraMeals: day.extraMeals.filter((occasion) => occasion.id !== id),
      inventoryConfirmed: false,
    });
    requestAnimationFrame(() =>
      document.getElementById("add-meal-occasion")?.focus(),
    );
  }
  function changeStep(next: number) {
    setStep(next);
    setIssues([]);
    requestAnimationFrame(() => titleRef.current?.focus());
  }
  function nextStep() {
    const found =
      step === 0
        ? validateTripForm(input, today)
        : step === 1
          ? validatePaceForm(input)
          : validateDayForms(days, input.party);
    if (found.length) {
      setIssues(found);
      if (found[0].day) setActiveDay(dates.indexOf(found[0].day));
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    changeStep(step + 1);
  }
  function toggleInterest(id: string) {
    const selected = input.interests.includes(id);
    setInput((current) => ({
      ...current,
      interests: selected
        ? current.interests.filter((value) => value !== id)
        : [...current.interests, id],
      mandatoryInterests: selected
        ? current.mandatoryInterests.filter((value) => value !== id)
        : current.mandatoryInterests,
    }));
    setReviewConfirmed(false);
  }
  function toggleMandatory(id: string) {
    update(
      "mandatoryInterests",
      input.mandatoryInterests.includes(id)
        ? input.mandatoryInterests.filter((value) => value !== id)
        : [...input.mandatoryInterests, id],
    );
  }
  const focusIssue = (issue: FormIssue) => {
    if (issue.day) setActiveDay(dates.indexOf(issue.day));
    requestAnimationFrame(() => document.getElementById(issue.id)?.focus());
  };

  return (
    <div className="page-shell pb-20 pt-8 sm:pt-12">
      <div className="content-container">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Kembali menjelajah
        </Link>
        <div className="mb-9 max-w-3xl">
          <p className="eyebrow mb-3">PERJALANAN YANG TERASA SEPERTI ANDA</p>
          <h1 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">
            Mulai dari cara Anda menikmati.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Sedikit preferensi, lebih banyak ruang untuk pengalaman bermakna.
            Jelajahi alur perencanaan dengan skenario contoh.
          </p>
        </div>
        <div className="mb-8">
          <Note>
            <strong>
              {COMPETITION_DEMO
                ? `${DEMO_LABEL}.`
                : "Preview lokal · data sintetis."}
            </strong>{" "}
            Gunakan pilihan contoh saja, tanpa data perjalanan pribadi. Isian
            hanya ada di memori halaman dan hilang saat dimuat ulang. Ranking
            memakai mock offline; rute dan biaya adalah simulasi.
          </Note>
        </div>

        <nav aria-label="Tahapan preferensi" className="mb-8">
          <ol className="grid grid-cols-4 gap-2 sm:gap-4">
            {STEPS.map((label, index) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => index < step && changeStep(index)}
                  disabled={!ready || index > step}
                  aria-current={step === index ? "step" : undefined}
                  className={cn(
                    "flex w-full flex-col items-start gap-2 border-t-2 pb-1 pt-3 text-left text-xs sm:flex-row sm:items-center sm:gap-3 sm:text-sm",
                    index <= step
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground",
                    index < step && "hover:opacity-75",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      index <= step
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary",
                    )}
                  >
                    {index < step ? (
                      <Check className="size-3.5" aria-hidden="true" />
                    ) : (
                      `0${index + 1}`
                    )}
                  </span>
                  <span className="font-medium">{label}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <fieldset
            disabled={!ready}
            aria-busy={!ready}
            aria-label="Isian preferensi sintetis"
            className="min-w-0"
          >
            {!ready && (
              <p role="status" className="mb-4 text-sm text-muted-foreground">
                Menyiapkan formulir lokal…
              </p>
            )}
            <div className="mb-6 flex items-end justify-between gap-3">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">
                  LANGKAH {step + 1} DARI 4
                </p>
                <h2
                  ref={titleRef}
                  tabIndex={-1}
                  className="font-display text-3xl outline-none"
                >
                  {
                    [
                      "Ruang untuk perjalanan Anda",
                      "Apa yang membuat Anda penasaran?",
                      "Lengkapi setiap harinya",
                      "Satu pandangan, semua preferensi",
                    ][step]
                  }
                </h2>
              </div>
            </div>
            {issues.length > 0 && (
              <div
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                className="mb-5 rounded-2xl border border-destructive/25 bg-red-50 p-4 text-sm text-destructive outline-none focus:ring-2 focus:ring-destructive"
              >
                <p className="font-semibold">Ada yang perlu dilengkapi.</p>
                <ul className="mt-2 space-y-1">
                  {issues.map((issue, index) => (
                    <li key={`${issue.id}-${index}`}>
                      <button
                        type="button"
                        className="text-left underline underline-offset-4"
                        onClick={() => focusIssue(issue)}
                      >
                        {issue.message}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {step === 0 && (
              <div className="space-y-5">
                <section
                  className={sectionClass}
                  aria-labelledby="destination-label"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p id="destination-label" className={labelClass}>
                        Destinasi pilot
                      </p>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="rounded-xl bg-secondary p-3">
                          <MapPin
                            className="size-5 text-primary"
                            aria-hidden="true"
                          />
                        </div>
                        <div>
                          <p className="font-display text-2xl">Palembang</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Sumatera Selatan · Asia/Jakarta
                          </p>
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline">Pilot</Badge>
                  </div>
                  <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                    Katalog nyata belum tersedia. Semua tempat dan titik
                    perjalanan pada preview adalah simulasi, tanpa persetujuan
                    peninjau independen.
                  </p>
                </section>
                <section
                  className={sectionClass}
                  aria-labelledby="trip-details-label"
                >
                  <h3
                    id="trip-details-label"
                    className="mb-5 flex items-center gap-2 font-semibold"
                  >
                    <CalendarDays
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />{" "}
                    Waktu & teman perjalanan
                  </h3>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="start-date" className={labelClass}>
                        Tanggal mulai contoh
                      </label>
                      <input
                        id="start-date"
                        type="date"
                        min={today}
                        max={addDays(today, 90)}
                        value={input.startDate}
                        onChange={(event) =>
                          update("startDate", event.target.value)
                        }
                        className={fieldClass}
                        aria-invalid={issues.some(
                          (issue) => issue.id === "start-date",
                        )}
                        aria-describedby={
                          issues.some((issue) => issue.id === "start-date")
                            ? "start-date-error"
                            : undefined
                        }
                      />
                      <FieldError id="start-date" issues={issues} />
                    </div>
                    <div>
                      <label htmlFor="end-date" className={labelClass}>
                        Tanggal selesai contoh
                      </label>
                      <input
                        id="end-date"
                        type="date"
                        min={input.startDate || today}
                        max={addDays(today, 90)}
                        value={input.endDate}
                        onChange={(event) =>
                          update("endDate", event.target.value)
                        }
                        className={fieldClass}
                      />
                      <p className="mt-2 text-xs text-muted-foreground">
                        1–7 hari, termasuk tanggal mulai dan selesai.
                      </p>
                    </div>
                    <div>
                      <label htmlFor="party" className={labelClass}>
                        Jumlah peserta contoh
                      </label>
                      <div className="relative">
                        <Users
                          className="absolute left-3.5 top-5 size-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <input
                          id="party"
                          type="number"
                          min={1}
                          max={8}
                          inputMode="numeric"
                          value={
                            Number.isFinite(input.party) ? input.party : ""
                          }
                          onChange={(event) =>
                            update(
                              "party",
                              event.target.value === ""
                                ? Number.NaN
                                : Number(event.target.value),
                            )
                          }
                          className={cn(fieldClass, "pl-10")}
                          aria-invalid={issues.some(
                            (issue) => issue.id === "party",
                          )}
                        />
                        <FieldError id="party" issues={issues} />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="budget" className={labelClass}>
                        Total anggaran grup (IDR)
                      </label>
                      <input
                        id="budget"
                        type="text"
                        inputMode="numeric"
                        value={input.budget}
                        onChange={(event) =>
                          update("budget", event.target.value)
                        }
                        className={fieldClass}
                        aria-invalid={issues.some(
                          (issue) => issue.id === "budget",
                        )}
                      />
                      <FieldError id="budget" issues={issues} />
                    </div>
                  </div>
                  <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                    Anggaran contoh mencakup aktivitas, seluruh makan yang
                    diperlukan, dan transportasi lokal untuk grup. Penginapan
                    dan perjalanan antarkota di luar cakupan. Perhitungan
                    deterministik memakai batas atas biaya fixture dan cadangan
                    10%, bukan tarif nyata.
                  </p>
                </section>
                <fieldset className={sectionClass}>
                  <legend className="sr-only">Transportasi utama contoh</legend>
                  <p className="mb-4 font-semibold">
                    Bagaimana Anda ingin bergerak?
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(
                      Object.entries(TRANSPORT_LABELS) as [Transport, string][]
                    ).map(([key, label]) => (
                      <label
                        key={key}
                        className={cn(
                          "relative flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-sm transition focus-within:ring-2 focus-within:ring-primary",
                          input.transport === key
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40",
                        )}
                      >
                        <input
                          type="radio"
                          name="transport"
                          value={key}
                          checked={input.transport === key}
                          onChange={() => update("transport", key)}
                          className="accent-primary"
                        />
                        {key === "walk" ? (
                          <Footprints className="size-4" aria-hidden="true" />
                        ) : (
                          <CarFront className="size-4" aria-hidden="true" />
                        )}
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                    Seluruh mode tetap menghitung berjalan kaki, termasuk akses
                    dan area kunjungan. Mobil atau taksi tidak menjanjikan
                    ketersediaan kendaraan, tarif, atau rute sungai.
                  </p>
                </fieldset>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <fieldset className={sectionClass}>
                  <legend className="sr-only">Minat budaya contoh</legend>
                  <div className="mb-5">
                    <h3 className="font-semibold">
                      Ikuti rasa ingin tahu Anda
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Pilih minat, lalu tandai “wajib” jika harus tercakup
                      setidaknya satu kunjungan sepanjang perjalanan.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {INTEREST_OPTIONS.map((interest) => (
                      <div
                        key={interest.id}
                        className={cn(
                          "rounded-2xl border p-4",
                          input.interests.includes(interest.id)
                            ? "border-primary/50 bg-primary/5"
                            : "border-border",
                        )}
                      >
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            checked={input.interests.includes(interest.id)}
                            onChange={() => toggleInterest(interest.id)}
                            className="mt-1 accent-primary"
                          />
                          <span>
                            <span className="block text-sm font-semibold">
                              {interest.label}
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {interest.description}
                            </span>
                          </span>
                        </label>
                        {input.interests.includes(interest.id) && (
                          <label className="ml-7 mt-3 flex cursor-pointer items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={input.mandatoryInterests.includes(
                                interest.id,
                              )}
                              onChange={() => toggleMandatory(interest.id)}
                              className="accent-primary"
                            />{" "}
                            Wajib tercakup sepanjang perjalanan
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                    Label kategori ini sintetis dan belum ditinjau secara
                    budaya. Pilihan wajib tidak membuktikan ada tempat yang
                    memenuhi; klasifikasi dan tumpang tindih kategori nyata
                    menunggu peninjau independen.
                  </p>
                </fieldset>
                <fieldset className={sectionClass}>
                  <legend className="sr-only">Ritme perjalanan contoh</legend>
                  <h3 className="mb-5 flex items-center gap-2 font-semibold">
                    <SlidersHorizontal
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />{" "}
                    Temukan ritme Anda
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(
                      Object.entries(PACE_OPTIONS) as [
                        Pace,
                        (typeof PACE_OPTIONS)[Pace],
                      ][]
                    ).map(([key, option]) => (
                      <label
                        key={key}
                        className={cn(
                          "cursor-pointer rounded-2xl border p-4 transition focus-within:ring-2 focus-within:ring-primary",
                          input.pace === key
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40",
                        )}
                      >
                        <span className="flex items-center justify-between">
                          <span className="font-semibold">{option.label}</span>
                          <input
                            type="radio"
                            name="pace"
                            checked={input.pace === key}
                            onChange={() => {
                              update("pace", key);
                              update("walkingLimit", option.meters);
                            }}
                            className="accent-primary"
                          />
                        </span>
                        <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">
                          {option.description}
                        </span>
                        <span className="mt-4 block text-xs font-medium">
                          Maks. {option.stops} tempat / hari
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {option.meters.toLocaleString("id-ID")} m jalan /
                          orang / hari
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-5">
                    <label htmlFor="planning-style" className={labelClass}>
                      Seberapa banyak hari ingin direncanakan?
                    </label>
                    <select
                      id="planning-style"
                      className={fieldClass}
                      value={input.planningStyle ?? "short"}
                      onChange={(event) =>
                        update(
                          "planningStyle",
                          event.target.value as "short" | "pace",
                        )
                      }
                    >
                      <option value="short">
                        Singkat · cakupan wajib, lebih banyak waktu bebas
                      </option>
                      <option value="pace">
                        Ikuti ritme{" "}
                        {PACE_OPTIONS[input.pace].label.toLowerCase()} · cari
                        kunjungan tambahan yang sesuai
                      </option>
                    </select>
                    <p className="mt-2 text-xs leading-6 text-muted-foreground">
                      Batas tempat dan jalan kaki tetap sama. Pencarian terbatas
                      pada kandidat yang layak; waktu kosong tidak diisi dengan
                      kegiatan rekaan dan syarat Anda tidak diubah otomatis.
                    </p>
                  </div>
                  <div className="mt-5">
                    <label htmlFor="walking-limit" className={labelClass}>
                      Batas jalan kaki harian (meter / orang)
                    </label>
                    <input
                      id="walking-limit"
                      type="number"
                      min={1}
                      max={PACE_OPTIONS[input.pace].meters}
                      inputMode="numeric"
                      value={
                        Number.isFinite(input.walkingLimit)
                          ? input.walkingLimit
                          : ""
                      }
                      onChange={(event) =>
                        update(
                          "walkingLimit",
                          event.target.value === ""
                            ? Number.NaN
                            : Number(event.target.value),
                        )
                      }
                      className={cn(fieldClass, "max-w-xs")}
                      aria-invalid={issues.some(
                        (issue) => issue.id === "walking-limit",
                      )}
                    />
                    <FieldError id="walking-limit" issues={issues} />
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      Boleh dikurangi dari preset. Termasuk akses, area
                      kunjungan, dan perjalanan kembali. Batas ini bukan
                      sertifikasi aksesibilitas; metode ukur dan ketidakpastian
                      masih perlu tinjauan kompeten.
                    </p>
                  </div>
                </fieldset>
                <section
                  className={sectionClass}
                  aria-labelledby="food-access-label"
                >
                  <h3 id="food-access-label" className="mb-5 font-semibold">
                    Selera & kebutuhan praktis
                  </h3>
                  <div className="space-y-5">
                    <div>
                      <label htmlFor="food-preference" className={labelClass}>
                        Preferensi rasa contoh (opsional)
                      </label>
                      <select
                        id="food-preference"
                        value={input.foodPreference}
                        onChange={(event) =>
                          update("foodPreference", event.target.value)
                        }
                        className={fieldClass}
                      >
                        <option value="neutral">
                          Terbuka untuk pilihan contoh
                        </option>
                        <option value="savory">Contoh: cita rasa gurih</option>
                        <option value="mild">Contoh: tidak pedas</option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="dietary-requirement"
                        className={labelClass}
                      >
                        Persyaratan makanan contoh
                      </label>
                      <select
                        id="dietary-requirement"
                        value={input.dietaryRequirement}
                        onChange={(event) =>
                          update("dietaryRequirement", event.target.value)
                        }
                        className={fieldClass}
                      >
                        <option value="none">
                          Tidak ada persyaratan wajib pada skenario ini
                        </option>
                        <option value="ingredients">
                          Contoh: wajib bukti daftar bahan
                        </option>
                        <option value="halal">
                          Contoh: wajib bukti halal yang sesuai
                        </option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="accessibility-requirement"
                        className={labelClass}
                      >
                        Kebutuhan akses contoh
                      </label>
                      <select
                        id="accessibility-requirement"
                        value={input.accessibilityRequirement}
                        onChange={(event) =>
                          update("accessibilityRequirement", event.target.value)
                        }
                        className={fieldClass}
                      >
                        <option value="none">
                          Tidak ada persyaratan wajib pada skenario ini
                        </option>
                        <option value="step-free">
                          Contoh: wajib pintu masuk tanpa anak tangga
                        </option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-5">
                    <Note warning>
                      Gunakan skenario sintetis, bukan kebutuhan pribadi.
                      Persyaratan wajib memerlukan bukti khusus; nama makanan,
                      tag, atau ritme tidak membuktikan kesesuaian. Bukti yang
                      belum diketahui membuat hasil draf; ketidaksesuaian yang
                      diketahui membuat hasil terblokir.
                    </Note>
                  </div>
                </section>
              </div>
            )}

            {step === 2 && day && (
              <div className="space-y-5">
                <Note>
                  Waktu harian tidak menghapus kebutuhan makan. Hari parsial,
                  hari bebas, dan opt-out pengalaman tetap memerlukan inventaris
                  makan yang lengkap.
                </Note>
                <p
                  className="text-sm font-semibold"
                  role="status"
                  aria-live="polite"
                >
                  {days.filter((value) => value.inventoryConfirmed).length} dari{" "}
                  {days.length} inventaris harian dikonfirmasi. Setiap hari
                  tetap diperiksa sendiri.
                </p>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Pilih hari untuk dilengkapi"
                >
                  {days.map((value, index) => (
                    <button
                      key={value.date}
                      type="button"
                      aria-pressed={selectedDayIndex === index}
                      aria-label={`Hari ${index + 1}`}
                      aria-describedby={`inventory-status-${index}`}
                      onClick={() => {
                        setActiveDay(index);
                        setIssues([]);
                      }}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm",
                        selectedDayIndex === index
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-white hover:border-primary",
                      )}
                    >
                      <span>Hari {index + 1}</span>
                      <span
                        id={`inventory-status-${index}`}
                        className="sr-only"
                      >
                        {value.inventoryConfirmed
                          ? "Inventaris makan dikonfirmasi"
                          : "Inventaris makan belum dikonfirmasi"}
                      </span>
                      {value.inventoryConfirmed && (
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      )}
                    </button>
                  ))}
                </div>
                <section
                  className={sectionClass}
                  aria-labelledby="daily-window-label"
                >
                  <div className="mb-5 flex items-center justify-between gap-2">
                    <h3
                      id="daily-window-label"
                      ref={dailyHeading}
                      tabIndex={-1}
                      className="font-semibold outline-none"
                    >
                      {dateLabel(day.date)}
                    </h3>
                    <Badge variant="outline">WIB</Badge>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="day-start" className={labelClass}>
                        Mulai aktivitas
                      </label>
                      <input
                        id="day-start"
                        type="time"
                        aria-invalid={issues.some(
                          (issue) => issue.id === "day-start",
                        )}
                        aria-describedby={
                          issues.some((issue) => issue.id === "day-start")
                            ? "day-start-error"
                            : undefined
                        }
                        value={day.start}
                        onChange={(event) =>
                          updateDay({ start: event.target.value })
                        }
                        className={fieldClass}
                      />
                      <FieldError id="day-start" issues={issues} />
                    </div>
                    <div>
                      <label htmlFor="day-end" className={labelClass}>
                        Selesai aktivitas
                      </label>
                      <input
                        id="day-end"
                        type="time"
                        value={day.end}
                        onChange={(event) =>
                          updateDay({ end: event.target.value })
                        }
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="start-anchor" className={labelClass}>
                        Titik awal sintetis
                      </label>
                      <select
                        id="start-anchor"
                        value={day.startAnchor}
                        onChange={(event) =>
                          updateDay({ startAnchor: event.target.value })
                        }
                        className={fieldClass}
                      >
                        <option value="anchor-a">Titik simulasi A</option>
                        <option value="anchor-b">Titik simulasi B</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="end-anchor" className={labelClass}>
                        Titik kembali sintetis
                      </label>
                      <select
                        id="end-anchor"
                        value={day.endAnchor}
                        onChange={(event) =>
                          updateDay({ endAnchor: event.target.value })
                        }
                        className={fieldClass}
                      >
                        <option value="anchor-a">Titik simulasi A</option>
                        <option value="anchor-b">Titik simulasi B</option>
                      </select>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Titik ini bukan lokasi nyata. Tidak ada koordinat atau
                    alamat pribadi yang dikumpulkan.
                  </p>
                  <div className="mt-5">
                    <label htmlFor="daily-coverage" className={labelClass}>
                      Pengalaman hari ini
                    </label>
                    <select
                      id="daily-coverage"
                      value={day.coverage}
                      onChange={(event) =>
                        updateDay({
                          coverage: event.target
                            .value as DayPreview["coverage"],
                        })
                      }
                      className={fieldClass}
                    >
                      {Object.entries(coverageLabels).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      Pilihan eksplisit per hari. Hari bebas atau opt-out tidak
                      menghapus minat wajib sepanjang perjalanan maupun anggaran
                      makan.
                    </p>
                  </div>
                  {days.length > 1 && (
                    <div className="mt-5 border-t border-border pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={copyWindowToOtherDays}
                      >
                        Salin waktu & titik ke {days.length - 1} hari lain
                      </Button>
                      <p className="mt-2 text-xs leading-6 text-muted-foreground">
                        Hanya jam mulai/selesai dan titik perjalanan. Porsi
                        makan serta pilihan pengalaman tidak disalin. Hari lain
                        perlu dikonfirmasi kembali; sesuaikan hari
                        kedatangan/kepulangan secara terpisah.
                      </p>
                      <p
                        role="status"
                        aria-live="polite"
                        className="mt-2 text-xs leading-6 text-primary"
                      >
                        {dailyMessage}
                      </p>
                    </div>
                  )}
                </section>
                <section
                  className={sectionClass}
                  aria-labelledby="meal-inventory-label"
                >
                  <h3
                    id="meal-inventory-label"
                    className="flex items-center gap-2 font-semibold"
                  >
                    <UtensilsCrossed
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />{" "}
                    Inventaris makan yang diperlukan
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Isi jumlah porsi untuk seluruh {input.party} peserta contoh,
                    termasuk di luar jam aktivitas. “Dibawa” dan “prabayar”
                    harus berupa jumlah porsi persis, tanpa tumpang tindih.
                  </p>
                  <div className="mt-6 space-y-5">
                    {mealPreviewRows(day).map((row) => (
                      <MealOccasionFields
                        key={row.id}
                        row={row}
                        party={input.party}
                        onChange={(property, value) =>
                          updateMeal(row.id, property, value)
                        }
                        onSchedulingChange={(value) =>
                          updateMealScheduling(row.id, value)
                        }
                        onRemove={
                          row.extra ? () => removeExtraMeal(row.id) : undefined
                        }
                      />
                    ))}
                  </div>
                  <div className="mt-5 rounded-2xl border border-dashed border-border p-4">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Sarapan, makan siang, dan makan malam adalah saran awal.
                      Tambahkan setiap kesempatan makan lain yang diperlukan
                      pada skenario contoh; tidak ada kebutuhan tambahan yang
                      boleh hilang dari inventaris atau biaya.
                    </p>
                    <Button
                      id="add-meal-occasion"
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addExtraMeal}
                      className="mt-3"
                    >
                      Tambah waktu makan contoh
                    </Button>
                  </div>
                  <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl bg-secondary p-4 text-sm leading-relaxed">
                    <input
                      id="inventory-confirmed"
                      type="checkbox"
                      checked={day.inventoryConfirmed}
                      onChange={(event) =>
                        updateDay({ inventoryConfirmed: event.target.checked })
                      }
                      className="mt-1 accent-primary"
                    />
                    <span>
                      Saya mengonfirmasi inventaris contoh hari ini lengkap,
                      termasuk hari parsial dan kebutuhan di luar jam kunjungan.
                      Porsi dibawa / prabayar persis sesuai deklarasi di atas.
                    </span>
                  </label>
                  <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                    Tidak ada penghapusan makan secara umum dari anggaran. Semua
                    porsi yang perlu dibeli harus memiliki biaya bersumber atau
                    allowance dengan metode yang ditinjau. Metode dan biaya
                    nyata belum tersedia; simulasi memakai allowance fixture
                    yang dilabeli sintetis.
                  </p>
                  {selectedDayIndex < days.length - 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4"
                      onClick={() => {
                        setActiveDay(selectedDayIndex + 1);
                        setIssues([]);
                        requestAnimationFrame(() =>
                          dailyHeading.current?.focus(),
                        );
                      }}
                    >
                      Periksa Hari {selectedDayIndex + 2}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Button>
                  )}
                </section>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <section
                  className={sectionClass}
                  aria-labelledby="review-trip-label"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <h3 id="review-trip-label" className="font-semibold">
                      Gambaran perjalanan contoh
                    </h3>
                    <button
                      type="button"
                      onClick={() => changeStep(0)}
                      className="text-sm font-medium text-primary underline underline-offset-4"
                    >
                      Ubah perjalanan
                    </button>
                  </div>
                  <dl className="grid gap-5 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">Tujuan & waktu</dt>
                      <dd className="mt-1 font-semibold">
                        Palembang · {dates.length} hari
                      </dd>
                      <dd className="mt-1 text-xs text-muted-foreground">
                        {dateLabel(input.startDate, true)}–
                        {dateLabel(input.endDate, true)} · WIB
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">
                        Grup & anggaran total
                      </dt>
                      <dd className="mt-1 font-semibold">
                        {input.party} orang ·{" "}
                        {formatRupiah(Number(input.budget))}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">
                        Transportasi & ritme
                      </dt>
                      <dd className="mt-1 font-semibold">
                        {TRANSPORT_LABELS[input.transport]} ·{" "}
                        {PACE_OPTIONS[input.pace].label}
                        {input.planningStyle !== "pace"
                          ? " · rencana singkat"
                          : " · eksplorasi sesuai ritme"}
                      </dd>
                      <dd className="mt-1 text-xs text-muted-foreground">
                        Maks. {PACE_OPTIONS[input.pace].stops} tempat &{" "}
                        {input.walkingLimit.toLocaleString("id-ID")} m / orang /
                        hari
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Minat contoh</dt>
                      <dd className="mt-1 font-semibold">
                        {INTEREST_OPTIONS.filter((interest) =>
                          input.interests.includes(interest.id),
                        )
                          .map(
                            (interest) =>
                              `${interest.label}${input.mandatoryInterests.includes(interest.id) ? " (wajib)" : ""}`,
                          )
                          .join(", ") || "Belum dipilih"}
                      </dd>
                      <dd className="mt-1 text-xs text-muted-foreground">
                        Taksonomi sintetis · belum ditinjau
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">
                        Preferensi rasa contoh
                      </dt>
                      <dd className="mt-1 font-semibold">
                        {input.foodPreference === "neutral"
                          ? "Terbuka untuk pilihan contoh"
                          : input.foodPreference === "savory"
                            ? "Cita rasa gurih"
                            : "Tidak pedas"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">
                        Persyaratan contoh
                      </dt>
                      <dd className="mt-1 font-semibold">
                        {input.dietaryRequirement === "none"
                          ? "Tanpa syarat makanan wajib"
                          : input.dietaryRequirement === "halal"
                            ? "Wajib bukti halal"
                            : "Wajib bukti daftar bahan"}
                        ;{" "}
                        {input.accessibilityRequirement === "none"
                          ? "tanpa syarat akses wajib"
                          : "wajib pintu masuk tanpa anak tangga"}
                      </dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={() => changeStep(1)}
                    className="mt-5 text-sm font-medium text-primary underline underline-offset-4"
                  >
                    Ubah minat & kebutuhan
                  </button>
                </section>
                <section
                  className={sectionClass}
                  aria-labelledby="review-days-label"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <h3 id="review-days-label" className="font-semibold">
                      Kesiapan setiap hari
                    </h3>
                    <button
                      type="button"
                      onClick={() => changeStep(2)}
                      className="text-sm font-medium text-primary underline underline-offset-4"
                    >
                      Ubah harian
                    </button>
                  </div>
                  <ul className="divide-y divide-border">
                    {days.map((value, index) => (
                      <li
                        key={value.date}
                        className="py-4 first:pt-0 last:pb-0"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold">
                            Hari {index + 1} · {dateLabel(value.date, true)}
                          </p>
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock3 className="size-3.5" aria-hidden="true" />{" "}
                            {value.start}–{value.end} WIB
                          </p>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {coverageLabels[value.coverage]} · Titik simulasi{" "}
                          {value.startAnchor === "anchor-a" ? "A" : "B"} →{" "}
                          {value.endAnchor === "anchor-a" ? "A" : "B"}
                        </p>
                        <p className="mt-2 text-xs">
                          {mealPreviewRows(value)
                            .map(
                              ({ label, portions: meal }) =>
                                `${label} ${meal.necessary} porsi (${meal.provided} dibawa, ${meal.prepaid} prabayar) · ${meal.scheduling?.mode === "scheduled" ? `wajib dijadwalkan ${meal.scheduling.window.start}–${meal.scheduling.window.end}` : "biaya tanpa jadwal"}`,
                            )
                            .join(" · ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 rounded-xl bg-secondary p-4 text-sm">
                    <strong>{purchased} porsi perlu dibeli.</strong> Semua porsi
                    ini dihitung dengan fixture biaya makan sintetis, termasuk
                    kebutuhan di luar waktu kunjungan.
                  </div>
                </section>
                <Note warning>
                  <strong>Kebutuhan wajib tetap diperiksa.</strong> Hasil
                  dihitung dari isian dengan katalog, waktu, rute, dan biaya
                  fixture sintetis. Bukti yang hilang menghasilkan draf;
                  pelanggaran batas menghasilkan status terblokir. Ini tidak
                  membuktikan kelayakan perjalanan nyata atau persetujuan
                  peninjau manusia. Tidak ada AI atau routing berbayar.
                </Note>
                {dates.length === 7 && input.pace === "active" && (
                  <Note warning>
                    Tujuh hari dengan lima tempat per hari memerlukan 42 rute
                    awal: seluruh plafon 42 percobaan telah terpakai, sebelum
                    akses tambahan, retry, atau hitung ulang. Kepadatan lebih
                    rendah diprioritaskan bila semua syarat terpenuhi; batas
                    tidak dinaikkan otomatis.
                  </Note>
                )}
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-white p-5 text-sm leading-relaxed">
                  <input
                    type="checkbox"
                    checked={reviewConfirmed}
                    onChange={(event) =>
                      setReviewConfirmed(event.target.checked)
                    }
                    className="mt-1 accent-primary"
                  />
                  <span>
                    Saya memahami bahwa hasil dihitung dari{" "}
                    <strong>isian dan fixture sintetis</strong>, bukan
                    rekomendasi perjalanan nyata. Isian hanya berada dalam
                    memori browser, tanpa penyimpanan atau pengiriman ke
                    penyedia. Muat ulang menghapusnya.
                  </span>
                </label>
              </div>
            )}

            <div className="mt-7 flex items-center justify-between gap-3 border-t border-border pt-6">
              {step > 0 ? (
                <Button variant="outline" onClick={() => changeStep(step - 1)}>
                  <ArrowLeft className="size-4" aria-hidden="true" /> Kembali
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Sekitar 4 langkah singkat
                </span>
              )}
              {step < 3 ? (
                <Button onClick={nextStep}>
                  Lanjutkan <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  onClick={submit}
                  disabled={!reviewConfirmed || planning.phase === "loading"}
                >
                  Hitung rencana sintetis{" "}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          </fieldset>

          <aside
            className="space-y-5 lg:sticky lg:top-24"
            aria-label="Ringkasan skenario contoh"
          >
            <div className="rounded-3xl bg-primary p-6 text-primary-foreground">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-primary-foreground/70">
                  Skenario Anda
                </span>
                <Sparkles
                  className="size-4 text-primary-foreground/70"
                  aria-hidden="true"
                />
              </div>
              <h2 className="font-display text-3xl">
                Palembang,
                <br />
                dengan ritme Anda.
              </h2>
              <div className="my-5 border-t border-primary-foreground/20" />
              <dl className="space-y-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-primary-foreground/70">Durasi contoh</dt>
                  <dd>
                    {dates.length ? `${dates.length} hari` : "Periksa tanggal"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-primary-foreground/70">Peserta</dt>
                  <dd>
                    {Number.isInteger(input.party) &&
                    input.party >= 1 &&
                    input.party <= 8
                      ? `${input.party} orang`
                      : "Periksa jumlah"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-primary-foreground/70">Anggaran grup</dt>
                  <dd>
                    {/^\d+$/.test(input.budget) &&
                    Number(input.budget) > 0 &&
                    Number.isSafeInteger(Number(input.budget))
                      ? formatRupiah(Number(input.budget))
                      : "Periksa anggaran"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-primary-foreground/70">Ritme</dt>
                  <dd>
                    {PACE_OPTIONS[input.pace].label} ·{" "}
                    {input.planningStyle === "pace" ? "eksplorasi" : "singkat"}
                  </dd>
                </div>
              </dl>
              <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-primary-foreground/70">
                <ShieldCheck
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                Ringkasan input sintetis. Validasi berikutnya hanya simulasi;
                tidak ada persetujuan independen.
              </p>
            </div>
            <div className="rounded-2xl border border-border p-5">
              <h3 className="text-sm font-semibold">
                Rencana yang dapat Anda pahami.
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Fakta, perkiraan, dan data yang belum diketahui akan dibedakan.
                Kebutuhan wajib tetap wajib, bahkan ketika buktinya belum
                tersedia.
              </p>
              <Link
                href="/rencana"
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary"
              >
                Buka ruang hasil sintetis{" "}
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
