"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { COMPETITION_DEMO } from "@/config/demo";

const StatusSchema = z.object({
  modelId: z.enum(["gemini-3.8-flash", "gemini-2.5-flash", ""]),
  keyConfigured: z.boolean(),
  freeTierConfirmed: z.boolean(),
  smokeEnabled: z.boolean(),
  consumed: z.boolean(),
  ready: z.boolean(),
});
type Status = z.infer<typeof StatusSchema>;

export function GeminiControls(props: {
  disabled: boolean;
  onRun: (model: Exclude<Status["modelId"], "">) => void;
}) {
  if (COMPETITION_DEMO) return null;
  return <LocalGeminiControls {...props} />;
}

function LocalGeminiControls({
  disabled,
  onRun,
}: {
  disabled: boolean;
  onRun: (model: Exclude<Status["modelId"], "">) => void;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [checked, setChecked] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    void fetch("/api/recommendations/gemini", {
      cache: "no-store",
      signal: abort.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        return StatusSchema.parse(await response.json());
      })
      .then(setStatus)
      .catch(() => {
        if (!abort.signal.aborted) setFailed(true);
      });
    return () => abort.abort();
  }, []);
  const available =
    !!status?.ready &&
    !!status.modelId &&
    !status.consumed &&
    status.keyConfigured &&
    status.freeTierConfirmed &&
    status.smokeEnabled;
  return (
    <section
      className="mt-5 rounded-3xl border border-primary/20 bg-card p-5 sm:p-7"
      aria-labelledby="gemini-demo-heading"
    >
      <p className="eyebrow text-accent">Jalur API nyata · opsional</p>
      <h2 id="gemini-demo-heading" className="mt-2 font-display text-2xl">
        Satu uji Gemini Free Tier.
      </h2>
      <p className="mt-3 text-xs leading-6 text-muted-foreground">
        Mode offline di atas selalu tersedia. Jalur ini mengirim ID fixture dan
        preferensi terstruktur sintetis ke server, lalu ke Gemini. Tidak
        mengirim nama, lokasi pribadi atau konten rute pihak ketiga. Free Tier
        dapat memakai input/output untuk peningkatan produk Google.
      </p>
      <p className="mt-3 text-sm" role="status" aria-live="polite">
        {failed
          ? "Status server belum tersedia; gunakan mock offline."
          : !status
            ? "Memeriksa kesiapan lokal, tanpa memanggil Gemini…"
            : status.consumed
              ? "Satu uji sudah digunakan atau dicadangkan. Panggilan berikutnya dikunci."
              : available
                ? `Siap untuk satu uji ${status.modelId}. Belum ada inferensi yang dijalankan oleh kontrol ini.`
                : "Belum aktif: model eksplisit, key lokal, bukti Free Tier dan izin satu uji masih diperlukan. Tidak ada inferensi Gemini."}
      </p>
      <label className="mt-4 flex items-start gap-3 text-xs leading-6">
        <input
          type="checkbox"
          className="mt-1 size-5 shrink-0"
          checked={checked}
          disabled={disabled || !available}
          onChange={(event) => setChecked(event.target.checked)}
        />
        Saya mengonfirmasi izin satu permintaan gratis pada proyek Free Tier
        tanpa billing, memakai profil sejarah sintetis.
      </label>
      <Button
        className="mt-4"
        disabled={disabled || !available || !checked}
        onClick={() => {
          if (status?.modelId && available && checked) {
            setStatus({ ...status, consumed: true, ready: false });
            onRun(status.modelId);
          }
        }}
      >
        Jalankan satu inferensi Gemini
      </Button>
      <p className="mt-3 text-xs leading-6 text-muted-foreground">
        Tidak ada pengulangan otomatis, model berbayar, Search atau Maps.
        Kegagalan memakai urutan deterministik; respons hanya disebut nyata
        setelah lolos validasi.
      </p>
    </section>
  );
}
