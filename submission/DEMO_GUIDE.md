# Panduan demo kompetisi — 3–5 menit

Gunakan input contoh saja. **Demo Kompetisi — Data Sintetis.** Semua identitas, bukti, jam, harga, layanan makan dan rute runtime merupakan fixture. Mock AI menyimulasikan ranking dan tidak menjalankan Gemini.

## Akses dan persiapan

**URL publik: [wisata-budaya-planner-demo.netlify.app](https://wisata-budaya-planner-demo.netlify.app). Status LIVE — demo sintetis kompetisi.** HTTPS anonim desktop/mobile telah diverifikasi, HTTP redirect 301 ke HTTPS. Plan aktual credit-based Free/USD 0 dikonfirmasi sebelum deployment, dengan saldo awal 300/300 credits sampai 27 Oktober 2026 serta tanpa kartu tersimpan atau billing details. Dua publikasi produksi telah digunakan, sesuai batas satu awal dan satu korektif; tidak ada headroom publikasi tambahan. Observasi terakhir 11:45 WIB menunjukkan 269,6/300 credits tersisa dan 30,4 terpakai, termasuk dua publikasi/30 credits, 753 web requests/0,2 credits, bandwidth 0,2 credits, compute <1 credit dan AI inference 0. Ini menggantikan snapshot 01:44 WIB yang belum lengkap. Metering dapat terlambat; saldo tersebut bukan jaminan konsumsi mendatang. Batas persiapan/verifikasi awal tetap 60 credits dan kas USD 0. Detail di [README submission](README_SUBMISSION.md#akses-demo).

Untuk latihan lokal, Node.js 24 LTS dan npm diperlukan:

```powershell
npm ci
$env:NEXT_PUBLIC_COMPETITION_DEMO = "true"
$env:GEMINI_DEMO_SMOKE_ENABLED = "false"
npm run build
npm run start
```

Setelah build tersedia, `scripts/start-demo.ps1` membuka layanan loopback tanpa key/provider. Buka [127.0.0.1:3000](http://127.0.0.1:3000/). Runtime aplikasi tidak memerlukan Maps atau database.

Gunakan **satu tab utama** dan navigasi SPA ketika berpindah antara rencana dan Studio katalog. Rencana, revisi dan editorial hanya berada dalam memori tab. Refresh memulai sesi baru. Ini berlaku juga pada hosting publik dan bukan penyimpanan akun.

## Video dan repository

[Naskah produksi video Indonesia](VIDEO_SCRIPT_ID.md) · [Subtitle SRT](Wisata-Budaya-Planner-Demo-ID.srt) · [GitHub publik](https://github.com/ardiradi/wisata-budaya-planner). Master MP4 empat menit diserahkan terpisah; subtitle-only tanpa voiceover atau panggilan speech eksternal. Tidak ada redeployment.

## Alur utama

| Bagian                 | Tindakan                                                                        | Hal yang dijelaskan                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Masalah, 20 detik      | Buka landing dan discovery                                                      | Produk menggabungkan preferensi menjadi rencana yang dapat diperiksa. Ini hipotesis, bukan hasil riset pengguna. |
| Preferensi, 40 detik   | Buka empat langkah intake                                                       | Waktu, porsi, budget, minat wajib dan walking tetap eksplisit. Jangan masukkan identitas atau lokasi privat.     |
| Hasil, 40 detik        | Pilih mock normal dan profil Jejak sejarah                                      | Total atas Rp280.500. Rencana singkat kembali 10:28 dan tetap menganggarkan makan yang belum terjadwal.          |
| Makan, 40 detik        | Tunjukkan contoh E2 di bawah                                                    | Jadwal layanan memerlukan permintaan dan bukti tersendiri. Kunjungan kuliner saja tidak membuktikan makan.       |
| Edit/history, 60 detik | Buka editor, swap Galeri ke Paviliun, preview, komit, lalu preview/komit revert | Rp280.500 menjadi Rp302.500. Revert menciptakan revisi baru dengan validasi terkini.                             |
| Recovery, 30 detik     | Pada profil baru, pilih simulasi respons invalid                                | Output asing ditolak dan fallback deterministik tetap mematuhi batas.                                            |
| Editorial, 40 detik    | Buka Studio katalog dalam tab yang sama                                         | Aktor simulasi, bukti per field dan penarikan current eligibility. Simulasi bukan review manusia.                |
| Batas, 20 detik        | Tutup dengan slide gates                                                        | M1 OPEN. Tidak ada live AI, data budaya independen, booking atau layanan wisata nyata.                           |

Durasi adalah target latihan, bukan pengukuran peserta. Jika waktu terbatas, demonstrasikan history dan withdrawal terpisah dengan reset yang dijelaskan.

## Makan dan pemanfaatan hari

Pada `/rencanakan`, pilih satu hari dan rencana singkat. Nyatakan dua porsi sarapan dibawa. Untuk makan siang, pilih wajib dijadwalkan dan layanan Dapur Cerita sintetis. Isi 12:00–13:00 dan konfirmasikan rentang sendiri. Tidak ada jam makan universal otomatis.

Hasil menempatkan layanan 12:00–12:30 untuk dua porsi di dalam kunjungan 12:00–12:45. Dua porsi makan malam tetap berbiaya tanpa waktu/tempat yang diklaim. Total atas Rp280.500. Waktu menunggu 145 menit terlihat, bukan kegiatan tambahan.

Preview perubahan jendela menjadi 12:00–12:10 menghasilkan **blocked** karena durasi layanan tidak muat. Versi valid sebelumnya tetap aktif sampai tindakan eksplisit. Batalkan usulan.

Bandingkan eksplorasi seimbang: empat tempat, 225 menit kunjungan, 319 dari 600 menit dimodelkan, 281 menit belum dialokasikan, total atas Rp423.500. Pemeriksaan budget wajib seluruh perjalanan mendahului penambahan opsional. Pencarian terbatas tidak menjamin rencana optimum global.

## Skenario tambahan

**Personalisasi:** setelah reset eksplisit, Kriya santai menghasilkan Rp242.000 dan 1.520 meter/orang, sedangkan Ruang & rasa menghasilkan Rp302.500. Seluruh angka adalah fixture.

**Syarat keras dan lock:** hapus stop kuliner dari profil sejarah untuk melihat preview blocked, lalu batalkan. Kunci stop dan coba perubahan yang bertentangan. Usulan gagal tidak menimpa versi valid.

**Unduhan:** pilih Unduh rencana sintetis (.txt). Periksa label sintetis, semua hari, revisi, waktu pemeriksaan, status bukti dan makan scheduled/unscheduled. File diunduh atas tindakan pengguna, tidak tersimpan sebagai akun dan tidak memperbarui diri setelah withdrawal.

**Withdrawal:** dalam tab yang sama, buka Studio katalog, pilih `syn-history-01`, buka Penarikan darurat, isi alasan contoh dan tarik entri dari demo. Gunakan Lihat rencana sintetis. Jadwal/total terkini yang bergantung pada bukti ditarik, sementara body revisi historis tetap beku. Refresh memulai fixture baru, jadi jangan refresh selama demonstrasi ini.

**Review simulasi:** sunting draft sebagai kurator simulasi, kirim review dan perhatikan self-approval tidak tersedia. Ganti ke peninjau simulasi dan review. Jangan menyebut aktor ini reviewer independen nyata.

## Recovery dan keterbatasan

- Tunggu loading dan tombol aktif. Gunakan tindakan recovery yang tersedia.
- Setelah refresh atau tab baru, hasil kosong dapat dipulihkan melalui profil contoh. State tidak tersinkron antartab.
- Jika URL publik gagal, laporkan error aktual. Gunakan screenshot atau loopback sebagai cadangan dengan label asal yang jelas.
- Jangan memasang key, mereset permit atau mengaktifkan provider. Gemini harus nonaktif server-side pada public mode.
- Hasil bukan saran wisata, booking atau jaminan keselamatan. Gunakan hanya data contoh.

## Penjelasan AI yang akurat

“Mock mengurutkan kandidat yang lolos filter. Output invalid memakai fallback deterministik. Adapter Gemini resmi tersedia pada source, tetapi satu request historis gagal dan belum ada genuine inference tervalidasi. Demo publik menonaktifkan provider di server dan tidak memasang key.”

“Enam lead Palembang nyata tetap dikarantina, tidak masuk runtime atau browser bundle. Reviewer independen belum ditunjuk dan target M5 tetap 30 tempat.”

QA persiapan kompetisi sebelumnya lulus **571 tes/42 file**, **86 browser desktop/mobile** dan **42 configured axe scans tanpa pelanggaran**; competition mode loopback terpisah lulus **16 kasus/10 scans**. Angka tersebut bukan run unit baru. **Verifikasi HTTPS publik:** 16/16 kasus Edge desktop/mobile lulus dalam 134,74 detik, dengan 10 configured axe scans tanpa pelanggaran. Enam belas pemeriksaan batas jaringan tidak menemukan request eksternal/provider, traveler API dispatch, runtime errors, cookies atau browser storage. Private paths mengembalikan 404; Gemini GET dan candidate-free malformed POST mengembalikan 403 `LIVE_DISABLED` dengan `no-store`. Ini uji anonim terhadap URL Netlify aktual, terpisah dari 16/10 loopback. Axe tidak menggantikan pembaca layar atau perangkat fisik. Guidebook langsung/versi dan tenggat terbaru tetap belum diverifikasi.
