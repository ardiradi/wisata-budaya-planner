"use client";

import { FlaskConical, ListFilter, Sparkles } from "lucide-react";
import type { PlanResult } from "@/domain/planner/types";
import { COMPETITION_DEMO } from "@/config/demo";
import type {
  ReasonCode,
  RejectionCode,
} from "@/domain/recommendations/contracts";

const reasonLabels = {
  INTEREST_MATCH: "Sesuai minat budaya yang Anda pilih.",
  MANDATORY_INTEREST: "Kandidat untuk kategori budaya wajib Anda.",
  CULINARY_MATCH: "Cocok dengan preferensi kuliner pada fixture.",
  LOWER_ADMISSION:
    "Termasuk biaya kunjungan fixture terendah dalam kumpulan kandidat.",
  LOWER_WALKING:
    "Termasuk jalan di area fixture paling sedikit dalam kumpulan kandidat.",
  SHORTER_VISIT:
    "Termasuk durasi kunjungan fixture tersingkat dalam kumpulan kandidat.",
  AVAILABLE_WINDOW: "Memiliki jendela buka fixture pada waktu yang dipilih.",
} as const satisfies Record<ReasonCode, string>;

function reasonLabel(code: string) {
  return (
    reasonLabels[code as keyof typeof reasonLabels] ?? "Alasan tidak tersedia."
  );
}

const rejectionLabels: Record<RejectionCode, string> = {
  SCHEMA_INVALID: "Struktur respons ditolak oleh validator.",
  BINDING_INVALID: "Respons tidak cocok dengan snapshot kandidat yang diminta.",
  UNKNOWN_ID: "ID di luar kandidat yang diizinkan ditolak.",
  DUPLICATE_ID: "ID berulang ditolak.",
  INCOMPLETE_RANKING: "Respons tidak mencakup kumpulan kandidat yang diminta.",
  ASSERTION_INVALID: "Referensi yang tidak didukung ditolak.",
  CATEGORY_INVALID: "Kategori yang tidak didukung oleh kandidat ditolak.",
  REASON_INVALID: "Kode alasan di luar kontrak ditolak.",
  MANDATORY_MISSING: "Respons tidak mencakup kandidat minat wajib.",
  EVIDENCE_CHANGED: "Bukti berubah saat pemeringkatan; hasil tidak digunakan.",
  PROVIDER_FAILURE: "Adapter rekomendasi tidak dapat menyelesaikan permintaan.",
  TIMEOUT: "Batas waktu percobaan rekomendasi terlampaui.",
  COST_DENIED: "Izin biaya simulasi ditolak sebelum pemanggilan mock.",
  TOKEN_LIMIT: "Batas token rekomendasi tidak terpenuhi.",
  SPEND_LIMIT: "Plafon biaya simulasi tidak mengizinkan percobaan berikutnya.",
  ATTEMPT_LIMIT: "Plafon dua percobaan mock telah digunakan.",
  NO_CANDIDATES: "Tidak ada kandidat yang lolos bukti dan filter wajib.",
  REFUSAL: "Adapter rekomendasi menolak permintaan.",
  CANCELLED: "Operasi lokal dibatalkan.",
  DEADLINE: "Batas waktu operasi habis.",
  RATE_LIMITED:
    "Kuota Gemini dibatasi. Tidak ada percobaan berbayar atau pengulangan otomatis.",
  LIVE_DISABLED:
    "Gemini belum diaktifkan untuk satu uji gratis yang diizinkan. Mode offline tetap tersedia.",
  LIVE_ALREADY_USED:
    "Jatah satu uji Gemini sudah dipakai atau dicadangkan. Tidak ada panggilan berikutnya.",
  INPUT_NOT_APPROVED:
    "Kandidat tidak cocok dengan fixture dasar server. Ranking eksternal tidak dijalankan.",
};

