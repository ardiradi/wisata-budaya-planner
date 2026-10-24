"use client";

import { useId, useState, type FormEvent } from "react";
import type { SyntheticSubmission } from "@/application/planning/preview-planner";
import { Button } from "@/components/ui/button";
import {
  INTEREST_OPTIONS,
  MEAL_LABELS,
  PACE_OPTIONS,
  TRANSPORT_LABELS,
} from "@/features/preferences/intake-preview";
import type { MealScheduling } from "@/features/preferences/intake-preview";
import { MealSchedulingFields } from "@/features/preferences/meal-scheduling-fields";

const inputClass =
  "mt-2 min-h-11 w-full min-w-0 rounded-xl border border-border bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
type Props = {
  submission: SyntheticSubmission;
  busy: boolean;
  onPreview: (submission: SyntheticSubmission) => void;
};

/** Dates and party size stay fixed here so an edit cannot silently invent a new meal inventory. */
export function PreferenceEditForm({ submission, busy, onPreview }: Props) {
  const [draft, setDraft] = useState(() => structuredClone(submission));
  const prefix = useId();
  function input<K extends keyof SyntheticSubmission["input"]>(
    key: K,
    value: SyntheticSubmission["input"][K],
  ) {
    setDraft((current) => ({
      ...current,
      input: { ...current.input, [key]: value },
    }));
  }
  function day(
    index: number,
    patch: Partial<SyntheticSubmission["days"][number]>,
  ) {
    setDraft((current) => ({
      ...current,
      days: current.days.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      ),
    }));
  }
  function meal(
    dayIndex: number,
    id: string,
    key: "necessary" | "provided" | "prepaid" | "confirmedZero" | "scheduling",
    value: number | boolean | MealScheduling,
  ) {
    setDraft((current) => ({
      ...current,
      days: current.days.map((entry, index) => {
        if (index !== dayIndex) return entry;
        if (id === "breakfast" || id === "lunch" || id === "dinner") {
          return {
            ...entry,
            meals: {
              ...entry.meals,
              [id]: { ...entry.meals[id], [key]: value },
            },
          };
        }
        return {
          ...entry,
          extraMeals: entry.extraMeals.map((occasion) =>
            occasion.id === id
              ? {
                  ...occasion,
                  portions: { ...occasion.portions, [key]: value },
                }
              : occasion,
          ),
        };
      }),
    }));
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onPreview(structuredClone(draft));
  }
  return (
    <form onSubmit={submit} aria-label="Ubah preferensi rencana sintetis">
      <fieldset disabled={busy} className="min-w-0 space-y-5">
        <legend className="font-semibold">Preferensi & waktu tersedia</legend>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          Tanggal dan jumlah peserta tetap. Semua inventaris makan, minat wajib,
          dan kunci diperiksa lagi; mengubah anggaran tidak menghapus kebutuhan.{" "}
          Edit mempertahankan daftar kunjungan. Layanan makan harus berada di
          salah satu tempat yang dipilih; ganti tempat secara eksplisit bila
          perlu. Untuk mencari kunjungan tambahan, buat pratinjau melalui
          formulir perjalanan.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium">
            Anggaran edit (IDR)
            <input
              className={inputClass}
              inputMode="numeric"
              pattern="[0-9]+"
              required
              value={draft.input.budget}
              onChange={(event) => input("budget", event.target.value)}
            />
          </label>
          <label className="text-sm font-medium">
            Transportasi edit
            <select
              className={inputClass}
              value={draft.input.transport}
              onChange={(event) =>
                input(
                  "transport",
                  event.target.value as typeof draft.input.transport,
                )
              }
            >
              {Object.entries(TRANSPORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Ritme edit
            <select
              className={inputClass}
              value={draft.input.pace}
              onChange={(event) =>
                input("pace", event.target.value as typeof draft.input.pace)
              }
            >
              {Object.entries(PACE_OPTIONS).map(([value, option]) => (
                <option key={value} value={value}>
                  {option.label} · maks. {option.stops} tempat
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Batas jalan kaki edit (m / orang / hari)
            <input
              className={inputClass}
              type="number"
              required
              min="1"
              max={PACE_OPTIONS[draft.input.pace].meters}
              value={draft.input.walkingLimit}
              onChange={(event) =>
                input("walkingLimit", Number(event.target.value))
              }
            />
          </label>
          <label className="text-sm font-medium">
            Preferensi rasa edit
            <select
              className={inputClass}
              value={draft.input.foodPreference}
              onChange={(event) => input("foodPreference", event.target.value)}
            >
              <option value="neutral">Tidak memilih rasa khusus</option>
              <option value="savory">Gurih</option>
              <option value="mild">Tidak pedas</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Persyaratan makanan edit
            <select
              className={inputClass}
              value={draft.input.dietaryRequirement}
              onChange={(event) =>
                input("dietaryRequirement", event.target.value)
              }
            >
              <option value="none">Tidak ada persyaratan wajib</option>
              <option value="ingredients">
                Informasi bahan wajib tersedia
              </option>
              <option value="halal">Bukti halal wajib tersedia</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Kebutuhan akses edit
            <select
              className={inputClass}
              value={draft.input.accessibilityRequirement}
              onChange={(event) =>
                input("accessibilityRequirement", event.target.value)
              }
            >
              <option value="none">Tidak ada kebutuhan khusus</option>
              <option value="step-free">Akses tanpa anak tangga wajib</option>
            </select>
          </label>
        </div>
        <fieldset className="rounded-2xl border border-border p-4">
          <legend className="px-1 text-sm font-semibold">
            Minat yang disukai
          </legend>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {INTEREST_OPTIONS.map((interest) => (
              <label
                key={interest.id}
                className="flex min-h-11 items-center gap-3 text-sm"
              >
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={draft.input.interests.includes(interest.id)}
                  disabled={draft.input.mandatoryInterests.includes(
                    interest.id,
                  )}
                  onChange={(event) =>
                    input(
                      "interests",
                      event.target.checked
                        ? [...draft.input.interests, interest.id]
                        : draft.input.interests.filter(
                            (id) => id !== interest.id,
                          ),
                    )
                  }
                />
                {interest.label} disukai
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            Minat wajib harus tetap dipilih; hapus status wajib secara eksplisit
            sebelum menghapus minat.
          </p>
        </fieldset>
        <fieldset className="rounded-2xl border border-border p-4">
          <legend className="px-1 text-sm font-semibold">
            Minat wajib sepanjang perjalanan
          </legend>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {INTEREST_OPTIONS.map((interest) => (
              <label
                key={interest.id}
                className="flex min-h-11 items-center gap-3 text-sm"
              >
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={draft.input.mandatoryInterests.includes(interest.id)}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      input: {
                        ...current.input,
                        mandatoryInterests: event.target.checked
                          ? [...current.input.mandatoryInterests, interest.id]
                          : current.input.mandatoryInterests.filter(
                              (id) => id !== interest.id,
                            ),
                        interests: event.target.checked
                          ? Array.from(
                              new Set([
                                ...current.input.interests,
                                interest.id,
                              ]),
                            )
                          : current.input.interests,
                      },
                    }))
                  }
                />
                {interest.label} wajib
              </label>
            ))}
          </div>
        </fieldset>
        {draft.days.map((entry, index) => (
          <details
            className="rounded-2xl border border-border p-4"
            key={entry.date}
            open={draft.days.length === 1 ? true : undefined}
          >
            <summary className="cursor-pointer text-sm font-semibold">
              Hari {index + 1} · {entry.date} · waktu, titik perjalanan & makan
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm font-medium">
                Mulai hari {index + 1}
                <input
                  className={inputClass}
                  type="time"
                  required
                  value={entry.start}
                  onChange={(event) =>
                    day(index, { start: event.target.value })
                  }
                />
              </label>
              <label className="text-sm font-medium">
                Selesai hari {index + 1}
                <input
                  className={inputClass}
                  type="time"
                  required
                  value={entry.end}
                  onChange={(event) => day(index, { end: event.target.value })}
                />
              </label>
              <label className="text-sm font-medium">
                Cakupan hari {index + 1}
                <select
                  className={inputClass}
                  value={entry.coverage}
                  onChange={(event) =>
                    day(index, {
                      coverage: event.target.value as typeof entry.coverage,
                    })
                  }
                >
                  <option value="both">Budaya dan kuliner</option>
                  <option value="culture-only">Budaya saja</option>
                  <option value="food-only">Kuliner saja</option>
                  <option value="free">Hari bebas</option>
                </select>
              </label>
              {(["startAnchor", "endAnchor"] as const).map((key) => (
                <label key={key} className="text-sm font-medium">
                  {key === "startAnchor" ? "Titik awal" : "Titik akhir"} hari{" "}
                  {index + 1}
                  <select
                    className={inputClass}
                    value={entry[key]}
                    onChange={(event) =>
                      day(index, { [key]: event.target.value })
                    }
                  >
                    <option value="anchor-a">Titik A sintetis</option>
                    <option value="anchor-b">Titik B sintetis</option>
                  </select>
                </label>
              ))}
            </div>
            <details className="mt-5 rounded-xl bg-background p-4">
              <summary className="cursor-pointer text-sm font-semibold">
                Inventaris makan hari {index + 1} · semua porsi tetap dihitung
              </summary>
              <div className="mt-4 space-y-4">
                {[
                  ...Object.entries(entry.meals).map(([id, portions]) => ({
                    id,
                    label: MEAL_LABELS[id as keyof typeof MEAL_LABELS],
                    portions,
                  })),
                  ...entry.extraMeals,
                ].map((occasion) => (
                  <fieldset
                    key={occasion.id}
                    className="rounded-xl border border-border p-3"
                  >
                    <legend className="px-1 text-sm font-semibold">
                      {occasion.label}
                    </legend>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {(["necessary", "provided", "prepaid"] as const).map(
                        (key) => (
                          <label key={key} className="text-xs">
                            {occasion.label}:{" "}
                            {key === "necessary"
                              ? "diperlukan"
                              : key === "provided"
                                ? "dibawa"
                                : "prabayar"}{" "}
                            hari {index + 1}
                            <input
                              className={inputClass}
                              type="number"
                              min="0"
                              max={draft.input.party}
                              required
                              value={occasion.portions[key]}
                              onChange={(event) =>
                                meal(
                                  index,
                                  occasion.id,
                                  key,
                                  Number(event.target.value),
                                )
                              }
                            />
                          </label>
                        ),
                      )}
                    </div>
                    {occasion.portions.necessary === 0 && (
                      <label className="mt-3 flex min-h-11 items-center gap-3 text-xs">
                        <input
                          type="checkbox"
                          className="size-5 accent-primary"
                          checked={occasion.portions.confirmedZero}
                          onChange={(event) =>
                            meal(
                              index,
                              occasion.id,
                              "confirmedZero",
                              event.target.checked,
                            )
                          }
                        />
                        Saya mengonfirmasi nol porsi{" "}
                        {occasion.label.toLowerCase()} hari {index + 1}.
                      </label>
                    )}
                    <MealSchedulingFields
                      id={`${prefix}-${index}-${occasion.id}`}
                      label={`${occasion.label} hari ${index + 1}`}
                      value={occasion.portions.scheduling}
                      onChange={(scheduling) =>
                        meal(index, occasion.id, "scheduling", scheduling)
                      }
                    />
                  </fieldset>
                ))}
                <label
                  htmlFor={`${prefix}-inventory-${index}`}
                  className="flex min-h-11 items-start gap-3 text-sm leading-6"
                >
                  <input
                    id={`${prefix}-inventory-${index}`}
                    type="checkbox"
                    className="mt-1 size-5 shrink-0 accent-primary"
                    checked={entry.inventoryConfirmed}
                    onChange={(event) =>
                      day(index, { inventoryConfirmed: event.target.checked })
                    }
                  />
                  Saya mengonfirmasi inventaris makan hari {index + 1}, termasuk
                  porsi di luar waktu kunjungan, lengkap.
                </label>
              </div>
            </details>
          </details>
        ))}
        <Button type="submit" className="max-w-full whitespace-normal">
          Pratinjau perubahan preferensi
        </Button>
      </fieldset>
    </form>
  );
}
