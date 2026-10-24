"use client";

import type { MealScheduling } from "./intake-preview";
import { SYNTHETIC_PLACES } from "@/infrastructure/synthetic/catalogue";
import { SYNTHETIC_MEAL_SERVICES } from "@/infrastructure/synthetic/meal-services";

const fieldClass =
  "mt-2 min-h-11 w-full min-w-0 rounded-xl border border-border bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const clock = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
const serviceOptions = SYNTHETIC_MEAL_SERVICES.map((service) => ({
  id: service.id,
  durationMinutes: service.durationMinutes,
  placeName:
    SYNTHETIC_PLACES.find((place) => place.id === service.placeId)?.name ??
    "Tempat sintetis belum tersedia",
  windows: service.windows
    .map((window) => `${clock(window.startMinute)}–${clock(window.endMinute)}`)
    .join(", "),
  charge: `Rp ${service.additionalChargeIdr.lower.toLocaleString("id-ID")}–Rp ${service.additionalChargeIdr.upper.toLocaleString("id-ID")}`,
}));

/** A traveler supplies the window. Fixture selection is not a meal reservation. */
export function MealSchedulingFields({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value?: MealScheduling;
  onChange: (value: MealScheduling) => void;
}) {
  const scheduling = value ?? { mode: "unscheduled" as const };
  const chosenService =
    scheduling.mode === "scheduled"
      ? serviceOptions.find((service) => service.id === scheduling.serviceId)
      : undefined;
  return (
    <div className="mt-4 border-t border-border pt-4">
      <label htmlFor={`${id}-meal-mode`} className="text-xs font-semibold">
        {label}: pengaturan waktu
      </label>
      <select
        id={`${id}-meal-mode`}
        className={fieldClass}
        value={scheduling.mode}
        onChange={(event) =>
          onChange(
            event.target.value === "scheduled"
              ? {
                  mode: "scheduled",
                  serviceId: "",
                  window: { start: "", end: "" },
                  windowConfirmed: false,
                }
              : { mode: "unscheduled" },
          )
        }
      >
        <option value="unscheduled">Tetap dihitung, tanpa jadwal makan</option>
        <option value="scheduled">
          Wajib dijadwalkan dalam waktu tersedia
        </option>
      </select>
      {scheduling.mode === "scheduled" ? (
        <div className="mt-4 space-y-4">
          <label className="block text-xs" htmlFor={`${id}-meal-service`}>
            {label}: layanan makan sintetis
            <select
              id={`${id}-meal-service`}
              className={fieldClass}
              value={scheduling.serviceId}
              onChange={(event) =>
                onChange({
                  ...scheduling,
                  serviceId: event.target.value,
                  windowConfirmed: false,
                })
              }
            >
              <option value="">Pilih layanan untuk diperiksa</option>
              {serviceOptions.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.placeName} · layanan {service.windows} WIB
                </option>
              ))}
            </select>
          </label>
          {chosenService && (
            <p className="text-xs leading-6 text-muted-foreground">
              {chosenService.placeName}. Jam layanan contoh{" "}
              {chosenService.windows} WIB; biaya layanan grup{" "}
              {chosenService.charge}, di luar biaya porsi. Pilih rentang Anda
              sendiri di bawah ini.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {(["start", "end"] as const).map((key) => (
              <label
                className="text-xs"
                key={key}
                htmlFor={`${id}-meal-window-${key}`}
              >
                {label}: {key === "start" ? "awal" : "akhir"} rentang makan
                <input
                  id={`${id}-meal-window-${key}`}
                  type="time"
                  required
                  className={fieldClass}
                  value={scheduling.window[key]}
                  onChange={(event) =>
                    onChange({
                      ...scheduling,
                      window: {
                        ...scheduling.window,
                        [key]: event.target.value,
                      },
                      windowConfirmed: false,
                    })
                  }
                />
              </label>
            ))}
          </div>
          <label className="flex min-h-11 items-start gap-3 text-xs leading-6">
            <input
              id={`${id}-meal-window-confirmed`}
              type="checkbox"
              className="mt-1 size-5 shrink-0 accent-primary"
              checked={scheduling.windowConfirmed}
              onChange={(event) =>
                onChange({
                  ...scheduling,
                  windowConfirmed: event.target.checked,
                })
              }
            />
            Saya menentukan dan mengonfirmasi rentang {label.toLowerCase()} ini.
          </label>
          <p className="text-xs leading-6 text-muted-foreground">
            {chosenService
              ? `Layanan contoh memerlukan ${chosenService.durationMinutes} menit di tempat makan yang sesuai.`
              : "Durasi layanan diperiksa setelah Anda memilih layanan."}{" "}
            Jam buka, porsi, kebutuhan makanan dan rute akan diperiksa. Porsi
            dibawa/prabayar tetap memerlukan bukti kesesuaian; pilihan ini bukan
            reservasi.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          Seluruh porsi tetap dihitung dalam biaya. Jam dan tempat makan belum
          ditetapkan, termasuk pada hari bebas atau perjalanan parsial.
        </p>
      )}
    </div>
  );
}