/** Display only validated IDs and controlled templates. Never render model prose. */
export function RecommendationPanel({ result }: { result: PlanResult }) {
  const report = result.recommendation;
  const scheduled = new Map(
    result.days.flatMap((day) => day.stops).map((stop) => [stop.placeId, stop]),
  );

  if (!report)
    return (
      <section
        className="mb-6 rounded-3xl border border-primary/15 bg-secondary/60 p-5 sm:p-7"
        aria-labelledby="recommendation-heading"
      >
        <p className="eyebrow text-accent">Pilihan tetap di tangan Anda</p>
        <h2 id="recommendation-heading" className="mt-2 font-display text-2xl">
          Perubahan diperiksa secara deterministik.
        </h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Versi ini tidak memiliki hasil ranking AI. Editor mempertahankan
          pilihan dan kunci Anda, lalu memeriksa jadwal, rute, makan, dan biaya
          dengan fixture lokal. Tidak ada layanan AI aktif.
        </p>
      </section>
    );

  const assisted = report.source === "mock_ai";
  const live = report.source === "gemini_live";
  const fallback = report.source === "deterministic_fallback";
  const title = live
    ? "Gemini AI — Live"
    : assisted
      ? "Rekomendasi berbantuan AI · simulasi"
      : fallback
        ? "Rekomendasi fallback deterministik"
        : "Rekomendasi belum tersedia";
  const Icon = assisted || live ? Sparkles : ListFilter;
  const displayedRankings = report.rankings.filter((item) =>
    scheduled.has(item.placeId),
  );
  const alternatives = report.rankings.filter(
    (item) => !scheduled.has(item.placeId),
  );

  return (
    <section
      aria-labelledby="recommendation-heading"
      className="mb-6 overflow-hidden rounded-3xl border border-primary/15 bg-white"
      data-testid="recommendation-panel"
    >
      <div className="border-b border-primary/10 bg-secondary/60 p-5 sm:p-7">
        <p className="eyebrow flex items-center gap-2 text-accent">
          <FlaskConical className="size-4" aria-hidden="true" />
          {live
            ? "Katalog sintetis · Gemini API · uji gratis terbatas"
            : report.modelId
              ? "Katalog sintetis · fallback setelah jalur Gemini"
              : "Sintetis · mock lokal · tanpa API"}
        </p>
        <h2
          id="recommendation-heading"
          className="mt-3 flex items-start gap-3 font-display text-2xl sm:text-3xl"
        >
          <Icon
            className="mt-1 size-6 shrink-0 text-primary"
            aria-hidden="true"
          />
          {title}
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">
          {live
            ? `Respons ${report.modelId ?? "Gemini"} telah diterima dan lolos validasi kandidat, kategori, bukti dan alasan. Fakta destinasi tetap sintetis; inferensi nyata tidak membuktikan kelayakan perjalanan.`
            : assisted
              ? "Adapter mock mengurutkan ID kandidat yang lolos filter awal berdasarkan preferensi terstruktur. Ini simulasi arsitektur rekomendasi, bukan layanan AI langsung."
              : fallback
                ? "Ranking penyedia tidak dapat dipakai. Urutan cadangan dihitung dengan aturan deterministik dan batas wajib yang sama. Pilihan tidak dilonggarkan."
                : "Belum ada kumpulan rekomendasi yang dapat digunakan. Bukti atau batas yang belum terpenuhi tetap terlihat pada hasil; tidak diganti dengan fakta buatan."}
        </p>
        <p className="mt-3 text-xs leading-6 text-muted-foreground">
          Ranking tidak membuktikan kelayakan. Mesin deterministik tetap
          memutuskan jadwal, rute, semua kebutuhan makan, anggaran dan status
          hasil. Seluruh tempat dan bukti di halaman ini adalah fixture; belum
          ada fakta budaya nyata yang disetujui peninjau independen.
        </p>
        {!COMPETITION_DEMO && (
          <dl className="mt-5 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Kandidat tersaring</dt>
              <dd className="mt-1 font-semibold">
                {report.candidateCount} / 60
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {report.modelId
                  ? "Percobaan jalur Gemini"
                  : "Percobaan model mock"}
              </dt>
              <dd className="mt-1 font-semibold">
                {report.attempts} / {report.modelId ? 1 : 2}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {report.modelId ? "Usage token provider" : "Token simulasi"}
              </dt>
              <dd className="mt-1 font-semibold">
                {report.modelId && !live
                  ? "Belum terverifikasi"
                  : `${report.inputTokens} masuk · ${report.outputTokens} keluar`}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {report.modelId
                  ? "Rekonsiliasi biaya provider"
                  : "Biaya API nyata"}
              </dt>
              <dd className="mt-1 font-semibold">
                {report.modelId ? "Belum tersedia" : "USD 0"}
              </dd>
            </div>
          </dl>
        )}
      </div>
      <div className="p-5 sm:p-7">
        {report.rejectionCodes.length > 0 && (
          <div
            className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
            role="status"
            aria-live="polite"
          >
            <h3 className="font-semibold">Pemulihan rekomendasi lokal</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-6">
              {report.rejectionCodes.map((code) => (
                <li key={code}>
                  {rejectionLabels[code] ??
                    "Respons mock ditolak oleh pemeriksaan kontrak; kontennya tidak ditampilkan."}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-6">
              Untuk mencoba skenario lain, hapus hasil dari memori lalu buat
              rencana baru. Riwayat hanya dihapus melalui tindakan eksplisit
              Anda.
            </p>
          </div>
        )}
        {displayedRankings.length > 0 && (
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <ListFilter className="size-4 text-primary" aria-hidden="true" />
              Mengapa kandidat ini dipertimbangkan?
            </h3>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              Alasan berikut adalah kecocokan preferensi pada fixture, bukan
              klaim sejarah, harga nyata, atau jaminan akses.
            </p>
            <ul
              className="mt-4 grid gap-4 md:grid-cols-2"
              aria-label="Alasan rekomendasi terjadwal"
            >
              {displayedRankings.map((item) => (
                <li
                  key={item.placeId}
                  className="min-w-0 rounded-2xl border border-border bg-background/60 p-4"
                >
                  <h4 className="text-sm font-semibold">
                    {scheduled.get(item.placeId)?.name}
                  </h4>
                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    {item.placeId}
                  </p>
                  <ul className="mt-3 space-y-2 text-xs leading-6">
                    {item.reasonCodes.map((code) => (
                      <li key={code}>{reasonLabel(code)}</li>
                    ))}
                  </ul>
                  <details className="mt-3 border-t border-border pt-3 text-xs">
                    <summary className="cursor-pointer font-semibold text-primary">
                      Referensi immutable untuk alasan (
                      {item.assertionIds.length})
                    </summary>
                    <p className="mt-2 leading-6 text-muted-foreground">
                      Referensi field fixture yang diizinkan dalam snapshot.
                      Bukan persetujuan faktual manusia. Detail sumber lengkap
                      tersedia di kunjungan terjadwal.
                    </p>
                    <ul className="mt-2 space-y-2">
                      {item.assertionIds.map((id) => (
                        <li key={id}>
                          <code className="break-all">{id}</code>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        )}
        {alternatives.length > 0 && (
          <details className="mt-6 border-t border-border pt-4 text-xs">
            <summary className="cursor-pointer font-semibold text-primary">
              Alternatif kandidat sintetis ({alternatives.length})
            </summary>
            <p className="mt-3 leading-6 text-muted-foreground">
              ID ini lolos filter awal, tetapi belum tentu cocok dengan susunan
              atau waktu rencana ini. Gunakan kontrol Ganti di editor, tinjau
              perhitungan lengkap, lalu terapkan secara eksplisit. Rekomendasi
              tidak pernah mengganti kunjungan atau membuka kunci otomatis.
            </p>
            <ol
              className="mt-3 grid gap-3 sm:grid-cols-2"
              aria-label="Alternatif rekomendasi belum dijadwalkan"
            >
              {alternatives.map((item) => (
                <li
                  key={item.placeId}
                  className="min-w-0 rounded-xl bg-background p-3"
                >
                  <code className="break-all font-semibold">
                    {item.placeId}
                  </code>
                  <ul className="mt-2 space-y-1 leading-6">
                    {item.reasonCodes.map((code) => (
                      <li key={code}>{reasonLabel(code)}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </details>
        )}
        {!COMPETITION_DEMO && (
          <details className="mt-5 border-t border-border pt-4 text-xs">
            <summary className="cursor-pointer font-semibold text-primary">
              Jejak rekomendasi
            </summary>
            <dl className="mt-3 space-y-2 break-all leading-6">
              <div>
                <dt className="font-semibold">Kontrak</dt>
                <dd>{report.schemaVersion}</dd>
              </div>
              <div>
                <dt className="font-semibold">Snapshot kandidat</dt>
                <dd>{report.snapshotId}</dd>
              </div>
              <div>
                <dt className="font-semibold">Adapter lokal</dt>
                <dd>{report.providerId}</dd>
              </div>
              <div>
                <dt className="font-semibold">Biaya yang disimulasikan</dt>
                <dd>
                  {report.simulatedCostMicroUsd} mikro-USD; bukan tagihan
                  provider
                </dd>
              </div>
            </dl>
          </details>
        )}
      </div>
    </section>
  );
}
