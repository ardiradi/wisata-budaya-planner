"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  FileClock,
  Plus,
  Search,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  createSyntheticDraft,
  SIMULATED_CURATOR,
  SIMULATED_REVIEWER,
  type EditorialSession,
  type EditorialSnapshot,
} from "@/application/editorial/session";
import type { SyntheticPlace } from "@/domain/contracts";
import { cn } from "@/lib/utils";
import { useEditorial } from "./editorial-provider";
import { DestinationForm } from "./destination-form";

const statuses = {
  baseline_fixture: "Fixture awal · belum ditinjau",
  draft: "Draf",
  submitted: "Menunggu peninjauan",
  approved: "Disetujui · simulasi",
  rejected: "Ditolak · simulasi",
  withdrawn: "Ditarik",
} as const;
const fieldLabels = {
  identity: "Identitas",
  location: "Lokasi",
  hours: "Jam buka",
  exceptions: "Pengecualian tanggal",
  categories: "Klasifikasi",
  admission: "Biaya masuk",
  walking: "Jarak berjalan",
  dietary: "Makanan",
  accessibility: "Aksesibilitas",
};
const actionLabels: Record<string, string> = {
  baseline_fixture: "Fixture awal · bukan peninjauan",
  created: "Draf dibuat",
  updated: "Draf diperbarui",
  edited: "Draf diperbarui",
  submitted: "Dikirim ke antrean",
  approved: "Disetujui dalam simulasi",
  rejected: "Ditolak dalam simulasi",
  withdrawn: "Penarikan darurat",
  evidence_revoked: "Bukti dicabut",
  revoked: "Bukti dicabut",
};
const subscribe = () => () => {};
const isClient = () => true;
const isServer = () => false;
const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
const time = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}.${String(minute % 60).padStart(2, "0")}`;

export function EditorialDashboard() {
  const { session, snapshot } = useEditorial();
  return <EditorialWorkbench session={session} snapshot={snapshot} />;
}

export function EditorialWorkbench({
  session,
  snapshot,
}: {
  session: EditorialSession;
  snapshot: EditorialSnapshot;
}) {
  const hydrated = useSyncExternalStore(subscribe, isClient, isServer);
  const [actorId, setActorId] = useState<string>(SIMULATED_CURATOR.id);
  const actor =
    actorId === SIMULATED_REVIEWER.id ? SIMULATED_REVIEWER : SIMULATED_CURATOR;
  const [selectedId, setSelectedId] = useState("syn-history-01");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<SyntheticPlace | null>(null);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState(
    "Peninjauan simulasi; bukan persetujuan manusia nyata.",
  );
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const record =
    snapshot.records.find((entry) => entry.id === selectedId) ??
    snapshot.records[0];
  const place =
    record?.status === "withdrawn" ? null : (record?.draft ?? record?.active);
  const canReview =
    actor.role === "reviewer" && actor.id !== record?.contributorId;
  const visible = snapshot.records.filter((entry) => {
    const current =
      entry.status === "withdrawn" ? null : (entry.draft ?? entry.active);
    return (
      (filter === "all" || entry.status === filter) &&
      `${entry.id} ${current?.name ?? "Entri ditarik"}`
        .toLocaleLowerCase("id")
        .includes(query.toLocaleLowerCase("id").trim())
    );
  });
  function feedback(
    result: { ok: true } | { ok: false; code: string; message: string },
    success: string,
  ) {
    setNotice(
      result.ok
        ? { ok: true, text: success }
        : { ok: false, text: `${result.message} (${result.code})` },
    );
    return result.ok;
  }
  function choose(id: string) {
    setSelectedId(id);
    setEditing(null);
    setAdding(false);
    setNotice(null);
  }
  function beginAdd() {
    const id = `syn-editorial-${snapshot.revision + 1}`;
    setEditing(
      createSyntheticDraft(id, "Ruang Cerita Baru · sintetis", "culture"),
    );
    setAdding(true);
    setNotice(null);
  }
  function save(next: SyntheticPlace) {
    const result = adding
      ? session.createDraft(actor, next)
      : session.updateDraft(actor, next.id, next);
    if (
      feedback(
        result,
        "Draf tersimpan di memori tab. Kirim untuk peninjauan sebelum kelayakan simulasi berubah.",
      )
    ) {
      setSelectedId(next.id);
      setEditing(null);
      setAdding(false);
    }
  }
  return (
    <div className="content-container py-10 sm:py-14">
      <div className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <p className="eyebrow mb-3 text-accent">
            Di balik perjalanan yang bermakna
          </p>
          <h1 className="display-title text-4xl sm:text-5xl">
            Studio editorial.
          </h1>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Katalog yang baik dimulai dari bukti. Coba alur kurasi, peninjauan
            terpisah, dan penarikan dengan data yang sepenuhnya buatan.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/rencana">
            Lihat rencana sintetis <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
      <aside
        className="mb-6 rounded-2xl border border-amber-800/15 bg-amber-50 p-5 text-amber-950"
        aria-label="Batas demonstrasi editorial"
      >
        <div className="flex gap-3">
          <TriangleAlert className="mt-1 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">
              Simulasi peran, bukan autentikasi atau persetujuan manusia.
            </p>
            <p className="mt-2 text-xs leading-6">
              Semua destinasi, bukti, dan aktor bersifat sintetis. Data hanya
              berada di memori tab dan hilang saat halaman dimuat ulang.
              Peninjau independen nyata belum ditunjuk; tidak ada fakta budaya
              nyata yang disahkan.
            </p>
          </div>
        </div>
      </aside>
      <section
        aria-label="Ringkasan katalog editorial"
        className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {[
          {
            label: "Entri sintetis",
            value: snapshot.records.length,
            icon: BookOpenCheck,
          },
          {
            label: "Antrean peninjauan",
            value: snapshot.records.filter(
              (entry) => entry.status === "submitted",
            ).length,
            icon: FileClock,
          },
          {
            label: "Disetujui simulasi",
            value: snapshot.records.filter(
              (entry) => entry.status === "approved",
            ).length,
            icon: ShieldCheck,
          },
          { label: "Persetujuan manusia nyata", value: 0, icon: TriangleAlert },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border bg-card p-4 sm:p-5"
          >
            <item.icon className="mb-3 size-5 text-accent" aria-hidden="true" />
            <p className="font-display text-3xl">{item.value}</p>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              {item.label}
            </p>
          </div>
        ))}
      </section>
      <section
        aria-label="Pengendali aktor simulasi"
        className="mb-6 flex flex-col gap-4 rounded-2xl border bg-secondary/40 p-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <label className="text-xs font-semibold">
          Aktor simulasi aktif
          <select
            disabled={!hydrated}
            className="mt-2 block min-h-11 w-full rounded-xl border bg-card px-3 py-2 text-sm sm:w-64"
            value={actorId}
            onChange={(e) => {
              setActorId(e.target.value);
              setEditing(null);
              setAdding(false);
              setNotice(null);
            }}
          >
            <option value={SIMULATED_CURATOR.id}>Kurator simulasi</option>
            <option value={SIMULATED_REVIEWER.id}>Peninjau simulasi</option>
          </select>
        </label>
        <p className="max-w-md text-xs leading-6 text-muted-foreground">
          Pergantian ini hanya menguji aturan pemisahan peran. Kontributor tidak
          boleh menyetujui karyanya sendiri. Tidak ada akun, kredensial, atau
          tanda tangan.
        </p>
      </section>
      {notice && (
        <p
          role={notice.ok ? "status" : "alert"}
          className={cn(
            "mb-6 rounded-xl border p-4 text-sm leading-6",
            notice.ok
              ? "border-primary/20 bg-secondary"
              : "border-destructive/25 bg-card text-destructive",
          )}
        >
          {notice.text}
        </p>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <section
          aria-label="Daftar katalog sintetis"
          className="min-w-0 rounded-2xl border bg-card p-5"
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl">Katalog</h2>
            <Button
              size="sm"
              disabled={!hydrated || actor.role !== "curator"}
              onClick={beginAdd}
            >
              <Plus aria-hidden="true" />
              Tambah contoh
            </Button>
          </div>
          <label className="relative mb-3 block">
            <span className="sr-only">Cari entri editorial</span>
            <Search
              className="absolute top-3.5 left-3 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama atau ID"
              className="min-h-11 w-full rounded-xl border bg-background py-2 pr-3 pl-10 text-sm"
            />
          </label>
          <label className="block text-xs font-semibold">
            Status katalog
            <select
              className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Semua status</option>
              {Object.entries(statuses).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <p className="my-4 text-xs text-muted-foreground" aria-live="polite">
            {visible.length} entri ditampilkan
          </p>
          <ul className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {visible.map((entry) => (
              <li key={entry.id}>
                <button
                  disabled={!hydrated}
                  className={cn(
                    "w-full rounded-xl border p-4 text-left transition-colors hover:bg-secondary/60",
                    record?.id === entry.id
                      ? "border-primary bg-secondary/60"
                      : "border-transparent bg-background",
                  )}
                  onClick={() => choose(entry.id)}
                  aria-pressed={record?.id === entry.id}
                >
                  <span className="block text-sm font-semibold leading-6">
                    {entry.status === "withdrawn"
                      ? "Entri ditarik"
                      : ((entry.draft ?? entry.active)?.name ?? entry.id)}
                  </span>
                  <span className="mt-1 block break-all font-mono text-[10px] text-muted-foreground">
                    {entry.id}
                  </span>
                  <span className="mt-2 block text-[10px] font-medium text-muted-foreground">
                    {statuses[entry.status]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!visible.length && (
            <p
              role="status"
              className="rounded-xl bg-secondary/40 p-5 text-sm leading-6"
            >
              Tidak ada entri yang cocok. Ubah pencarian atau status katalog.
            </p>
          )}
        </section>
        <section
          className="min-w-0 rounded-2xl border bg-card p-5 sm:p-7"
          aria-label="Detail dan peninjauan editorial"
        >
          {editing ? (
            <>
              <p className="eyebrow mb-2 text-accent">
                {adding ? "Entri baru" : "Perubahan belum diterbitkan"}
              </p>
              <h2 className="mb-5 font-display text-3xl">
                {adding
                  ? "Tambah destinasi sintetis."
                  : "Sunting draf sintetis."}
              </h2>
              <DestinationForm
                key={`${editing.id}-${snapshot.revision}`}
                place={editing}
                onSave={save}
                onCancel={() => {
                  setEditing(null);
                  setAdding(false);
                }}
              />
            </>
          ) : record ? (
            <>
              <Badge variant="outline">{statuses[record.status]}</Badge>
              <h2 className="mt-4 font-display text-3xl leading-tight">
                {place?.name ?? "Entri ditarik dari penggunaan saat ini."}
              </h2>
              <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
                {record.id}
              </p>
              <p className="mt-3 text-xs leading-6 text-muted-foreground">
                {record.status === "baseline_fixture"
                  ? "Fixture awal tersedia hanya untuk perhitungan demo. Belum pernah mendapat peninjauan independen manusia."
                  : "Setiap keputusan di sini adalah peristiwa simulasi, bukan verifikasi fakta atau persetujuan peninjau nyata."}
              </p>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                Kelayakan editorial tidak membuktikan kelayakan rute. Entri baru
                belum memiliki fixture rute; planner tetap dapat menghasilkan
                draf jika bukti perjalanan belum tersedia.
              </p>
              {place && (
                <div className="my-6 grid gap-4 rounded-xl bg-secondary/40 p-4 text-xs sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-muted-foreground">Pengalaman</p>
                    <p className="font-semibold">
                      {place.kind === "culture" ? "Budaya" : "Kuliner"} ·{" "}
                      {place.minutes} menit
                    </p>
                    <p className="mt-2 leading-6">
                      {place.categoryIds.length
                        ? place.categoryIds
                            .map((id) => id.replace("-example", ""))
                            .join(", ")
                        : "Klasifikasi kuliner sintetis"}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-muted-foreground">
                      Jam buka & biaya · fixture
                    </p>
                    <p className="font-semibold">
                      {place.windows
                        .map(
                          (window) =>
                            `${time(window.startMinute)}–${time(window.endMinute)}`,
                        )
                        .join(" / ")}
                    </p>
                    <p className="mt-2 leading-6">
                      {rupiah(place.price.lower)}–{rupiah(place.price.upper)} /{" "}
                      {place.price.unit === "person" ? "orang" : "kelompok"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Biaya makan wajib terpisah.
                    </p>
                  </div>
                </div>
              )}
              {record.eligibilityIssues.length > 0 && (
                <div className="my-5 rounded-xl border border-amber-800/15 bg-amber-50 p-4 text-amber-950">
                  <h3 className="text-sm font-semibold">
                    Kelayakan publikasi simulasi tertahan
                  </h3>
                  <ul className="mt-2 list-disc space-y-2 pl-4 text-xs leading-6">
                    {record.eligibilityIssues.map((issue, index) => (
                      <li key={`${index}-${issue}`}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              {record.status === "withdrawn" && (
                <p
                  role="status"
                  className="my-5 rounded-xl border border-destructive/25 p-4 text-sm leading-7 text-destructive"
                >
                  Entri tidak lagi memenuhi kelayakan planner atau rekomendasi.
                  Referensi lama tidak dapat memulihkan bukti yang telah
                  ditarik. Isi versi historis tetap immutable, tetapi klaim dan
                  total yang terdampak disembunyikan pada tampilan saat ini.
                </p>
              )}
              <div className="my-5 flex flex-wrap gap-3">
                {place && record.status !== "submitted" && (
                  <Button
                    disabled={!hydrated || actor.role !== "curator"}
                    variant="outline"
                    onClick={() => {
                      setEditing(structuredClone(place));
                      setAdding(false);
                      setNotice(null);
                    }}
                  >
                    Sunting draf
                  </Button>
                )}
                {record.draft &&
                  ["draft", "rejected"].includes(record.status) && (
                    <Button
                      disabled={!hydrated || actor.role !== "curator"}
                      onClick={() =>
                        feedback(
                          session.submit(actor, record.id),
                          "Draf masuk antrean. Ganti ke peninjau simulasi untuk menilai versi ini.",
                        )
                      }
                    >
                      Kirim untuk peninjauan
                    </Button>
                  )}
              </div>
              {record.status === "submitted" && (
                <section
                  aria-label="Keputusan peninjauan simulasi"
                  className="my-6 rounded-xl border p-4"
                >
                  <h3 className="font-display text-xl">
                    Tinjau sebelum diterbitkan.
                  </h3>
                  <p className="mt-2 text-xs leading-6 text-muted-foreground">
                    {canReview
                      ? "Peninjau simulasi berbeda dari kontributor. Sembilan bidang bukti tetap wajib lengkap."
                      : "Kontributor tidak dapat menyetujui karya sendiri. Pilih peninjau simulasi yang berbeda."}
                  </p>
                  <label className="mt-4 block text-xs font-semibold">
                    Catatan keputusan simulasi
                    <textarea
                      className="mt-2 min-h-24 w-full rounded-xl border bg-background p-3 text-sm font-normal"
                      value={note}
                      maxLength={300}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      disabled={
                        !hydrated ||
                        !canReview ||
                        record.eligibilityIssues.length > 0 ||
                        !note.trim()
                      }
                      onClick={() =>
                        feedback(
                          session.review(actor, record.id, "approve", note),
                          "Disetujui dalam simulasi. Referensi kepala bidang diperbarui; ini bukan persetujuan manusia nyata.",
                        )
                      }
                    >
                      Setujui dalam simulasi
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!hydrated || !canReview || !note.trim()}
                      onClick={() =>
                        feedback(
                          session.review(actor, record.id, "reject", note),
                          "Draf ditolak dalam simulasi. Kurator dapat memperbaiki dan mengajukan kembali.",
                        )
                      }
                    >
                      Tolak draf
                    </Button>
                  </div>
                </section>
              )}
              {place && (
                <details className="my-6 border-t pt-5">
                  <summary className="text-sm font-semibold">
                    Referensi bukti per bidang
                  </summary>
                  <p className="mt-3 text-xs leading-6 text-muted-foreground">
                    Referensi immutable sintetis. Kepala bidang terbaru
                    menentukan kelayakan; bukti lama tidak menjadi cadangan
                    otomatis.
                  </p>
                  <dl className="mt-4 space-y-3">
                    {Object.entries(place.evidence).map(([field, ref]) => (
                      <div
                        key={field}
                        className="rounded-xl bg-secondary/35 p-3"
                      >
                        <dt className="text-xs font-semibold">
                          {fieldLabels[field as keyof typeof fieldLabels]} ·{" "}
                          {ref.state}
                        </dt>
                        <dd className="mt-2 space-y-1 break-all font-mono text-[10px] leading-5 text-muted-foreground">
                          <p>Sumber: {ref.sourceId}</p>
                          <p>Asersi: {ref.assertionId}</p>
                          <p>
                            Kepala: {ref.fieldHeadId} · r{ref.fieldHeadRevision}
                          </p>
                          <p>
                            Reviu: {ref.reviewId} · urutan {ref.reviewSequence}
                          </p>
                          <p>
                            Berlaku: {ref.validFrom}–{ref.validTo}
                          </p>
                          <p>Tidak ditinjau manusia · hanya fixture sintetis</p>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
              {record.active && record.status !== "withdrawn" && (
                <details className="my-6 rounded-xl border border-destructive/20 p-4">
                  <summary className="text-sm font-semibold text-destructive">
                    Penarikan darurat
                  </summary>
                  <p className="mt-3 text-xs leading-6 text-muted-foreground">
                    Menghentikan penggunaan entri oleh planner/rekomendasi dan
                    mencabut referensi saat ini. Tindakan tidak menghapus
                    riwayat atau memulihkan bukti lama.
                  </p>
                  <label className="mt-4 block text-xs font-semibold">
                    Alasan penarikan simulasi
                    <textarea
                      className="mt-2 min-h-20 w-full rounded-xl border bg-background p-3 text-sm font-normal"
                      value={note}
                      maxLength={300}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  <Button
                    className="mt-4"
                    variant="destructive"
                    disabled={!hydrated || !note.trim()}
                    onClick={() =>
                      feedback(
                        session.withdraw(actor, record.id, note),
                        "Entri ditarik. Kelayakan planner dan referensi terkait telah dicabut di memori tab ini.",
                      )
                    }
                  >
                    Tarik entri dari demo
                  </Button>
                </details>
              )}
              <section
                aria-label="Riwayat peristiwa immutable"
                className="mt-7 border-t pt-5"
              >
                <h3 className="font-display text-2xl">Jejak keputusan.</h3>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                  {record.events.length} peristiwa immutable · aktor simulasi ·
                  tanpa tanda tangan atau identitas manusia nyata.
                </p>
                {record.events.length ? (
                  <ol className="mt-5 space-y-4">
                    {record.events.map((event) => (
                      <li
                        key={event.id}
                        className="border-l-2 border-primary/15 pl-4"
                      >
                        <p className="text-sm font-semibold">
                          {actionLabels[event.action] ?? event.action}
                        </p>
                        <p className="mt-1 break-words text-xs leading-6 text-muted-foreground">
                          #{event.sequence} ·{" "}
                          {event.actorRole === "system"
                            ? "Sistem fixture"
                            : event.actorRole === "reviewer"
                              ? "Peninjau simulasi"
                              : "Kurator simulasi"}{" "}
                          ·{" "}
                          {hydrated
                            ? event.at
                            : "Waktu simulasi menunggu halaman siap"}
                        </p>
                        <p className="mt-1 text-xs leading-6">{event.note}</p>
                        <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                          {event.id}
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-4 rounded-xl bg-secondary/40 p-4 text-xs leading-6">
                    Belum ada peristiwa editorial. Fixture awal tidak memiliki
                    persetujuan manusia atau riwayat review buatan.
                  </p>
                )}
              </section>
            </>
          ) : (
            <p role="status">
              Katalog kosong. Tambahkan contoh sintetis pertama.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
