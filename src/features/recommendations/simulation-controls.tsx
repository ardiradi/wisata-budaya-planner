"use client";

import { FlaskConical, Sparkles } from "lucide-react";
import { useSyncExternalStore } from "react";
import { COMPETITION_DEMO } from "@/config/demo";

const subscribeToReadiness = () => () => undefined;
const clientReady = () => true;
const serverReady = () => false;

export const SIMULATION_MODES = [
  { id: "normal", label: "Rekomendasi mock normal" },
  { id: "invalid", label: "Respons tidak valid → fallback" },
  { id: "failure", label: "Layanan mock gagal → fallback" },
  { id: "timeout", label: "Batas waktu mock → fallback" },
  { id: "cost-denied", label: "Izin biaya simulasi ditolak → fallback" },
  { id: "repair", label: "Respons pertama ditolak → satu perbaikan mock" },
] as const;
export type RecommendationSimulationMode =
  (typeof SIMULATION_MODES)[number]["id"];
export type RecommendationProfile = "history" | "craft" | "architecture";

const profiles = [
  {
    id: "history",
    label: "Jejak sejarah",
    note: "Sejarah wajib · ritme seimbang · mobil",
  },
  {
    id: "craft",
    label: "Kriya santai",
    note: "Kriya wajib · jalan kaki · batas 2.000 m",
  },
  {
    id: "architecture",
    label: "Ruang & rasa",
    note: "Arsitektur wajib · taksi · kuliner gurih",
  },
] as const;

/** These controls choose a local failure fixture; they never configure a provider. */
export function SimulationControls({
  scenario,
  onScenarioChange,
  onProfile,
  disabled = false,
}: {
  scenario: RecommendationSimulationMode;
  onScenarioChange: (mode: RecommendationSimulationMode) => void;
  onProfile?: (profile: RecommendationProfile) => void;
  disabled?: boolean;
}) {
  const ready = useSyncExternalStore(
    subscribeToReadiness,
    clientReady,
    serverReady,
  );
  const inactive = disabled || !ready;
  return (
    <section
      aria-labelledby="recommendation-simulation-heading"
      className="rounded-3xl border border-primary/15 bg-secondary/60 p-5 sm:p-7"
    >
      <div className="flex items-center gap-2 text-primary">
        <FlaskConical className="size-5" aria-hidden="true" />
        <h2 id="recommendation-simulation-heading" className="font-semibold">
          {COMPETITION_DEMO
            ? "Skenario rekomendasi sintetis"
            : "Laboratorium rekomendasi lokal"}
        </h2>
      </div>
      <p className="mt-3 text-xs leading-6 text-muted-foreground">
        Uji personalisasi dan pemulihan dengan data sintetis. AI di sini adalah
        adapter mock deterministik di perangkat ini; bukan layanan AI aktif.
        Tidak ada permintaan atau tagihan API.
      </p>
      <label className="mt-5 block text-sm font-semibold">
        Skenario rekomendasi sintetis
        <select
          value={scenario}
          disabled={inactive}
          onChange={(event) => {
            const mode = SIMULATION_MODES.find(
              (item) => item.id === event.target.value,
            );
            if (mode) onScenarioChange(mode.id);
          }}
          className="mt-2 min-h-11 w-full rounded-xl border border-border bg-white px-3 py-3 text-sm font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
          aria-describedby="recommendation-simulation-note"
        >
          {SIMULATION_MODES.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.label}
            </option>
          ))}
        </select>
      </label>
      <p
        id="recommendation-simulation-note"
        className="mt-2 text-xs leading-6 text-muted-foreground"
      >
        Skenario hanya berlaku untuk pembuatan rencana baru. Mengganti skenario
        tidak mengubah rencana yang sudah dikomit, kunci, atau riwayat.
      </p>
      {onProfile && (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              disabled={inactive}
              onClick={() => onProfile(profile.id)}
              className="rounded-2xl border border-primary/15 bg-white p-4 text-left transition hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-60"
            >
              <span className="flex items-center gap-2 text-xs font-semibold text-primary">
                <Sparkles className="size-4 shrink-0" aria-hidden="true" />
                Profil sintetis
              </span>
              <span className="mt-2 block text-sm font-semibold">
                {profile.label}
              </span>
              <span className="mt-2 block text-xs leading-6 text-muted-foreground">
                {profile.note}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
