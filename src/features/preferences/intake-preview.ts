import { siteConfig } from "@/config/site";

/** Form-only helpers for the synthetic Phase A preview. This is not a planner. */
export const PACE_OPTIONS = {
  relaxed: {
    label: "Santai",
    stops: 3,
    meters: 2000,
    description: "Lebih banyak ruang untuk menikmati.",
  },
  balanced: {
    label: "Seimbang",
    stops: 4,
    meters: 4000,
    description: "Eksplorasi dengan jeda yang cukup.",
  },
  active: {
    label: "Aktif",
    stops: 5,
    meters: 8000,
    description: "Hari yang lebih padat, tetap ada batas.",
  },
} as const;

export type Pace = keyof typeof PACE_OPTIONS;
export type Transport = "walk" | "car" | "taxi";
export const TRANSPORT_LABELS: Record<Transport, string> = {
  walk: "Jalan kaki",
  car: "Mobil pribadi",
  taxi: "Taksi / ride-hail",
};
export const INTEREST_OPTIONS = [
  {
    id: "history-example",
    label: "Jejak sejarah",
    description: "Ruang dan cerita masa lalu",
  },
  {
    id: "craft-example",
    label: "Kriya & tradisi",
    description: "Proses, keterampilan, dan karya",
  },
  {
    id: "architecture-example",
    label: "Arsitektur",
    description: "Bentuk dan detail ruang",
  },
] as const;
export const MEAL_LABELS = {
  breakfast: "Sarapan",
  lunch: "Makan siang",
  dinner: "Makan malam",
} as const;
export type MealKey = keyof typeof MEAL_LABELS;
export type MealScheduling =
  | { mode: "unscheduled" }
  | {
      mode: "scheduled";
      serviceId: string;
      window: { start: string; end: string };
      windowConfirmed: boolean;
    };
export type MealPortions = {
  necessary: number;
  provided: number;
  prepaid: number;
  confirmedZero: boolean;
  scheduling?: MealScheduling;
};
export type ExtraMealPreview = {
  id: string;
  label: string;
  portions: MealPortions;
};
export type MealPreviewRow = ExtraMealPreview & { extra: boolean };
export type DayPreview = {
  date: string;
  start: string;
  end: string;
  startAnchor: string;
  endAnchor: string;
  coverage: "both" | "free" | "culture-only" | "food-only";
  meals: Record<MealKey, MealPortions>;
  extraMeals: ExtraMealPreview[];
  inventoryConfirmed: boolean;
};
export type IntakePreview = {
  startDate: string;
  endDate: string;
  party: number;
  budget: string;
  transport: Transport;
  pace: Pace;
  planningStyle?: "short" | "pace";
  walkingLimit: number;
  interests: string[];
  mandatoryInterests: string[];
  foodPreference: string;
  dietaryRequirement: string;
  accessibilityRequirement: string;
};
export type FormIssue = { id: string; message: string; day?: string };

