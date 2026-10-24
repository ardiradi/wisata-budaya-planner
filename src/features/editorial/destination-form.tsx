"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_IDS,
  SyntheticPlaceSchema,
  type SyntheticPlace,
} from "@/domain/contracts";

const fields = {
  identity: "Identitas",
  location: "Lokasi",
  hours: "Jam buka",
  exceptions: "Pengecualian tanggal",
  categories: "Klasifikasi",
  admission: "Biaya masuk",
  walking: "Jarak berjalan",
  dietary: "Kebutuhan makanan",
  accessibility: "Aksesibilitas",
} as const;
const categoryLabels = {
  "history-example": "Sejarah sintetis",
  "craft-example": "Kriya sintetis",
  "architecture-example": "Arsitektur sintetis",
};
const inputClass =
  "mt-2 min-h-11 w-full rounded-xl border bg-background px-3 py-2 text-sm";

function clock(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
function minutes(value: string) {
  const [hours, minute] = value.split(":").map(Number);
  return hours * 60 + minute;
}

export function DestinationForm({
  place,
  onSave,
  onCancel,
}: {
  place: SyntheticPlace;
  onSave: (place: SyntheticPlace) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(place));
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    nameRef.current?.focus();
  }, []);
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.name.trim();
    const parsed = SyntheticPlaceSchema.safeParse({
      ...draft,
      name: name.includes("sintetis") ? name : `${name} · sintetis`,
    });
    if (!parsed.success) {
      setError(
        "Periksa isian: nama, rentang biaya, waktu buka, durasi, dan referensi harus lengkap serta konsisten.",
      );
      return;
    }
    setError("");
    onSave(parsed.data);
  }
  return (
    <form
      onSubmit={save}
      className="space-y-6"
      aria-label="Formulir destinasi sintetis"
    >
      <div className="rounded-xl border border-amber-800/15 bg-amber-50 p-4 text-xs leading-6 text-amber-950">
        Hanya contoh buatan. Jangan masukkan destinasi nyata, data pribadi, atau
        klaim budaya yang belum ditinjau. Perubahan ini belum diterbitkan.
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/25 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold sm:col-span-2">
          Nama contoh
          <input
            ref={nameRef}
            className={inputClass}
            required
            maxLength={100}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label className="text-xs font-semibold">
          Jenis pengalaman
          <select
            className={inputClass}
            value={draft.kind}
            onChange={(e) =>
              setDraft({
                ...draft,
                kind: e.target.value as SyntheticPlace["kind"],
                categoryIds: e.target.value === "food" ? [] : draft.categoryIds,
              })
            }
          >
            <option value="culture">Budaya</option>
            <option value="food">Kuliner</option>
          </select>
        </label>
        <label className="text-xs font-semibold">
          Durasi kunjungan (menit)
          <input
            className={inputClass}
            type="number"
            required
            min={1}
            max={480}
            value={draft.minutes}
            onChange={(e) =>
              setDraft({ ...draft, minutes: Number(e.target.value) })
            }
          />
        </label>
      </div>
      {draft.kind === "culture" && (
        <fieldset className="space-y-3">
          <legend className="mb-3 text-xs font-semibold">
            Klasifikasi budaya sintetis
          </legend>
          {CATEGORY_IDS.map((id) => (
            <label
              key={id}
              className="flex min-h-10 items-center gap-3 text-sm"
            >
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={draft.categoryIds.includes(id)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    categoryIds: e.target.checked
                      ? [...draft.categoryIds, id]
                      : draft.categoryIds.filter((value) => value !== id),
                  })
                }
              />
              {categoryLabels[id]}
            </label>
          ))}
        </fieldset>
      )}
      {draft.kind === "food" && (
        <fieldset className="space-y-3">
          <legend className="mb-3 text-xs font-semibold">
            Preferensi rasa sintetis
          </legend>
          {(["savory", "mild"] as const).map((id) => (
            <label
              key={id}
              className="flex min-h-10 items-center gap-3 text-sm"
            >
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={draft.foodTags.includes(id)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    foodTags: e.target.checked
                      ? [...draft.foodTags, id]
                      : draft.foodTags.filter((value) => value !== id),
                  })
                }
              />
              {id === "savory" ? "Gurih" : "Ringan"}
            </label>
          ))}
        </fieldset>
      )}
      <fieldset>
        <legend className="mb-3 text-xs font-semibold">
          Jam buka sintetis · jendela pertama
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-xs">
            Buka
            <input
              className={inputClass}
              required
              type="time"
              value={clock(draft.windows[0].startMinute)}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  windows: [
                    {
                      ...draft.windows[0],
                      startMinute: minutes(e.target.value),
                    },
                    ...draft.windows.slice(1),
                  ],
                })
              }
            />
          </label>
          <label className="text-xs">
            Tutup
            <input
              className={inputClass}
              required
              type="time"
              value={clock(draft.windows[0].endMinute)}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  windows: [
                    { ...draft.windows[0], endMinute: minutes(e.target.value) },
                    ...draft.windows.slice(1),
                  ],
                })
              }
            />
          </label>
        </div>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          Jendela tambahan dan pengecualian tanggal pada fixture tetap
          dipertahankan. Bukan jam operasional nyata.
        </p>
      </fieldset>
      <fieldset>
        <legend className="mb-3 text-xs font-semibold">
          Biaya masuk sintetis · rupiah
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-xs">
            Batas bawah
            <input
              className={inputClass}
              required
              type="number"
              min={0}
              value={draft.price.lower}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  price: { ...draft.price, lower: Number(e.target.value) },
                })
              }
            />
          </label>
          <label className="text-xs">
            Batas atas
            <input
              className={inputClass}
              required
              type="number"
              min={0}
              value={draft.price.upper}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  price: { ...draft.price, upper: Number(e.target.value) },
                })
              }
            />
          </label>
          <label className="text-xs">
            Satuan
            <select
              className={inputClass}
              value={draft.price.unit}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  price: {
                    ...draft.price,
                    unit: e.target.value as "person" | "group",
                  },
                })
              }
            >
              <option value="person">Per orang</option>
              <option value="group">Per kelompok</option>
            </select>
          </label>
        </div>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          Biaya makanan wajib dihitung terpisah oleh mesin anggaran; nilai masuk
          nol tidak menghapus biaya makan.
        </p>
      </fieldset>
      <fieldset className="rounded-xl border p-4">
        <legend className="px-2 text-xs font-semibold">
          Sembilan bidang bukti sintetis
        </legend>
        <p className="mb-4 text-xs leading-6 text-muted-foreground">
          Status selain fixture atau referensi yang tidak dipublikasikan
          menghalangi kelayakan. ID sumber di bawah adalah referensi buatan,
          bukan sumber budaya nyata.
        </p>
        <div className="space-y-3">
          {Object.entries(fields).map(([key, label]) => {
            const field = key as keyof SyntheticPlace["evidence"];
            const ref = draft.evidence[field];
            return (
              <div key={key} className="rounded-xl bg-secondary/45 p-3">
                <label className="text-xs font-semibold">
                  Status bukti: {label}
                  <select
                    className={inputClass}
                    value={ref.state}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        evidence: {
                          ...draft.evidence,
                          [field]: {
                            ...ref,
                            state: e.target.value as typeof ref.state,
                          },
                        },
                      })
                    }
                  >
                    <option value="fixture">Fixture sintetis lengkap</option>
                    <option value="unknown">Belum ada bukti</option>
                    <option value="stale">Kedaluwarsa</option>
                    <option value="conflicted">Bertentangan</option>
                    <option value="revoked">Dicabut</option>
                  </select>
                </label>
                <p className="mt-2 break-all font-mono text-[10px] leading-5 text-muted-foreground">
                  {ref.assertionId}
                </p>
              </div>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-3 border-t pt-5">
        <Button type="submit">Simpan draf sintetis</Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Batal
        </Button>
      </div>
    </form>
  );
}
