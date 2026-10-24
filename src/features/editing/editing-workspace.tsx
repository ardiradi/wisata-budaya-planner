"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  GitCompareArrows,
  History,
  LoaderCircle,
  LockKeyhole,
  LockKeyholeOpen,
  Pencil,
  RefreshCcw,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  listEligibleSwapOptions,
  submissionFromRevision,
  type EditingSnapshot,
  type LocalEditingSession,
} from "@/application/editing/local-session";
import type { SyntheticPlace } from "@/domain/contracts";
import { usePlanning } from "@/features/planning/planning-provider";
import { PreferenceEditForm } from "./preference-edit-form";
import { RevisionComparison, RevisionSnapshot } from "./revision-comparison";

const card = "rounded-3xl border border-primary/15 bg-white p-5 sm:p-7";
const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const statusLabel = {
  validated: "valid dalam simulasi",
  draft: "draf",
  blocked: "terblokir",
} as const;
type SwapState = {
  stopId: string;
  name: string;
  options: SyntheticPlace[];
  selectedId: string;
  loading: boolean;
};

function Workspace({
  session,
  snapshot,
}: {
  session: LocalEditingSession;
  snapshot: EditingSnapshot;
}) {
  const [open, setOpen] = useState(false);
  const [swap, setSwap] = useState<SwapState | null>(null);
  const [allowNonValidated, setAllowNonValidated] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const editingHeading = useRef<HTMLHeadingElement>(null);
  const displayedRevision = useRef(snapshot.current.id);
  const current = snapshot.current;
  const preview = snapshot.preview;
  const busy = snapshot.busy || Boolean(swap?.loading);
  const showing = open || Boolean(preview) || busy;

  useEffect(() => {
    if (preview) previewHeading.current?.focus();
  }, [preview]);
  useEffect(() => {
    if (displayedRevision.current !== current.id) {
      displayedRevision.current = current.id;
      editingHeading.current?.focus();
    }
  }, [current.id]);
  useEffect(() => {
    function refresh() {
      session.refreshEvidence();
    }
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [session]);

  async function run(action: () => Promise<void>) {
    if (inFlight.current || snapshot.busy) {
      setLocalError(
        "Perubahan lain sedang diperiksa. Tunggu hasilnya sebelum mengirim perubahan berikutnya.",
      );
      return;
    }
    inFlight.current = true;
    setLocalError(null);
    setAllowNonValidated(false);
    try {
      await action();
    } catch {
      setLocalError(
        "Perubahan belum berhasil diperiksa. Versi tersimpan tetap tersedia; batalkan usulan atau coba lagi.",
      );
    } finally {
      inFlight.current = false;
    }
  }

  function propose(action: Parameters<LocalEditingSession["previewEdit"]>[1]) {
    setSwap(null);
    void run(() => session.previewEdit(current.id, action));
  }

  async function chooseSwap(stopId: string, name: string) {
    if (busy || inFlight.current) return;
    inFlight.current = true;
    setLocalError(null);
    setSwap({ stopId, name, options: [], selectedId: "", loading: true });
    try {
      const options = await listEligibleSwapOptions(current, stopId);
      if (session.getSnapshot().current.id !== current.id) {
        setSwap(null);
        setLocalError(
          "Versi rencana berubah saat pilihan dimuat. Buka pilihan pengganti lagi dari versi terbaru.",
        );
        return;
      }
      setSwap({
        stopId,
        name,
        options,
        selectedId: options[0]?.id ?? "",
        loading: false,
      });
    } catch {
      setSwap(null);
      setLocalError(
        "Pilihan pengganti belum dapat dibaca. Rencana tersimpan tidak berubah.",
      );
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <section className={`${card} mb-8`} aria-labelledby="editing-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow text-accent">Ruang edit lokal · B2</p>
          <h2
            id="editing-heading"
            ref={editingHeading}
            tabIndex={-1}
            className="mt-2 rounded font-display text-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:text-3xl"
          >
            Ubah, lihat, lalu terapkan.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
            Versi {current.number} tetap menjadi rencana aktif sampai Anda
            menerapkan usulan. Setiap versi menyimpan jadwal, kebutuhan, dan
            referensi fixture sendiri di memori sesi ini.
          </p>
        </div>
        <Button
          variant="outline"
          aria-expanded={showing}
          aria-controls="local-editing-controls"
          disabled={busy || Boolean(preview)}
          onClick={() => {
            setOpen(!showing);
            session.refreshEvidence();
          }}
        >
          <Pencil aria-hidden="true" />
          {showing ? "Tutup editor rencana" : "Buka editor rencana"}
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <Badge variant="secondary">
          Versi aktif {current.number} · {statusLabel[current.result.status]}
        </Badge>
        <span className="rounded-full bg-secondary px-3 py-1.5">
          {snapshot.history.length} versi immutable
        </span>
        <span className="rounded-full bg-secondary px-3 py-1.5">
          Versi valid terakhir:{" "}
          {snapshot.lastValidRevisionId
            ? (snapshot.history.find(
                (revision) => revision.id === snapshot.lastValidRevisionId,
              )?.number ?? "tersedia")
            : "belum ada"}
        </span>
      </div>
      {(localError || snapshot.message) && (
        <p
          role={
            localError || snapshot.message?.kind !== "success"
              ? "alert"
              : "status"
          }
          className={`mt-5 rounded-xl border p-4 text-sm leading-6 ${localError || snapshot.message?.kind !== "success" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-primary/20 bg-secondary text-primary"}`}
        >
          {localError ?? snapshot.message?.text}
        </p>
      )}
      {showing && (
        <div
          id="local-editing-controls"
          className="mt-7 space-y-7 border-t border-border pt-6"
        >
          {busy && (
            <p
              role="status"
              className="flex items-center gap-3 rounded-xl bg-secondary p-4 text-sm"
            >
              <LoaderCircle
                className="size-5 animate-spin"
                aria-hidden="true"
              />
              Memeriksa usulan, rute, dan seluruh kebutuhan… Versi aktif tetap
              tersedia.
            </p>
          )}
          <p className="rounded-2xl bg-background p-4 text-xs leading-6 text-muted-foreground">
            Kunci mempertahankan tempat, hari, urutan, waktu mulai, dan durasi.
            Perubahan lain tidak boleh menggesernya. Semua rute terpengaruh
            dihitung ulang menggunakan fixture terarah; jarak garis lurus tidak
            membuktikan perjalanan. Pengulangan tempat tetap mengikuti perilaku
            konservatif B1.
          </p>
          {!preview && (
            <>
              <div className="space-y-5" aria-label="Kontrol kunjungan">
                {current.intent.days.map((day, dayIndex) => (
                  <section
                    key={day.date}
                    className="rounded-2xl border border-border p-4"
                    aria-label={`Edit kunjungan hari ${dayIndex + 1}`}
                  >
                    <h3 className="text-sm font-semibold">
                      Hari {dayIndex + 1} · {day.date}
                    </h3>
                    <ol className="mt-4 space-y-4">
                      {day.stops.map((stop, index) => {
                        const scheduled = current.result.days
                          .find((entry) => entry.date === day.date)
                          ?.stops.find(
                            (entry) => entry.placeId === stop.placeId,
                          );
                        const name =
                          scheduled?.name ?? "Kunjungan dengan bukti ditarik";
                        const move = (offset: number) => {
                          const ids = day.stops.map((entry) => entry.id);
                          [ids[index], ids[index + offset]] = [
                            ids[index + offset],
                            ids[index],
                          ];
                          propose({
                            type: "reorder",
                            date: day.date,
                            stopIds: ids,
                          });
                        };
                        return (
                          <li
                            key={stop.id}
                            className="min-w-0 rounded-xl bg-background p-4"
                          >
                            <p className="break-words text-sm font-semibold">
                              {index + 1}. {name}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {scheduled
                                ? `${clock(scheduled.startMinute)}–${clock(scheduled.endMinute)} WIB`
                                : "Waktu belum dapat ditampilkan"}
                              {stop.lock ? " · terkunci" : " · belum dikunci"}
                            </p>
                            <div
                              className="mt-3 flex flex-wrap gap-2"
                              role="group"
                              aria-label={`Tindakan ${name}`}
                            >
                              <Button
                                size="sm"
                                variant="outline"
                                className="min-h-11"
                                disabled={
                                  busy ||
                                  Boolean(stop.lock) ||
                                  current.availability === "withdrawn"
                                }
                                onClick={() => void chooseSwap(stop.id, name)}
                                aria-label={`Ganti ${name}`}
                              >
                                Ganti
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="min-h-11"
                                disabled={busy || Boolean(stop.lock)}
                                onClick={() =>
                                  propose({ type: "remove", stopId: stop.id })
                                }
                                aria-label={`Hapus ${name}`}
                              >
                                <Trash2 aria-hidden="true" />
                                Hapus
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="min-h-11"
                                disabled={
                                  busy ||
                                  Boolean(stop.lock) ||
                                  index === 0 ||
                                  Boolean(day.stops[index - 1]?.lock)
                                }
                                onClick={() => move(-1)}
                                aria-label={`Naikkan ${name}`}
                              >
                                <ArrowUp aria-hidden="true" />
                                Naikkan
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="min-h-11"
                                disabled={
                                  busy ||
                                  Boolean(stop.lock) ||
                                  index === day.stops.length - 1 ||
                                  Boolean(day.stops[index + 1]?.lock)
                                }
                                onClick={() => move(1)}
                                aria-label={`Turunkan ${name}`}
                              >
                                <ArrowDown aria-hidden="true" />
                                Turunkan
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="min-h-11"
                                disabled={busy || (!stop.lock && !scheduled)}
                                onClick={() =>
                                  propose({
                                    type: "lock",
                                    stopId: stop.id,
                                    locked: !stop.lock,
                                  })
                                }
                                aria-label={`${stop.lock ? "Buka kunci" : "Kunci"} ${name}`}
                              >
                                {stop.lock ? (
                                  <LockKeyholeOpen aria-hidden="true" />
                                ) : (
                                  <LockKeyhole aria-hidden="true" />
                                )}
                                {stop.lock ? "Buka kunci" : "Kunci"}
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                      {day.stops.length === 0 && (
                        <li className="text-sm text-muted-foreground">
                          Tidak ada kunjungan pada intent hari ini; kebutuhan
                          dan minat wajib tetap diperiksa.
                        </li>
                      )}
                    </ol>
                  </section>
                ))}
              </div>
              {swap && (
                <section
                  aria-labelledby="swap-heading"
                  className="rounded-2xl border border-primary/20 bg-secondary/50 p-4"
                >
                  <h3 id="swap-heading" className="font-semibold">
                    Pengganti untuk {swap.name}
                  </h3>
                  {swap.loading ? (
                    <p className="mt-3 text-sm" role="status">
                      Memuat pilihan sintetis yang memenuhi bukti dan
                      persyaratan…
                    </p>
                  ) : (
                    <>
                      <p className="mt-2 text-xs leading-6 text-muted-foreground">
                        Pilihan lolos penyaringan kota, bukti, persyaratan, dan
                        pengulangan. Jadwal, anggaran, serta cakupan penuh baru
                        dipastikan dalam pratinjau.
                      </p>
                      {swap.options.length > 0 ? (
                        <label className="mt-4 block text-sm font-medium">
                          Destinasi pengganti sintetis
                          <select
                            value={swap.selectedId}
                            disabled={busy}
                            className="mt-2 min-h-11 w-full min-w-0 max-w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
                            onChange={(event) =>
                              setSwap({
                                ...swap,
                                selectedId: event.target.value,
                              })
                            }
                          >
                            {swap.options.map((place) => (
                              <option key={place.id} value={place.id}>
                                {place.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <p className="mt-4 text-sm">
                          Tidak ada pengganti yang memenuhi penyaringan.
                          Persyaratan tidak diubah.
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Button
                          disabled={busy || !swap.selectedId}
                          onClick={() =>
                            propose({
                              type: "swap",
                              stopId: swap.stopId,
                              placeId: swap.selectedId,
                            })
                          }
                        >
                          Pratinjau penggantian
                        </Button>
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => setSwap(null)}
                        >
                          Batalkan penggantian
                        </Button>
                      </div>
                    </>
                  )}
                </section>
              )}
              <details className="rounded-2xl border border-border p-4">
                <summary className="cursor-pointer text-sm font-semibold">
                  Edit preferensi, waktu & inventaris makan
                </summary>
                <div className="mt-5">
                  <PreferenceEditForm
                    key={current.id}
                    submission={submissionFromRevision(current)}
                    busy={busy}
                    onPreview={(submission) =>
                      void run(() =>
                        session.previewPreferences(current.id, submission),
                      )
                    }
                  />
                </div>
              </details>
            </>
          )}
          {preview && (
            <section
              className="min-w-0 rounded-2xl border-2 border-primary/25 p-4 sm:p-5"
              aria-labelledby="edit-preview-heading"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="eyebrow text-accent">Belum diterapkan</p>
                  <h3
                    id="edit-preview-heading"
                    ref={previewHeading}
                    tabIndex={-1}
                    className="mt-2 rounded font-display text-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                  >
                    Pratinjau perubahan
                  </h3>
                </div>
                <Badge
                  variant={
                    preview.proposed.result.status === "validated"
                      ? "secondary"
                      : "warning"
                  }
                >
                  Usulan {statusLabel[preview.proposed.result.status]}
                </Badge>
              </div>
              <p className="mt-3 text-xs leading-6 text-muted-foreground">
                Basis versi {preview.before.number}. Seluruh kebutuhan diperiksa
                dengan bukti fixture saat ini.{" "}
                {preview.proposed.result.work.routeAttempts} / 42 percobaan
                rute; biaya API nyata USD 0. Batas operasi tetap 45 detik.
              </p>
              {preview.proposed.result.issues.length > 0 && (
                <ul
                  aria-label="Konsekuensi dan bukti yang belum lengkap"
                  className="mt-4 space-y-3 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950"
                >
                  {preview.proposed.result.issues.map((issue, index) => (
                    <li key={`${issue.code}-${index}`}>
                      <strong>
                        {issue.severity === "violation"
                          ? "Batas wajib:"
                          : "Bukti belum lengkap:"}
                      </strong>{" "}
                      {issue.message}
                      <span className="mt-1 block text-xs">{issue.code}</span>
                    </li>
                  ))}
                </ul>
              )}
              <RevisionComparison
                before={preview.before.result}
                after={preview.proposed.result}
              />
              {preview.proposed.result.status !== "validated" && (
                <label className="mt-5 flex min-h-11 items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                  <input
                    type="checkbox"
                    className="mt-1 size-5 shrink-0 accent-primary"
                    checked={allowNonValidated}
                    disabled={busy}
                    onChange={(event) =>
                      setAllowNonValidated(event.target.checked)
                    }
                  />
                  Saya memilih menyimpan usulan{" "}
                  {statusLabel[preview.proposed.result.status]} ini secara
                  eksplisit. Rencana ini belum layak dalam simulasi; versi valid
                  sebelumnya tetap tersedia dalam riwayat.
                </label>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  className="max-w-full whitespace-normal"
                  disabled={
                    busy ||
                    (preview.proposed.result.status !== "validated" &&
                      !allowNonValidated)
                  }
                  onClick={() =>
                    void run(() =>
                      session.commit(preview.id, { allowNonValidated }),
                    )
                  }
                >
                  <Check aria-hidden="true" />
                  {preview.proposed.result.status === "validated"
                    ? "Terapkan sebagai versi baru"
                    : `Simpan usulan ${statusLabel[preview.proposed.result.status]} secara eksplisit`}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    session.discardPreview();
                    setAllowNonValidated(false);
                  }}
                >
                  <X aria-hidden="true" />
                  Batalkan usulan
                </Button>
              </div>
            </section>
          )}
          <section
            aria-labelledby="revision-history-heading"
            className="rounded-2xl border border-border p-4"
          >
            <h3
              id="revision-history-heading"
              className="flex items-center gap-2 font-semibold"
            >
              <History className="size-5" aria-hidden="true" />
              Riwayat versi sesi ini
            </h3>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              Versi lama tetap immutable. Kembali ke versi lama membuat usulan
              baru dengan validasi bukti saat ini, bukan menghidupkan kembali
              bukti yang dicabut. Muat ulang menghapus seluruh sesi.
            </p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              Pemulihan mengembalikan tujuan dan urutan. Preferensi, inventaris
              makan, dan kunci aktif tetap berlaku; anggaran atau persyaratan
              lama tidak dipulihkan otomatis.
            </p>
            <ol className="mt-4 space-y-3">
              {snapshot.history.map((revision) => (
                <li key={revision.id} className="rounded-xl bg-background p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        Versi {revision.number} ·{" "}
                        {revision.availability === "withdrawn"
                          ? "bukti ditarik"
                          : statusLabel[revision.result.status]}
                        {revision.id === current.id ? " · aktif" : ""}
                      </p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        {revision.id}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11 max-w-full whitespace-normal"
                      disabled={
                        busy || Boolean(preview) || revision.id === current.id
                      }
                      onClick={() =>
                        void run(() =>
                          session.previewRevert(current.id, revision.id),
                        )
                      }
                      aria-label={`Tinjau kembali versi ${revision.number}`}
                    >
                      <RefreshCcw aria-hidden="true" />
                      Tinjau kembali versi {revision.number}
                    </Button>
                  </div>
                  <details className="mt-3 text-xs">
                    <summary className="cursor-pointer font-semibold">
                      Lihat snapshot versi {revision.number}
                    </summary>
                    <div className="mt-4">
                      <RevisionSnapshot
                        label={`Snapshot versi ${revision.number}`}
                        result={revision.result}
                      />
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          </section>
          <p className="flex items-start gap-2 text-xs leading-6 text-muted-foreground">
            <GitCompareArrows
              className="mt-1 size-4 shrink-0"
              aria-hidden="true"
            />
            Konflik versi menolak penerapan usulan lama. Sesi ini tidak memakai
            akun, penyimpanan browser, database, atau sinkronisasi antartab.
          </p>
        </div>
      )}
    </section>
  );
}

export function EditingWorkspace() {
  const { editingSession, editingSnapshot } = usePlanning();
  if (!editingSession || !editingSnapshot) return null;
  return <Workspace session={editingSession} snapshot={editingSnapshot} />;
}