export function cityToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: siteConfig.city.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}
export function previewDates(start: string, end: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end))
    return [];
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  const length = Math.round((endMs - startMs) / 86400000) + 1;
  if (!Number.isFinite(length) || length < 1 || length > 7) return [];
  if (
    new Date(startMs).toISOString().slice(0, 10) !== start ||
    new Date(endMs).toISOString().slice(0, 10) !== end
  )
    return [];
  return Array.from({ length }, (_, index) => addDays(start, index));
}
export function initialIntake(today: string): IntakePreview {
  return {
    startDate: addDays(today, 7),
    endDate: addDays(today, 8),
    party: 2,
    budget: "1500000",
    transport: "car",
    pace: "balanced",
    planningStyle: "short",
    walkingLimit: 4000,
    interests: ["history-example"],
    mandatoryInterests: [],
    foodPreference: "neutral",
    dietaryRequirement: "none",
    accessibilityRequirement: "none",
  };
}
export function initialDay(date: string, party: number): DayPreview {
  const portions = (): MealPortions => ({
    necessary: party,
    provided: 0,
    prepaid: 0,
    confirmedZero: false,
  });
  return {
    date,
    start: "08:00",
    end: "18:00",
    startAnchor: "anchor-a",
    endAnchor: "anchor-a",
    coverage: "both",
    meals: { breakfast: portions(), lunch: portions(), dinner: portions() },
    extraMeals: [],
    inventoryConfirmed: false,
  };
}
export function mealPreviewRows(day: DayPreview): MealPreviewRow[] {
  return [
    ...(Object.entries(day.meals) as [MealKey, MealPortions][]).map(
      ([id, portions]) => ({
        id,
        label: MEAL_LABELS[id],
        portions,
        extra: false,
      }),
    ),
    ...day.extraMeals.map((occasion) => ({ ...occasion, extra: true })),
  ];
}
export function validateTripForm(
  input: IntakePreview,
  today: string,
): FormIssue[] {
  const issues: FormIssue[] = [];
  if (!previewDates(input.startDate, input.endDate).length)
    issues.push({
      id: "start-date",
      message:
        "Pilih tanggal yang valid dengan durasi 1–7 hari, termasuk hari pertama dan terakhir.",
    });
  else if (input.startDate < today || input.endDate > addDays(today, 90))
    issues.push({
      id: "start-date",
      message: `Gunakan tanggal contoh mulai hari ini hingga 90 hari ke depan (${siteConfig.city.timeZone}).`,
    });
  if (!Number.isInteger(input.party) || input.party < 1 || input.party > 8)
    issues.push({
      id: "party",
      message: "Jumlah peserta contoh harus 1–8 orang.",
    });
  if (
    !/^\d+$/.test(input.budget) ||
    !Number.isSafeInteger(Number(input.budget)) ||
    Number(input.budget) <= 0
  )
    issues.push({
      id: "budget",
      message:
        "Masukkan anggaran grup berupa rupiah bulat yang lebih besar dari nol.",
    });
  return issues;
}
export function validatePaceForm(input: IntakePreview): FormIssue[] {
  if (
    !Number.isInteger(input.walkingLimit) ||
    input.walkingLimit < 1 ||
    input.walkingLimit > PACE_OPTIONS[input.pace].meters
  )
    return [
      {
        id: "walking-limit",
        message: `Batas jalan kaki harus 1–${PACE_OPTIONS[input.pace].meters.toLocaleString(siteConfig.city.locale)} meter per orang per hari.`,
      },
    ];
  return [];
}
export function validateDayForms(
  days: DayPreview[],
  party: number,
): FormIssue[] {
  const issues: FormIssue[] = [];
  days.forEach((day, index) => {
    const prefix = `Hari ${index + 1}`;
    const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    if (!clock.test(day.start) || !clock.test(day.end) || day.start >= day.end)
      issues.push({
        id: "day-start",
        message: `${prefix}: waktu selesai harus setelah waktu mulai pada hari yang sama.`,
        day: day.date,
      });
    for (const { id: key, label, portions: meal } of mealPreviewRows(day)) {
      const values = [meal.necessary, meal.provided, meal.prepaid];
      if (
        values.some(
          (value) => !Number.isInteger(value) || value < 0 || value > party,
        ) ||
        meal.provided + meal.prepaid > meal.necessary
      )
        issues.push({
          id: `${key}-necessary`,
          message: `${prefix}, ${label}: porsi harus 0–${party}; porsi dibawa dan prabayar tidak boleh melebihi kebutuhan.`,
          day: day.date,
        });
      if (meal.necessary === 0 && !meal.confirmedZero)
        issues.push({
          id: `${key}-zero`,
          message: `${prefix}: konfirmasi secara khusus inventaris nol porsi untuk ${label.toLowerCase()}.`,
          day: day.date,
        });
      if (meal.scheduling?.mode === "scheduled") {
        const schedule = meal.scheduling;
        if (
          !clock.test(schedule.window.start) ||
          !clock.test(schedule.window.end) ||
          schedule.window.start >= schedule.window.end
        )
          issues.push({
            id: `${key}-meal-window-start`,
            message: `${prefix}, ${label}: isi awal dan akhir rentang makan pada hari yang sama. Tidak ada jam makan bawaan.`,
            day: day.date,
          });
        if (!/^syn-meal-service-food-0[1-7]$/.test(schedule.serviceId))
          issues.push({
            id: `${key}-meal-service`,
            message: `${prefix}, ${label}: pilih layanan makan sintetis untuk diperiksa.`,
            day: day.date,
          });
        if (!schedule.windowConfirmed)
          issues.push({
            id: `${key}-meal-window-confirmed`,
            message: `${prefix}, ${label}: konfirmasi rentang makan yang Anda tentukan.`,
            day: day.date,
          });
      }
    }
    if (!day.inventoryConfirmed)
      issues.push({
        id: "inventory-confirmed",
        message: `${prefix}: konfirmasi seluruh inventaris makan, termasuk kebutuhan di luar waktu kunjungan.`,
        day: day.date,
      });
  });
  return issues;
}
export function purchasedPortions(day: DayPreview): number {
  return mealPreviewRows(day).reduce(
    (total, { portions: meal }) =>
      total + Math.max(0, meal.necessary - meal.provided - meal.prepaid),
    0,
  );
}
export function formatRupiah(value: number): string {
  return new Intl.NumberFormat(siteConfig.city.locale, {
    style: "currency",
    currency: siteConfig.city.currency,
    maximumFractionDigits: 0,
  }).format(value);
}
export function dateLabel(date: string, compact = false): string {
  return new Intl.DateTimeFormat(siteConfig.city.locale, {
    timeZone: siteConfig.city.timeZone,
    day: "numeric",
    month: compact ? "short" : "long",
    ...(compact ? {} : { weekday: "long" as const }),
  }).format(new Date(`${date}T00:00:00Z`));
}
